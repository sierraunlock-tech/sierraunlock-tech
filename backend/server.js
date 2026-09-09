/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3.9 • LIVE CATALOG + PRICING)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The Node.js/Express "server brain" on Render with a CONFIRMED LIVE
   connection to FastUnlockers.us (GSM Hub v3.00 API, user: Alhassan301).
   v3.9 flattens the nested GSM Hub service catalog into a clean array
   and adds customer selling prices (cost x margin) in USD + SLE.

   SECTION MAP:
   01   Environment + dependencies
   02   Storage helpers (data.json, capped at 500 jobs)
   03   Global security middleware (helmet, CORS, limits, logging)
   04   Auth helpers (admin token)
   05   Joi validation schemas
   06   Public endpoints (root banner, health, rates)
   06b  /api/my-ip (founders only)
   07   Customer endpoints (unlock request, job status)
   08   Admin endpoints (rate, job update)
   09   Binance webhook stub (HMAC)
   10   GSM Hub adapter (confirmed winning format)
   11   /api/upstream-test (founders only)
   12   /api/services — FLATTENED live catalog + customer prices (cached 10 min)
   13   /api/order — real upstream order (admin token = payment confirmed)
   13b  /api/order-status — live status check
   14   404 + error handler + boot

   ENV VARIABLES (Render + local .env — NEVER in frontend/Git):
   PORT, FRONTEND_URL, ADMIN_TOKEN, UNLOCK_API_URL, UNLOCK_API_KEY,
   UNLOCK_API_USERNAME (=Alhassan301),
   optional: UNLOCK_MARGIN (customer price multiplier, default 1.8),
             BINANCE_WEBHOOK_SECRET

   MONEY SAFETY: /api/order needs admin token. Catalog is read-only.

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
  phone: Joi.string().trim().min(9).max(20).required(),
  serviceId: Joi.string().trim().max(20).optional(),
  serviceName: Joi.string().trim().max(120).optional()
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
app.get('/', (req, res) => res.json({ ok: true, service: 'SIERRAUNLOCK API', version: '3.9.0', docs: '/api/health' }));
app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '3.9.0',
  mode: fuReady() ? 'connected-to-fastunlockers' : 'manual-mode',
  time: new Date().toISOString()
}));
app.get('/api/rates', (req, res) => res.json({ ok: true, slePerUsd: load().rate }));

/* 06b • SERVER PUBLIC IP — founders only */
app.get('/api/my-ip', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    res.json({ ok: true, serverPublicIp: j.ip });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'ipify unreachable: ' + e.message });
  }
});

