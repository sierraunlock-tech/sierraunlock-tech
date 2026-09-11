/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3.13 • PAYMENT AUTOMATION)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The Node.js/Express "server brain" on Render. v3.13 adds:
   • Payment automation: founder marks paid → auto-fulfil upstream
   • Binance webhook: auto-detect payment + auto-fulfil (30-sec processing)
   • Refund lock: once paid, customer cannot reverse (crypto/OM/cash final)
   • Payment status tracking: unpaid → paid → refunded (visible on track.html)

   v3.13 CHANGES (Pack 4):
   • NEW job fields: payment_status, payment_method, paid_at, refunded_at
   • NEW /api/admin/pay — marks job paid + auto-fulfils upstream
   • NEW /api/admin/refund — marks job refunded (founder-only, requires reason)
   • IMPROVED /api/webhook/binance — now triggers auto-pay + auto-fulfil
   • Job timeline: queued → paid → sent-to-server → processing → solved

   v3.12 FEATURES (still active):
   • /api/track/:id — public customer tracking
   • Flat +$2 margin, 26 SLE rate, dual-domain CORS, commission split

   MONEY FLOW:
   1. Customer orders → job created with payment_status = 'unpaid'
   2. Customer pays via OM/Binance/cash (manual) OR Binance webhook auto-detects
   3. Founder marks paid (or webhook auto-marks) → system auto-fulfils upstream
   4. FastUnlockers deducts from Alhassan's balance → delivers code
   5. Customer sees code on track.html automatically
   6. Refunds: founder-only via /api/admin/refund (fraud review required)

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

/* 02 • STORAGE HELPERS (rate default = 26 SLE/USD) */
const DEFAULT_RATE = 26.0;
const load = () => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return { jobs: [], rate: DEFAULT_RATE }; } };
const save = (d) => { d.jobs = (d.jobs || []).slice(0, 500); fs.writeFileSync(DATA, JSON.stringify(d, null, 2)); };
if (!fs.existsSync(DATA)) save({ jobs: [], rate: DEFAULT_RATE });
else {
  const db = load();
  if (!db.rate || db.rate < 20) { db.rate = DEFAULT_RATE; save(db); }
}

/* 03 • SECURITY + CORS (dual-domain authorized) */
app.use(helmet());
const FALLBACK_ORIGINS = [
  'https://sierraunlock.com',
  'https://www.sierraunlock.com',
  'http://sierraunlock.com',
  'https://sierraunlock.live',
  'https://www.sierraunlock.live',
  'http://sierraunlock.live',
  'https://sierraunlock-tech.github.io'
];
const ALLOWED = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim()).filter(Boolean)
  : FALLBACK_ORIGINS;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED.some(o => origin === o || origin.startsWith(o))) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: false
}));
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
const adminPaySchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  method: Joi.string().valid('orange_money', 'binance', 'cash').required()
});
const adminRefundSchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  reason: Joi.string().trim().min(5).max(500).required()
});

/* 06 • PUBLIC ENDPOINTS */
app.get('/', (req, res) => res.json({ ok: true, service: 'SIERRAUNLOCK API', version: '3.13.0', docs: '/api/health' }));
app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '3.13.0',
  mode: fuReady() ? 'connected-to-fastunlockers' : 'manual-mode',
  rate: load().rate,
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
    status: 'queued',
    payment_status: 'unpaid',
    payment_method: null,
    paid_at: null,
    refunded_at: null,
    refund_reason: null,
    created: new Date().toISOString()
  };
  db.jobs.unshift(job); save(db);
  res.json({ ok: true, job: job.id, status: job.status, note: 'Order received. Please complete payment to start processing.' });
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
  svcCache.ts = 0;
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

/* 08b • ADMIN: LIST ALL JOBS */
app.get('/api/admin/jobs', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  res.json({ ok: true, jobs: load().jobs });
});

/* 08c • ADMIN: MARK PAID + AUTO-FULFIL (v3.13)
   When founder confirms payment, system auto-places upstream order.
   Refund lock: once paid, customer cannot reverse (crypto/OM/cash final). */
app.post('/api/admin/pay', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = adminPaySchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  
  /* Refund lock: cannot re-pay already paid jobs */
  if (job.payment_status === 'paid') {
    return res.status(400).json({ ok: false, error: 'Job already paid. Use /api/admin/refund to reverse.' });
  }
  
  /* Mark paid */
  job.payment_status = 'paid';
  job.payment_method = value.method;
  job.paid_at = new Date().toISOString();
  job.status = 'sent-to-server';
  
  /* Auto-fulfil: place upstream order */
  if (!fuReady()) {
    save(db);
    return res.json({ ok: true, job: job.id, warning: 'Payment marked but upstream not configured. Manual fulfilment required.' });
  }
  
  const r = await gsmCall('placeimeiorder', {
    service: String(job.serviceId || job.service),
    imei: job.imei,
    brand: job.brand || '',
    model: job.model || '',
    customer: job.id
  });
  
  const successBlock = r.json && r.json.SUCCESS;
  const success = r.http === 200 && successBlock;
  const upstreamOrderId = success ? (successBlock.orderid || successBlock.order_id || successBlock.reference || null) : null;
  
  if (success) {
    job.upstream = r.json;
    job.upstreamOrderId = upstreamOrderId;
  } else {
    job.status = 'failed';
    job.upstream = r.json || r.text;
  }
  
  save(db);
  res.json({
    ok: success,
    job: job.id,
    payment_status: job.payment_status,
    upstreamOrderId,
    upstream: r.json || r.text
  });
});

