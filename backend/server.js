/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3.2 • POST PROBE FINAL)
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
app.get('/', (req, res) => res.json({ ok: true, service: 'SIERRAUNLOCK API', version: '3.2.0', docs: '/api/health' }));
app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '3.2.0',
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

/* 10 • FASTUNLOCKERS UPSTREAM ADAPTER — config from env ONLY */
const FU = {
  base: (process.env.UNLOCK_API_URL || '').replace(/\/+$/, ''),
  key: process.env.UNLOCK_API_KEY || '',
  keyHeader: process.env.UNLOCK_API_KEY_HEADER || 'x-api-key',
  servicesPath: process.env.UNLOCK_API_SERVICES_PATH || '/api/services',
  orderPath: process.env.UNLOCK_API_ORDER_PATH || '/api/order',
  statusPath: process.env.UNLOCK_API_STATUS_PATH || '/api/order/',
  balancePath: process.env.UNLOCK_API_BALANCE_PATH || '/api/balance'
};
function fuReady() { return !!(FU.base && FU.key); }
function fuHeaders() { return { [FU.keyHeader]: FU.key, 'Accept': 'application/json', 'Content-Type': 'application/json' }; }
async function fuFetchRaw(url, headers, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, Object.assign({ headers: headers, signal: ctrl.signal }, opts || {}));
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { http: r.status, json, text: text.slice(0, 400) };
  } catch (e) {
    return { http: 0, json: null, text: 'network error: ' + e.message };
  } finally { clearTimeout(t); }
}
async function fuFetch(p, opts) {
  return fuFetchRaw(FU.base + p, fuHeaders(), opts);
}

/* 11 • UPSTREAM SMART PROBE v3.2 — POST probe on /api/balance and /api/services
   FastUnlockers answered 405 to GET on /api/balance and /api/services → means POST only.
   This probe sends POST with JSON body; never sends IMEI → no order is placed. */
app.get('/api/upstream-test', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  if (!fuReady()) return res.json({ ok: false, error: 'UNLOCK_API_URL / UNLOCK_API_KEY not set.' });
  const root = FU.base.replace(/\/public\/?$/, '');
  const probes = [
    { url: root + '/api/balance',  auth: 'header', body: { command: 'balance' } },
    { url: root + '/api/services', auth: 'header', body: { command: 'services' } },
    { url: root + '/api/balance?key=' + encodeURIComponent(FU.key),  auth: 'query', body: { command: 'balance' } },
    { url: root + '/api/services?key=' + encodeURIComponent(FU.key), auth: 'query', body: { command: 'services' } },
    { url: FU.base + '/api/balance',  auth: 'header', body: { command: 'balance' } },
    { url: FU.base + '/api/services', auth: 'header', body: { command: 'services' } }
  ];
  const report = [];
  let winner = null;
  for (const p of probes) {
    const headers = (p.auth === 'header') ? fuHeaders() : { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(p.url, { method: 'POST', headers, body: JSON.stringify(p.body), signal: ctrl.signal });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch (e) {}
      const line = p.url + ' ' + p.auth + ' POST => ' + r.status;
      report.push(line);
      if (r.status === 200 && json && !winner) {
        winner = { url: p.url, auth: p.auth, sample: json };
      }
    } catch (e) {
      report.push(p.url + ' ' + p.auth + ' POST => error: ' + e.message);
    } finally { clearTimeout(t); }
  }
  res.json({ ok: true, winner, report });
});

/* 12 • SERVICES PROXY — cached 10 minutes */
let svcCache = { ts: 0, data: null };
app.get('/api/services', async (req, res) => {
  if (!fuReady()) return res.json({ ok: false, mode: 'manual', services: [] });
  if (svcCache.data && Date.now() - svcCache.ts < 600000) return res.json({ ok: true, cached: true, services: svcCache.data });
  const r = await fuFetchRaw(FU.base + '/api/services', fuHeaders(), { method: 'POST', body: JSON.stringify({ command: 'services' }) });
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

/* 14 • 404 + CENTRAL ERROR HANDLER + BOOT */
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error('[ERR]', err.message);
  res.status(err.status || 500).json({ ok: false, error: 'Server error.' });
});
app.listen(PORT, () => console.log('SIERRAUNLOCK API v3.2 online on :' + PORT + ' — mode: ' + (fuReady() ? 'CONNECTED TO FASTUNLOCKERS' : 'MANUAL')));