/* 07 • CUSTOMER ENDPOINTS */
app.post('/api/unlock', strict, async (req, res) => {
  const { error, value } = unlockSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  const db = load();
  const job = {
    id: 'SU-' + Date.now(), imei: value.imei, brand: value.brand, model: value.model,
    phone: value.phone, serviceId: value.serviceId || '', serviceName: value.serviceName || '',
    status: 'queued', created: new Date().toISOString()
  };
  db.jobs.unshift(job); save(db);
  res.json({ ok: true, job: job.id, status: job.status, note: 'Quote confirmed on WhatsApp or pay online; founder approves then order auto-places.' });
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

/* 08b • ADMIN: LIST ALL JOBS (for one-click fulfilment dashboard) */
app.get('/api/admin/jobs', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  res.json({ ok: true, jobs: load().jobs });
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

/* 10 • GSM HUB ADAPTER — confirmed winning format:
   POST /api/dhru • form-encoded • username + apiaccesskey + action */
const FU = {
  base: (process.env.UNLOCK_API_URL || '').replace(/\/+$/, ''),
  key: process.env.UNLOCK_API_KEY || '',
  username: process.env.UNLOCK_API_USERNAME || '',
  endpoint: '/api/dhru'
};
function fuReady() { return !!(FU.base && FU.key && FU.username); }
async function gsmCall(action, extraParams = {}) {
  if (!fuReady()) throw new Error('Upstream not configured.');
  const params = { username: FU.username, apiaccesskey: FU.key, action: action };
  Object.keys(extraParams).forEach(k => { if (extraParams[k] != null) params[k] = extraParams[k]; });
  const body = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(FU.base + FU.endpoint, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      signal: ctrl.signal
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { http: r.status, json, text: text.slice(0, 600) };
  } catch (e) {
    return { http: 0, json: null, text: 'network error: ' + e.message };
  } finally { clearTimeout(t); }
}

/* 11 • /api/upstream-test — founders only, read-only */
app.get('/api/upstream-test', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const r = await gsmCall('accountinfo');
  const ok = r.http === 200 && r.json && r.json.SUCCESS;
  res.json({ ok, http: r.http, sample: r.json || r.text });
});

/* 12 • /api/services — FLATTENED live catalog + customer prices (cached 10 min)
   GSM Hub returns SUCCESS:[{MESSAGE, LIST:{group:{SERVICES:{id:{...}}}}}].
   We flatten to: [{id, name, group, costUsd, priceUsd, priceSle, time, info}]
   priceUsd = costUsd x UNLOCK_MARGIN (default 1.8) — YOUR profit on every order. */
let svcCache = { ts: 0, data: null };
app.get('/api/services', async (req, res) => {
  if (!fuReady()) return res.json({ ok: false, mode: 'manual', services: [] });
  if (svcCache.data && Date.now() - svcCache.ts < 600000) {
    return res.json({ ok: true, cached: true, count: svcCache.data.length, services: svcCache.data });
  }
  const r = await gsmCall('imeiservicelist');
  if (r.http === 200 && r.json && r.json.SUCCESS) {
    const raw = r.json.SUCCESS;
    const listObj = (Array.isArray(raw) && raw[0] && raw[0].LIST) ? raw[0].LIST : (raw && raw.LIST ? raw.LIST : {});
    const rate = load().rate;
    const margin = parseFloat(process.env.UNLOCK_MARGIN || '1.8');
    const services = [];
    Object.keys(listObj).forEach(gname => {
      const g = listObj[gname] || {};
      const svcs = g.SERVICES || {};
      Object.keys(svcs).forEach(sid => {
        const s = svcs[sid] || {};
        const credit = parseFloat(s.CREDIT || '0');
        const priceUsd = Math.round(credit * margin * 100) / 100;
        services.push({
          id: String(s.SERVICEID || sid),
          name: String(s.SERVICENAME || '').trim(),
          group: String(gname),
          costUsd: credit,
          priceUsd: priceUsd,
          priceSle: Math.round(priceUsd * rate),
          time: String(s.TIME || ''),
          info: String(s.INFO || '')
        });
      });
    });
    services.sort((a, b) => a.group.localeCompare(b.group) || Number(a.id) - Number(b.id));
    svcCache = { ts: Date.now(), data: services };
    return res.json({ ok: true, cached: false, count: services.length, services: services });
  }
  res.status(502).json({ ok: false, error: 'Upstream services unreachable', detail: r.json || r.text });
});

/* 13 • /api/order — REAL upstream order (admin token = payment confirmed FIRST) */
app.post('/api/order', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = orderSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  if (!fuReady()) return res.status(503).json({ ok: false, error: 'Upstream not configured.' });
  const r = await gsmCall('placeimeiorder', {
    service: String(value.service),
    imei: value.imei,
    brand: value.brand || '',
    model: value.model || '',
    customer: value.customer || 'SIERRAUNLOCK'
  });
  const successBlock = r.json && r.json.SUCCESS;
  const success = r.http === 200 && successBlock;
  const db = load();
  const upstreamOrderId = success ? (successBlock.orderid || successBlock.order_id || successBlock.reference || null) : null;
  const job = {
    id: 'SU-' + Date.now(), imei: value.imei, service: String(value.service),
    brand: value.brand || '', model: value.model || '', customer: value.customer || '',
    status: success ? 'sent-to-server' : 'failed',
    upstream: r.json || r.text, upstreamOrderId: upstreamOrderId,
    created: new Date().toISOString()
  };
  db.jobs.unshift(job); save(db);
  res.json({ ok: success, job: job.id, upstreamOrderId, upstream: r.json || r.text });
});

/* 13b • /api/order-status — live status check */
app.post('/api/order-status', strict, async (req, res) => {
  const { error, value } = jobStatusSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: 'Invalid job id.' });
  const job = load().jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  if (fuReady() && job.upstreamOrderId) {
    const r = await gsmCall('imeiorderstatus', { orderid: job.upstreamOrderId });
    return res.json({ ok: true, job, live: r.json || r.text });
  }
  res.json({ ok: true, job });
});

/* 14 • 404 + ERROR HANDLER + BOOT */
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error('[ERR]', err.message);
  res.status(err.status || 500).json({ ok: false, error: 'Server error.' });
});
app.listen(PORT, () => console.log('SIERRAUNLOCK API v3.9 online on :' + PORT + ' — mode: ' + (fuReady() ? 'CONNECTED TO FASTUNLOCKERS (GSM HUB v3)' : 'MANUAL')));