/* 08d • ADMIN: REFUND (v3.13)
   Founder-only refund after fraud review. Requires reason.
   Refund lock: only paid jobs can be refunded. */
app.post('/api/admin/refund', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = adminRefundSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  
  /* Refund lock: only paid jobs can be refunded */
  if (job.payment_status !== 'paid') {
    return res.status(400).json({ ok: false, error: 'Only paid jobs can be refunded.' });
  }
  
  job.payment_status = 'refunded';
  job.refunded_at = new Date().toISOString();
  job.refund_reason = value.reason;
  job.status = 'failed';
  
  save(db);
  res.json({ ok: true, job: job.id, payment_status: job.payment_status, refund_reason: job.refund_reason });
});

/* 09 • BINANCE WEBHOOK (v3.13 — AUTO-PAY + AUTO-FULFIL)
   When Binance Pay payment is confirmed, auto-mark paid + auto-fulfil.
   Customer must include job ID in payment note (e.g. "SU-1234567890"). */
app.post('/api/webhook/binance', express.raw({ type: '*/*' }), async (req, res) => {
  const secret = process.env.BINANCE_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.get('x-binance-signature') || '';
    const hmac = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    let ok = false;
    try { ok = sig.length === hmac.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac)); } catch (e) { ok = false; }
    if (!ok) return res.status(401).json({ ok: false, error: 'Bad signature.' });
  }
  
  /* Parse Binance payload */
  let payload = null;
  try { payload = JSON.parse(req.body.toString()); } catch (e) {}
  if (!payload) return res.status(400).json({ ok: false, error: 'Invalid payload.' });
  
  /* Extract job ID from payment note (customer included it) */
  const note = payload.note || payload.remark || '';
  const jobIdMatch = note.match(/SU-\d+/);
  if (!jobIdMatch) {
    return res.json({ ok: true, received: true, warning: 'No job ID in payment note. Manual processing required.' });
  }
  
  const jobId = jobIdMatch[0];
  const db = load();
  const job = db.jobs.find(j => j.id === jobId);
  if (!job) {
    return res.json({ ok: true, received: true, warning: 'Job ID not found. Manual processing required.' });
  }
  
  /* Refund lock: cannot re-pay already paid jobs */
  if (job.payment_status === 'paid') {
    return res.json({ ok: true, received: true, warning: 'Job already paid.' });
  }
  
  /* Auto-mark paid + auto-fulfil */
  job.payment_status = 'paid';
  job.payment_method = 'binance';
  job.paid_at = new Date().toISOString();
  job.status = 'sent-to-server';
  
  if (fuReady()) {
    const r = await gsmCall('placeimeiorder', {
      service: String(job.serviceId || job.service),
      imei: job.imei,
      brand: job.brand || '',
      model: job.model || '',
      customer: job.id
    });
    
    const successBlock = r.json && r.json.SUCCESS;
    const success = r.http === 200 && successBlock;
    const upstreamOrderId = success ? (successBlock.orderid || successBlock.order_id || successBlock.reference || null) : null;
    
    if (success) {
      job.upstream = r.json;
      job.upstreamOrderId = upstreamOrderId;
    } else {
      job.status = 'failed';
      job.upstream = r.json || r.text;
    }
  }
  
  save(db);
  res.json({ ok: true, received: true, job: jobId, auto_fulfilled: true });
});

/* 10 • GSM HUB ADAPTER — confirmed winning format */
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

