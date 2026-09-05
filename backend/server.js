/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v2 • DOCUMENTED + HARDENED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The Node.js/Express "server brain" (deployed on Render). It receives
   unlock orders, serves the SLE rate, tracks job status, and — when the
   unlock company's API keys arrive (EXT-16) — forwards orders to the
   upstream unlock server automatically. Until then it runs in MANUAL
   MODE (orders queued, fulfilled on WhatsApp).

   SECTION MAP:
   01  Environment + dependencies
   02  Storage helpers (data.json, capped at 500 jobs)
   03  Global security middleware (helmet, CORS, body limit, rate limits, logging)
   04  Auth helpers (admin token, upstream check)
   05  Public endpoints (health, rates)
   06  Customer endpoints (unlock order, job status) — Joi validated
   07  Admin endpoints (set rate, update job) — token + rate-limit protected
   08  Binance webhook stub — HMAC signature check when secret is set
   09  404 + central error handler + boot

   ENV VARIABLES (.env):
   PORT                     — server port (Render sets it)
   FRONTEND_URL             — comma-separated allowed origins (or leave unset for dev)
   ADMIN_TOKEN              — secret token for /api/admin/* routes
   UNLOCK_API_URL           — upstream unlock company base URL (EXT-16)
   UNLOCK_API_KEY           — upstream bearer key (EXT-16)
   BINANCE_WEBHOOK_SECRET   — HMAC secret for Binance webhooks (future)

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   ===================================================================== */

/* 01 • ENVIRONMENT + DEPENDENCIES */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const Joi = require('joi');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data.json');
app.set('trust proxy', 1);                       /* Render sits behind a proxy — needed for correct rate limiting */

/* 02 • STORAGE HELPERS — simple JSON file DB, capped at 500 jobs */
const load = () => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return { jobs: [], rate: 22.5 }; } };
const save = (d) => { d.jobs = (d.jobs || []).slice(0, 500); fs.writeFileSync(DATA, JSON.stringify(d, null, 2)); };
if (!fs.existsSync(DATA)) save({ jobs: [], rate: 22.5 });

/* 03 • GLOBAL SECURITY MIDDLEWARE */
app.use(helmet());                               /* secure headers */
const ORIGIN = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN.split(',') }));  /* dev-safe, prod-strict */
app.use(express.json({ limit: '100kb' }));       /* body-size cap vs. payload floods */
app.use(morgan('dev'));                          /* request logging for abuse tracking */
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));                  /* global: 60 req/min */
const strict = rateLimit({ windowMs: 60 * 1000, max: 6 });             /* sensitive: 6 req/min */

/* 04 • AUTH HELPERS */
const adminOk = (req) => !!process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;
const HAS_UPSTREAM = () => !!(process.env.UNLOCK_API_URL && process.env.UNLOCK_API_KEY);

/* 04b • JOI SCHEMAS — strict input validation on every endpoint */
const unlockSchema = Joi.object({
  imei: Joi.string().pattern(/^\d{15}$/).required(),
  brand: Joi.string().trim().min(2).max(40).required(),
  model: Joi.string().trim().min(2).max(60).required(),
  phone: Joi.string().trim().min(9).max(20).required()
});
const jobStatusSchema = Joi.object({ id: Joi.string().trim().min(3).max(40).required() });
const adminRateSchema = Joi.object({ slePerUsd: Joi.number().positive().max(100000).required() });
const adminJobSchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  status: Joi.string().valid('queued', 'sent-to-server', 'processing', 'solved', 'failed').required()
});

/* 05 • PUBLIC ENDPOINTS */
app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '2.0.0',
  mode: HAS_UPSTREAM() ? 'connected-to-unlock-server' : 'manual-mode',
  time: new Date().toISOString()
}));

app.get('/api/rates', (req, res) => res.json({ ok: true, slePerUsd: load().rate }));

/* 06 • CUSTOMER ENDPOINTS */
app.post('/api/unlock', strict, async (req, res) => {
  const { error, value } = unlockSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  const { imei, brand, model, phone } = value;

  const db = load();
  const job = { id: 'SU-' + Date.now(), imei, brand, model, phone, status: 'queued', created: new Date().toISOString() };

  if (HAS_UPSTREAM()) {
    try {
      const ctrl = new AbortController();                       /* 10 s timeout vs. dead upstream */
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(process.env.UNLOCK_API_URL + '/unlock', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.UNLOCK_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, brand, model }),
        signal: ctrl.signal
      });
      clearTimeout(t);
      job.upstream = await r.json();
      job.status = 'sent-to-server';
    } catch (e) { job.upstreamError = 'server unreachable — process manually'; }
  }

  db.jobs.unshift(job); save(db);
  res.json({ ok: true, job: job.id, status: job.status, note: 'Quote confirmed on WhatsApp.' });
});

app.post('/api/job-status', strict, (req, res) => {
  const { error, value } = jobStatusSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: 'Invalid job id.' });
  const job = load().jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  res.json({ ok: true, job });
});

/* 07 • ADMIN ENDPOINTS — token + rate-limit protected */
app.post('/api/admin/rate', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = adminRateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: 'Invalid rate.' });
  const db = load(); db.rate = value.slePerUsd; save(db);
  res.json({ ok: true, slePerUsd: value.slePerUsd });
});

app.post('/api/admin/job', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = adminJobSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: 'Invalid payload.' });
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  job.status = value.status;
  save(db);
  res.json({ ok: true, job });
});

/* 08 • BINANCE WEBHOOK STUB — verifies HMAC signature when secret is configured */
app.post('/api/webhook/binance', express.raw({ type: '*/*' }), (req, res) => {
  const secret = process.env.BINANCE_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.get('x-binance-signature') || '';
    const hmac = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    let ok = false;
    try { ok = sig.length === hmac.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac)); } catch (e) { ok = false; }
    if (!ok) return res.status(401).json({ ok: false, error: 'Bad signature.' });
  }
  res.json({ ok: true, received: true });
});

/* 09 • 404 + CENTRAL ERROR HANDLER + BOOT */
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {               /* never leak stack traces */
  console.error('[ERR]', err.message);
  res.status(err.status || 500).json({ ok: false, error: 'Server error.' });
});
app.listen(PORT, () => console.log('SIERRAUNLOCK API v2 online on :' + PORT + ' — mode: ' + (HAS_UPSTREAM() ? 'CONNECTED' : 'MANUAL')));