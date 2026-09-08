/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3 • FASTUNLOCKERS CONNECTED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The Node.js/Express "server brain" (deployed on Render). It:
   • Receives unlock orders from the website
   • Connects to the FastUnlockers.us upstream server via API key
   • Places orders upstream ONLY when a founder approves (admin token)
   • Tracks job status, serves the SLE rate, verifies Binance webhooks

   SECTION MAP:
   01  Environment + dependencies
   02  Storage helpers (data.json, capped at 500 jobs)
   03  Global security middleware (helmet, CORS, body limit, rate limits, logging)
   04  Auth helpers (admin token)
   05  Joi validation schemas
   06  Public endpoints (health, rates)
   07  Customer endpoints (unlock request, job status)
   08  Admin endpoints (set rate, update job)
   09  Binance webhook stub (HMAC when secret set)
   10  FASTUNLOCKERS UPSTREAM ADAPTER (EXT-16) — config from env ONLY
   11  Upstream connection test (founders only — run once after deploy)
   12  Services proxy (cached 10 min)
   13  Upstream order placement (admin token = payment confirmed first)
   14  404 + central error handler + boot

   ENV VARIABLES (Render + local .env — NEVER in frontend, NEVER in Git):
   PORT, FRONTEND_URL, ADMIN_TOKEN,
   UNLOCK_API_URL, UNLOCK_API_KEY,
   optional: UNLOCK_API_KEY_HEADER, UNLOCK_API_SERVICES_PATH,
             UNLOCK_API_ORDER_PATH, UNLOCK_API_STATUS_PATH,
             UNLOCK_API_BALANCE_PATH, BINANCE_WEBHOOK_SECRET

   MONEY SAFETY: /api/order requires the admin token. No order is ever
   placed upstream (spending balance) without a founder approving it.

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
app.set('trust proxy', 1);

/* 02 • STORAGE HELPERS */
const load = () => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return { jobs: [], rate: 22.5 }; } };
const save = (d) => { d.jobs = (d.jobs || []).slice(0, 500); fs.writeFileSync(DATA, JSON.stringify(d, null, 2)); };
if (!fs.existsSync(DATA)) save({ jobs: [], rate: 22.5 });

/* 03 • GLOBAL SECURITY MIDDLEWARE */
app.use(helmet());
const ORIGIN = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN.split(',') }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));
const strict = rateLimit({ windowMs: 60 * 1000, max: 6 });

/* 04 • AUTH HELPERS */
const adminOk = (req) => !!process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;

/* 05 • JOI SCHEMAS */
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
const orderSchema = Joi.object({
  service: Joi.alternatives(Joi.string().max(60), Joi.number()).required(),
  imei: Joi.string().pattern(/^\d{15}$/).required(),
  brand: Joi.string().trim().max(40).optional(),
  model: Joi.string().trim().max(60).optional(),
  customer: Joi.string().trim().max(60).optional()
});

/* 06 • PUBLIC ENDPOINTS */
app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '3.0.0',
  mode: fuReady() ? 'connected-to-fastunlockers' : 'manual-mode',
  time: new Date().toISOString()
}));
app.get('/api/rates', (req, res) => res.json({ ok: true, slePerUsd: load().rate }));

