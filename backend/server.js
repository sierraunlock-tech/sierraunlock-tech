/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3.12 • TRACK ENDPOINT ADDED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The Node.js/Express "server brain" on Render. It is the secure bridge
   between sierraunlock.com + sierraunlock.live (both now authorized) and
   the FastUnlockers upstream server (GSM Hub v3.00, user: Alhassan301).

   v3.12 CHANGES (Pack 3 addition):
   • NEW public /api/track/:id endpoint — customers can fetch their own
     job status live. Returns sanitized data: job ID, service name,
     masked IMEI, status, and (when solved) the unlock code/message.
     NO wholesale cost, NO admin data, NO raw upstream JSON exposed.
     Feeds the track.html page which auto-refreshes every 10 seconds.

   v3.11 FEATURES (still active):
   • PRICING ENGINE = cost + flat $2 (NOT a multiplier anymore)
       wholesale $0.10  → customer $2.10  → profit $2.00
       wholesale $10.00 → customer $12.00 → profit $2.00
       wholesale $60.00 → customer $62.00 → profit $2.00
     (matches founder rule: "company gives 10 → we sell 12")
   • EXCHANGE RATE = 1 USD = 26 Leones (default). Founder updates
     anytime via /api/admin/rate if rate rises or falls; all services
     auto-recalculate within 10 minutes (cache refresh).
   • COMMISSION SPLIT = SIERRAUNLOCK 75% + Alhassan 25% of the $2 margin
     (founder view only). Example on a $2 margin:
       SIERRAUNLOCK keeps $1.50 (ops, platform, support)
       Alhassan earns $0.50 (commission per business)
     Configurable via UNLOCK_COMMISSION_SPLIT env (e.g. "0.75,0.25").
   • DUAL DOMAIN CORS = both sierraunlock.com AND sierraunlock.live
     (plus their www variants) are authorized origins.
   • COST PRIVACY = /api/services (public) NEVER exposes wholesale cost;
     only /api/admin/services (founder-only) shows cost + commission.

   SECTION MAP:
   01 Env + deps            08 Admin endpoints        13 Upstream order
   02 Storage helpers       08b Admin jobs list       13b Order status
   03 Security + CORS       09 Binance webhook stub   13c NEW: public /api/track/:id
   04 Auth helpers          10 GSM Hub adapter        14 404 + boot
   05 Joi schemas           11 upstream-test (founders)
   06 Public endpoints      12 Services (PUBLIC, cost hidden)
   06b my-ip (founders)     12b Services (ADMIN, cost + commission)
   07 Customer endpoints

   ENV VARIABLES (Render — never in frontend / never in Git):
   PORT, FRONTEND_URL (comma-separated allowed origins), ADMIN_TOKEN,
   UNLOCK_API_URL, UNLOCK_API_KEY, UNLOCK_API_USERNAME (=Alhassan301),
   optional:
     UNLOCK_FLAT_FEE           (default 2       — USD added to every cost)
     UNLOCK_COMMISSION_SPLIT   (default 0.75,0.25 — SIERRAUNLOCK, Alhassan)
     BINANCE_WEBHOOK_SECRET

   MONEY FLOW (no payment processing here — see founder policy):
     customer pays SIERRAUNLOCK desk first (OM / Binance / cash)
     → founder confirms → /api/order spends wholesale from Alhassan's
       FastUnlockers balance
     → $2 margin splits automatically: 75% SIERRAUNLOCK, 25% Alhassan
     → code/result delivered to customer (via track.html or WhatsApp)

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
  /* ensure default rate is 26 if a legacy file has 22.5 */
  const db = load();
  if (!db.rate || db.rate < 20) { db.rate = DEFAULT_RATE; save(db); }
}

/* 03 • SECURITY + CORS (dual-domain authorized)
   Reads FRONTEND_URL from env. If empty, allows the canonical list of
   origins covering BOTH sierraunlock.com AND sierraunlock.live
   (plus www variants and the Render preview domain). */
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
    if (!origin) return cb(null, true);            /* curl / mobile apps / same-origin */
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

/* 06 • PUBLIC ENDPOINTS */
app.get('/', (req, res) => res.json({ ok: true, service: 'SIERRAUNLOCK API', version: '3.12.0', docs: '/api/health' }));
app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '3.12.0',
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
    status: 'queued', created: new Date().toISOString()
  };
  db.jobs.unshift(job); save(db);
  res.json({ ok: true, job: job.id, status: job.status, note: 'Quote received. Pay via Orange Money / Binance / cash, then we fulfil automatically.' });
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
  svcCache.ts = 0; /* force catalog refresh with new rate */
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

/* 12 • /api/services — PUBLIC catalog (cost HIDDEN from customers)
   Price formula v3.11:
     priceUsd = wholesale_cost + UNLOCK_FLAT_FEE (default 2)
     priceSle = priceUsd  × live rate (default 26)
   Examples with flat fee = $2 and rate = 26:
     cost $0.10  → customer $2.10 → Le 55
     cost $10.00 → customer $12.00 → Le 312
     cost $60.00 → customer $62.00 → Le 1612
   Cached 10 minutes. Customers see ONLY selling price in USD + Leone. */
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
  /* PUBLIC view: cost + commission hidden — business secrets */
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

/* 13c • /api/track/:id — PUBLIC customer tracking endpoint (NEW in v3.12)
   Returns sanitized job data for the customer:
     • job ID, service name, IMEI, created date, status
     • when status = 'solved' → includes the unlock CODE (extracted from upstream)
     • NO wholesale cost, NO admin data, NO raw upstream JSON exposed
   Auto-parses FastUnlockers reply to extract:
     SUCCESS.code / SUCCESS.unlock_code / SUCCESS.message / ERROR.message
   Rate-limited (standard 60/min) — customers can check freely.
   Feeds track.html which auto-refreshes every 10 seconds. */
app.get('/api/track/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id || id.length < 3 || id.length > 60) {
    return res.status(400).json({ ok: false, error: 'Invalid job ID.' });
  }
  const job = load().jobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });

  /* Extract the customer-facing result from upstream JSON */
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

  /* Mask IMEI for privacy: show only first 6 + last 3 digits */
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
  console.log(`SIERRAUNLOCK API v3.12 online on :${PORT} — mode: ${mode}`);
  console.log(`  Policy: cost + $${process.env.UNLOCK_FLAT_FEE || '2'} flat • rate 1 USD = ${load().rate} SLE • split ${(process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25')}`);
  console.log(`  Authorized origins: ${ALLOWED.join(', ')}`);
  console.log(`  Public tracking: /api/track/:id (feeds track.html)`);
});