/* 12 • /api/services — PUBLIC catalog (cost HIDDEN from customers) */
let svcCache = { ts: 0, data: null };
async function fetchCatalog() {
  if (svcCache.data && Date.now() - svcCache.ts < 600000) return svcCache.data;
  const r = await gsmCall('imeiservicelist');
  if (r.http === 200 && r.json && r.json.SUCCESS) {
    const raw = r.json.SUCCESS;
    const listObj = (Array.isArray(raw) && raw[0] && raw[0].LIST) ? raw[0].LIST : (raw && raw.LIST ? raw.LIST : {});
    const rate = load().rate;
    const flat = parseFloat(process.env.UNLOCK_FLAT_FEE || '2');
    const splitStr = (process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25').split(',');
    const suShare = Math.max(0, Math.min(1, parseFloat(splitStr[0]) || 0.75));
    const alShare = Math.max(0, Math.min(1, parseFloat(splitStr[1]) || 0.25));
    const services = [];
    Object.keys(listObj).forEach(gname => {
      const g = listObj[gname] || {};
      const svcs = g.SERVICES || {};
      Object.keys(svcs).forEach(sid => {
        const s = svcs[sid] || {};
        const credit = parseFloat(s.CREDIT || '0');
        const priceUsd = Math.round((credit + flat) * 100) / 100;
        const profit = priceUsd - credit;
        services.push({
          id: String(s.SERVICEID || sid),
          name: String(s.SERVICENAME || '').trim(),
          group: String(gname),
          costUsd: credit,
          priceUsd: priceUsd,
          profitUsd: Math.round(profit * 100) / 100,
          sierraunlockShareUsd: Math.round(profit * suShare * 100) / 100,
          alhassanShareUsd: Math.round(profit * alShare * 100) / 100,
          priceSle: Math.round(priceUsd * rate),
          time: String(s.TIME || ''),
          info: String(s.INFO || '')
        });
      });
    });
    services.sort((a, b) => a.group.localeCompare(b.group) || Number(a.id) - Number(b.id));
    svcCache = { ts: Date.now(), data: services };
    return services;
  }
  return null;
}
app.get('/api/services', async (req, res) => {
  if (!fuReady()) return res.json({ ok: false, mode: 'manual', services: [] });
  const services = await fetchCatalog();
  if (!services) return res.status(502).json({ ok: false, error: 'Upstream services unreachable' });
  const pub = services.map(s => ({
    id: s.id, name: s.name, group: s.group,
    priceUsd: s.priceUsd, priceSle: s.priceSle,
    time: s.time, info: s.info
  }));
  res.json({ ok: true, cached: (Date.now() - svcCache.ts) < 600000, count: pub.length, services: pub });
});

/* 12b • /api/admin/services — FOUNDERS ONLY (cost + commission visible) */
app.get('/api/admin/services', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  if (!fuReady()) return res.json({ ok: false, mode: 'manual', services: [] });
  const services = await fetchCatalog();
  if (!services) return res.status(502).json({ ok: false, error: 'Upstream services unreachable' });
  const splitStr = (process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25').split(',');
  res.json({
    ok: true,
    count: services.length,
    policy: {
      flatFeeUsd: parseFloat(process.env.UNLOCK_FLAT_FEE || '2'),
      sierraunlockShare: parseFloat(splitStr[0]) || 0.75,
      alhassanShare: parseFloat(splitStr[1]) || 0.25,
      rateSlePerUsd: load().rate
    },
    services: services
  });
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

/* 13c • /api/track/:id — PUBLIC customer tracking endpoint */
app.get('/api/track/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id || id.length < 3 || id.length > 60) {
    return res.status(400).json({ ok: false, error: 'Invalid job ID.' });
  }
  const job = load().jobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });

  let code = null, message = null, failed = false;
  if (job.upstream && typeof job.upstream === 'object') {
    const up = job.upstream;
    const s = up.SUCCESS || up.success || null;
    const e = up.ERROR   || up.error   || null;
    if (s && typeof s === 'object') {
      code    = s.code || s.unlock_code || s.CODE || s.UNLOCK_CODE || null;
      message = s.message || s.MESSAGE || null;
    } else if (typeof s === 'string') {
      code = s;
    }
    if (e && typeof e === 'object') {
      failed = true;
      message = e.message || e.MESSAGE || JSON.stringify(e);
    } else if (typeof e === 'string') {
      failed = true; message = e;
    }
  }

  const maskedImei = job.imei
    ? job.imei.slice(0, 6) + '******' + job.imei.slice(-3)
    : '';

  res.json({
    ok: true,
    job: {
      id: job.id,
      serviceName: job.serviceName || job.service || '—',
      imei: maskedImei,
      status: job.status,
      payment_status: job.payment_status || 'unpaid',
      failed: failed,
      code: (job.status === 'solved' || code) ? (code || message) : null,
      message: message,
      created: job.created,
      upstreamOrderId: job.upstreamOrderId || null,
      eta: (job.status === 'queued' || job.status === 'sent-to-server' || job.status === 'processing')
        ? 'In progress — this page refreshes automatically.'
        : null
    }
  });
});

/* 14 • 404 + ERROR HANDLER + BOOT */
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error('[ERR]', err.message);
  res.status(err.status || 500).json({ ok: false, error: 'Server error.' });
});
app.listen(PORT, () => {
  const mode = fuReady() ? 'CONNECTED TO FASTUNLOCKERS (GSM HUB v3)' : 'MANUAL';
  console.log(`SIERRAUNLOCK API v3.13 online on :${PORT} — mode: ${mode}`);
  console.log(`  Policy: cost + $${process.env.UNLOCK_FLAT_FEE || '2'} flat • rate 1 USD = ${load().rate} SLE • split ${(process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25')}`);
  console.log(`  Authorized origins: ${ALLOWED.join(', ')}`);
  console.log(`  Payment automation: /api/admin/pay (founder) + /api/webhook/binance (auto)`);
  console.log(`  Refund lock: /api/admin/refund (founder-only, requires reason)`);
});