/* 07 • CUSTOMER ENDPOINTS */
app.post('/api/unlock', strict, async (req, res) => {
  const { error, value } = unlockSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  const db = load();
  const job = { id: 'SU-' + Date.now(), imei: value.imei, brand: value.brand, model: value.model, phone: value.phone, status: 'queued', created: new Date().toISOString() };
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

/* 08 • ADMIN ENDPOINTS */
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

/* 09 • BINANCE WEBHOOK STUB */
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

/* 10 • FASTUNLOCKERS UPSTREAM ADAPTER — all config from environment ONLY */
const FU = {
  base: (process.env.UNLOCK_API_URL || '').replace(/\/+$/, ''),
  key: process.env.UNLOCK_API_KEY || '',
  keyHeader: process.env.UNLOCK_API_KEY_HEADER || 'x-api-key',
  servicesPath: process.env.UNLOCK_API_SERVICES_PATH || '/api/v1/services',
  orderPath: process.env.UNLOCK_API_ORDER_PATH || '/api/v1/order',
  statusPath: process.env.UNLOCK_API_STATUS_PATH || '/api/v1/order/',
  balancePath: process.env.UNLOCK_API_BALANCE_PATH || '/api/v1/balance'
};
function fuReady() { return !!(FU.base && FU.key); }
function fuHeaders() { return { [FU.keyHeader]: FU.key, 'Accept': 'application/json', 'Content-Type': 'application/json' }; }
async function fuFetch(p, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(FU.base + p, Object.assign({ headers: fuHeaders(), signal: ctrl.signal }, opts || {}));
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { http: r.status, json, text: text.slice(0, 400) };
  } catch (e) {
    return { http: 0, json: null, text: 'network error: ' + e.message };
  } finally { clearTimeout(t); }
}

/* 11 • UPSTREAM CONNECTION TEST — founders only, run once after deploy */
app.get('/api/upstream-test', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  if (!fuReady()) return res.json({ ok: false, error: 'UNLOCK_API_URL / UNLOCK_API_KEY not set in environment.' });
  const balance = await fuFetch(FU.balancePath);
  const services = await fuFetch(FU.servicesPath);
  res.json({ ok: true, base: FU.base, balance, services });
});

/* 12 • SERVICES PROXY — cached 10 minutes */
let svcCache = { ts: 0, data: null };
app.get('/api/services', async (req, res) => {
  if (!fuReady()) return res.json({ ok: false, mode: 'manual', services: [] });
  if (svcCache.data && Date.now() - svcCache.ts < 600000) return res.json({ ok: true, cached: true, services: svcCache.data });
  const r = await fuFetch(FU.servicesPath);
  if (r.http === 200 && r.json) { svcCache = { ts: Date.now(), data: r.json }; return res.json({ ok: true, cached: false, services: r.json }); }
  res.status(502).json({ ok: false, error: 'Upstream unreachable', detail: r });
});

/* 13 • UPSTREAM ORDER PLACEMENT — admin token = founder confirmed payment FIRST */
app.post('/api/order', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = orderSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  if (!fuReady()) return res.status(503).json({ ok: false, error: 'Upstream not configured.' });
  const r = await fuFetch(FU.orderPath, { method: 'POST', body: JSON.stringify(value) });
  const success = (r.http === 200 || r.http === 201);
  const db = load();
  const job = {
    id: 'SU-' + Date.now(), imei: value.imei, service: String(value.service),
    brand: value.brand || '', model: value.model || '', customer: value.customer || '',
    status: success ? 'sent-to-server' : 'failed',
    upstream: r.json || r.text,
    upstreamOrderId: success && r.json ? (r.json.order_id || r.json.orderid || r.json.orderId || r.json.id || null) : null,
    created: new Date().toISOString()
  };
  db.jobs.unshift(job); save(db);
  res.json({ ok: success, job: job.id, upstream: job.upstream });
});

/* 13b • LIVE UPSTREAM STATUS CHECK for a stored job */
app.post('/api/order-status', strict, async (req, res) => {
  const { error, value } = jobStatusSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: 'Invalid job id.' });
  const job = load().jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  if (fuReady() && job.upstreamOrderId) {
    const r = await fuFetch(FU.statusPath + encodeURIComponent(job.upstreamOrderId));
    return res.json({ ok: true, job, live: r.json || r.text });
  }
  res.json({ ok: true, job });
});

/* 13c • ROOT BANNER — clean JSON at base URL (also satisfies platform health checks) */
app.get('/', (req, res) => res.json({ ok: true, service: 'SIERRAUNLOCK API', version: '3.0.0', docs: '/api/health' }));

/* 14 • 404 + CENTRAL ERROR HANDLER + BOOT */
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error('[ERR]', err.message);
  res.status(err.status || 500).json({ ok: false, error: 'Server error.' });
});
app.listen(PORT, () => console.log('SIERRAUNLOCK API v3 online on :' + PORT + ' — mode: ' + (fuReady() ? 'CONNECTED TO FASTUNLOCKERS' : 'MANUAL')));