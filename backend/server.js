/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3.14 • TRIPLE CATALOG + CDR)
   ---------------------------------------------------------------------
   v3.14 FIXES (the File/Server problem):
   • Catalog now syncs ALL THREE upstream lists: IMEI + FILE + SERVER
     (auto-probes the correct action names; merges into one catalog)
   • Every service carries a type: 'imei' | 'file' | 'server'
   • Orders route to the right upstream action by type
   • NEW /api/webhook/cdr — FastUnlockers CDR (Content Delivery Reply)
     pushes results to us automatically = instant code delivery
   • NEW /api/admin/probe — founders see which upstream actions work
   • Keeps: +$2 flat pricing, 26 SLE rate, 75/25 commission, cost privacy,
     refund lock, Binance webhook, dual-domain CORS, track endpoint

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   ===================================================================== */
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

/* 02 • STORAGE (rate default 26 SLE/USD) */
const DEFAULT_RATE = 26.0;
const load = () => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return { jobs: [], rate: DEFAULT_RATE }; } };
const save = (d) => { d.jobs = (d.jobs || []).slice(0, 500); fs.writeFileSync(DATA, JSON.stringify(d, null, 2)); };
if (!fs.existsSync(DATA)) save({ jobs: [], rate: DEFAULT_RATE });
else { const db = load(); if (!db.rate || db.rate < 20) { db.rate = DEFAULT_RATE; save(db); } }

/* 03 • SECURITY + CORS */
app.use(helmet());
const FALLBACK_ORIGINS = [
  'https://sierraunlock.com','https://www.sierraunlock.com','http://sierraunlock.com',
  'https://sierraunlock.live','https://www.sierraunlock.live','http://sierraunlock.live',
  'https://sierraunlock-tech.github.io'
];
const ALLOWED = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s=>s.trim()).filter(Boolean) : FALLBACK_ORIGINS;
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
app.use(rateLimit({ windowMs: 60*1000, max: 60 }));
const strict = rateLimit({ windowMs: 60*1000, max: 6 });

/* 04 • AUTH */
const adminOk = (req) => !!process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;

/* 05 • SCHEMAS (v3.14: type + details) */
const unlockSchema = Joi.object({
  type: Joi.string().valid('imei','file','server').default('imei'),
  imei: Joi.string().trim().allow('').max(15).optional(),
  details: Joi.string().trim().allow('').max(600).optional(),
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
  status: Joi.string().valid('queued','sent-to-server','processing','solved','failed').required()
});
const orderSchema = Joi.object({
  type: Joi.string().valid('imei','file','server').default('imei'),
  service: Joi.alternatives(Joi.string().max(60), Joi.number()).required(),
  imei: Joi.string().trim().allow('').max(15).optional(),
  details: Joi.string().trim().allow('').max(600).optional(),
  brand: Joi.string().trim().max(40).optional(),
  model: Joi.string().trim().max(60).optional(),
  customer: Joi.string().trim().max(60).optional()
});
const adminPaySchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  method: Joi.string().valid('orange_money','binance','cash').required()
});
const adminRefundSchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  reason: Joi.string().trim().min(5).max(500).required()
});

/* 06 • PUBLIC */
app.get('/', (req,res) => res.json({ ok:true, service:'SIERRAUNLOCK API', version:'3.14.0', docs:'/api/health' }));
app.get('/api/health', (req,res) => res.json({
  ok:true, service:'SIERRAUNLOCK API', version:'3.14.0',
  mode: fuReady() ? 'connected-to-fastunlockers' : 'manual-mode',
  catalogs: ['imei','file','server'], rate: load().rate, time: new Date().toISOString()
}));
app.get('/api/rates', (req,res) => res.json({ ok:true, slePerUsd: load().rate }));

/* 06b • MY-IP (founders) */
app.get('/api/my-ip', strict, async (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  try { const r = await fetch('https://api.ipify.org?format=json'); const j = await r.json(); res.json({ ok:true, serverPublicIp:j.ip }); }
  catch (e) { res.status(502).json({ ok:false, error:'ipify unreachable' }); }
});

/* 07 • CUSTOMER ORDER (typed) */
app.post('/api/unlock', strict, async (req,res) => {
  const { error, value } = unlockSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:error.details[0].message });
  const type = value.type || 'imei';
  if (type === 'imei' && !/^\d{15}$/.test(value.imei || '')) {
    return res.status(400).json({ ok:false, error:'IMEI must be exactly 15 digits.' });
  }
  if (type !== 'imei' && (!value.details || value.details.trim().length < 3)) {
    return res.status(400).json({ ok:false, error:'File/Server orders need order details (username / email / notes).' });
  }
  const db = load();
  const job = {
    id:'SU-'+Date.now(), type, imei:value.imei||'', details:value.details||'',
    brand:value.brand, model:value.model, phone:value.phone,
    serviceId:value.serviceId||'', serviceName:value.serviceName||'',
    status:'queued', payment_status:'unpaid', payment_method:null,
    paid_at:null, refunded_at:null, refund_reason:null,
    created:new Date().toISOString()
  };
  db.jobs.unshift(job); save(db);
  res.json({ ok:true, job:job.id, status:job.status, type, note:'Order received. Complete payment to start processing.' });
});
app.post('/api/job-status', strict, (req,res) => {
  const { error, value } = jobStatusSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:'Invalid job id.' });
  const job = load().jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok:false, error:'Job not found.' });
  res.json({ ok:true, job });
});

/* 08 • ADMIN rate/job */
app.post('/api/admin/rate', strict, (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const { error, value } = adminRateSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:'Invalid rate.' });
  const db = load(); db.rate = value.slePerUsd; save(db);
  svcCache.ts = 0;
  res.json({ ok:true, slePerUsd:value.slePerUsd });
});
app.post('/api/admin/job', strict, (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const { error, value } = adminJobSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:'Invalid payload.' });
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok:false, error:'Job not found.' });
  job.status = value.status; save(db);
  res.json({ ok:true, job });
});
app.get('/api/admin/jobs', strict, (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  res.json({ ok:true, jobs: load().jobs });
});

/* 08c • ADMIN PAY = mark paid + AUTO-FULFIL (typed routing) */
app.post('/api/admin/pay', strict, async (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const { error, value } = adminPaySchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:error.details[0].message });
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok:false, error:'Job not found.' });
  if (job.payment_status === 'paid') return res.status(400).json({ ok:false, error:'Job already paid.' });
  job.payment_status = 'paid'; job.payment_method = value.method;
  job.paid_at = new Date().toISOString(); job.status = 'sent-to-server';
  if (!fuReady()) { save(db); return res.json({ ok:true, job:job.id, warning:'Upstream not configured.' }); }
  const up = await placeUpstream(job);
  if (up.ok) { job.upstream = up.r.json; job.upstreamOrderId = up.orderId; }
  else { job.status = 'failed'; job.upstream = up.r.json || up.r.text; }
  save(db);
  res.json({ ok:up.ok, job:job.id, payment_status:job.payment_status, upstreamOrderId:up.orderId, upstream:up.r.json || up.r.text });
});

/* 08d • ADMIN REFUND (founder-only) */
app.post('/api/admin/refund', strict, (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const { error, value } = adminRefundSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:error.details[0].message });
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok:false, error:'Job not found.' });
  if (job.payment_status !== 'paid') return res.status(400).json({ ok:false, error:'Only paid jobs can be refunded.' });
  job.payment_status = 'refunded'; job.refunded_at = new Date().toISOString();
  job.refund_reason = value.reason; job.status = 'failed';
  save(db);
  res.json({ ok:true, job:job.id, payment_status:job.payment_status, refund_reason:job.refund_reason });
});

/* 09 • BINANCE WEBHOOK (auto-pay + auto-fulfil) */
app.post('/api/webhook/binance', express.raw({ type:'*/*' }), async (req,res) => {
  const secret = process.env.BINANCE_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.get('x-binance-signature') || '';
    const hmac = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    let ok = false;
    try { ok = sig.length === hmac.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac)); } catch (e) { ok = false; }
    if (!ok) return res.status(401).json({ ok:false, error:'Bad signature.' });
  }
  let payload = null; try { payload = JSON.parse(req.body.toString()); } catch (e) {}
  if (!payload) return res.status(400).json({ ok:false, error:'Invalid payload.' });
  const note = payload.note || payload.remark || '';
  const m = note.match(/SU-\d+/);
  if (!m) return res.json({ ok:true, received:true, warning:'No job ID in note.' });
  const db = load();
  const job = db.jobs.find(j => j.id === m[0]);
  if (!job || job.payment_status === 'paid') return res.json({ ok:true, received:true });
  job.payment_status = 'paid'; job.payment_method = 'binance';
  job.paid_at = new Date().toISOString(); job.status = 'sent-to-server';
  if (fuReady()) {
    const up = await placeUpstream(job);
    if (up.ok) { job.upstream = up.r.json; job.upstreamOrderId = up.orderId; }
    else { job.status = 'failed'; job.upstream = up.r.json || up.r.text; }
  }
  save(db);
  res.json({ ok:true, received:true, job:job.id, auto_fulfilled:true });
});

/* 09b • CDR WEBHOOK (NEW v3.14) — FastUnlockers pushes results here
   Alhassan sets in his panel: Enable CDR = Yes,
   CDR URL = https://sierraunlock-tech-1-4um3.onrender.com/api/webhook/cdr
   CDR Reply Key = same value as Render env CDR_REPLY_KEY */
app.post('/api/webhook/cdr', express.urlencoded({ extended:true }), (req,res) => {
  const p = req.body || {};
  const key = p.replykey || p.key || p.cdrkey || req.get('x-cdr-key') || '';
  if (process.env.CDR_REPLY_KEY && key !== process.env.CDR_REPLY_KEY) return res.status(401).send('bad key');
  const oid = String(p.orderid || p.id || p.order_id || '');
  const db = load();
  const job = db.jobs.find(j => j.upstreamOrderId && String(j.upstreamOrderId) === oid)
           || db.jobs.find(j => j.id === String(p.jobid || ''));
  if (!job) return res.status(404).send('unknown order');
  const st = String(p.status || p.orderstatus || '').toLowerCase();
  const code = p.code || p.reply || p.result || p.response || null;
  if (code || st.includes('success') || st.includes('solved') || st.includes('complete')) job.status = 'solved';
  else if (st.includes('reject') || st.includes('fail') || st.includes('cancel')) job.status = 'failed';
  if (code) job.cdrCode = String(code);
  job.upstream = p; job.cdrAt = new Date().toISOString();
  save(db);
  res.send('OK');
});

/* 10 • GSM HUB ADAPTER + ACTION MAPS (v3.14 triple catalog) */
const FU = {
  base:(process.env.UNLOCK_API_URL||'').replace(/\/+$/,''),
  key:process.env.UNLOCK_API_KEY||'',
  username:process.env.UNLOCK_API_USERNAME||'',
  endpoint:'/api/dhru'
};
function fuReady(){ return !!(FU.base && FU.key && FU.username); }
async function gsmCall(action, extraParams = {}) {
  if (!fuReady()) throw new Error('Upstream not configured.');
  const params = { username:FU.username, apiaccesskey:FU.key, action };
  Object.keys(extraParams).forEach(k => { if (extraParams[k] != null) params[k] = extraParams[k]; });
  const body = Object.keys(params).map(k => encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(FU.base + FU.endpoint, {
      method:'POST',
      headers:{ 'Accept':'application/json', 'Content-Type':'application/x-www-form-urlencoded' },
      body, signal:ctrl.signal
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { http:r.status, json, text:text.slice(0,600) };
  } catch (e) { return { http:0, json:null, text:'network error: '+e.message }; }
  finally { clearTimeout(t); }
}
const LIST_ACTIONS = {
  imei:   ['imeiservicelist'],
  file:   ['fileservicelist','filelist','fileandservicelist'],
  server: ['serverservicelist','serverlist','creditservicelist']
};
const ORDER_ACTIONS = {
  imei:   ['placeimeiorder'],
  file:   ['placefileorder'],
  server: ['placeserverorder','placecreditorder']
};
const STATUS_ACTIONS = {
  imei:   ['imeiorderstatus'],
  file:   ['fileorderstatus'],
  server: ['serverorderstatus','creditorderstatus']
};
function parseList(raw, type) {
  const listObj = (Array.isArray(raw) && raw[0] && raw[0].LIST) ? raw[0].LIST
                : (raw && raw.LIST ? raw.LIST : (raw && typeof raw === 'object' ? raw : {}));
  const rate = load().rate;
  const flat = parseFloat(process.env.UNLOCK_FLAT_FEE || '2');
  const splitStr = (process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25').split(',');
  const su = Math.max(0, Math.min(1, parseFloat(splitStr[0]) || 0.75));
  const al = Math.max(0, Math.min(1, parseFloat(splitStr[1]) || 0.25));
  const out = [];
  Object.keys(listObj).forEach(gname => {
    const svcs = (listObj[gname] || {}).SERVICES || {};
    Object.keys(svcs).forEach(sid => {
      const s = svcs[sid] || {};
      const credit = parseFloat(s.CREDIT || '0');
      const priceUsd = Math.round((credit + flat) * 100) / 100;
      const profit = priceUsd - credit;
      out.push({
        id:String(s.SERVICEID || sid), name:String(s.SERVICENAME || '').trim(),
        group:String(gname), type,
        costUsd:credit, priceUsd,
        profitUsd:Math.round(profit*100)/100,
        sierraunlockShareUsd:Math.round(profit*su*100)/100,
        alhassanShareUsd:Math.round(profit*al*100)/100,
        priceSle:Math.round(priceUsd*rate),
        time:String(s.TIME || ''), info:String(s.INFO || '')
      });
    });
  });
  return out;
}
async function fetchList(type) {
  for (const action of (LIST_ACTIONS[type] || [])) {
    try {
      const r = await gsmCall(action);
      if (r.http === 200 && r.json && r.json.SUCCESS) return parseList(r.json.SUCCESS, type);
    } catch (e) {}
  }
  return [];
}
async function placeUpstream(job) {
  const type = job.type || 'imei';
  let last = { http:0, json:null, text:'no attempt' };
  for (const action of (ORDER_ACTIONS[type] || ORDER_ACTIONS.imei)) {
    const r = await gsmCall(action, {
      service:String(job.serviceId || job.service),
      imei:job.imei || '', details:job.details || '',
      brand:job.brand || '', model:job.model || '', customer:job.id
    });
    last = r;
    const sb = r.json && r.json.SUCCESS;
    if (r.http === 200 && sb) {
      return { ok:true, r, orderId: sb.orderid || sb.order_id || sb.reference || null };
    }
  }
  return { ok:false, r:last, orderId:null };
}
async function statusUpstream(job) {
  const type = job.type || 'imei';
  for (const action of (STATUS_ACTIONS[type] || STATUS_ACTIONS.imei)) {
    const r = await gsmCall(action, { id:job.upstreamOrderId, orderid:job.upstreamOrderId });
    if (r.http === 200 && r.json) return r.json;
  }
  return null;
}

/* 11 • UPSTREAM TEST + PROBE (founders) */
app.get('/api/upstream-test', strict, async (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const r = await gsmCall('accountinfo');
  res.json({ ok: r.http === 200 && !!(r.json && r.json.SUCCESS), http:r.http, sample:r.json || r.text });
});
app.get('/api/admin/probe', strict, async (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const out = {};
  const cands = ['accountinfo', ...LIST_ACTIONS.imei, ...LIST_ACTIONS.file, ...LIST_ACTIONS.server];
  for (const a of cands) {
    try { const r = await gsmCall(a); out[a] = { http:r.http, ok:!!(r.json && r.json.SUCCESS) }; }
    catch (e) { out[a] = { http:0, ok:false, err:e.message }; }
  }
  res.json({ ok:true, probe:out });
});

/* 12 • PUBLIC CATALOG (imei+file+server merged, cost hidden) */
let svcCache = { ts:0, data:null };
async function fetchCatalog() {
  if (svcCache.data && Date.now() - svcCache.ts < 600000) return svcCache.data;
  const [imei, file, server] = await Promise.all([ fetchList('imei'), fetchList('file'), fetchList('server') ]);
  const services = [...imei, ...file, ...server];
  if (!services.length) return null;
  services.sort((a,b) => a.type.localeCompare(b.type) || a.group.localeCompare(b.group) || Number(a.id) - Number(b.id));
  svcCache = { ts:Date.now(), data:services };
  return services;
}
app.get('/api/services', async (req,res) => {
  if (!fuReady()) return res.json({ ok:false, mode:'manual', services:[] });
  const services = await fetchCatalog();
  if (!services) return res.status(502).json({ ok:false, error:'Upstream services unreachable' });
  const pub = services.map(s => ({ id:s.id, name:s.name, group:s.group, type:s.type, priceUsd:s.priceUsd, priceSle:s.priceSle, time:s.time, info:s.info }));
  res.json({ ok:true, cached:(Date.now()-svcCache.ts) < 600000, count:pub.length, services:pub });
});
app.get('/api/admin/services', strict, async (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  if (!fuReady()) return res.json({ ok:false, mode:'manual', services:[] });
  const services = await fetchCatalog();
  if (!services) return res.status(502).json({ ok:false, error:'Upstream services unreachable' });
  const splitStr = (process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25').split(',');
  res.json({ ok:true, count:services.length,
    policy:{ flatFeeUsd:parseFloat(process.env.UNLOCK_FLAT_FEE||'2'), sierraunlockShare:parseFloat(splitStr[0])||0.75, alhassanShare:parseFloat(splitStr[1])||0.25, rateSlePerUsd:load().rate },
    services });
});

/* 13 • ADMIN MANUAL ORDER (typed) */
app.post('/api/order', strict, async (req,res) => {
  if (!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const { error, value } = orderSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:error.details[0].message });
  if (!fuReady()) return res.status(503).json({ ok:false, error:'Upstream not configured.' });
  const job = {
    id:'SU-'+Date.now(), type:value.type||'imei', imei:value.imei||'', details:value.details||'',
    service:String(value.service), brand:value.brand||'', model:value.model||'', customer:value.customer||'',
    status:'sent-to-server', created:new Date().toISOString()
  };
  const up = await placeUpstream(job);
  if (up.ok) { job.upstream = up.r.json; job.upstreamOrderId = up.orderId; }
  else { job.status = 'failed'; job.upstream = up.r.json || up.r.text; }
  const db = load(); db.jobs.unshift(job); save(db);
  res.json({ ok:up.ok, job:job.id, upstreamOrderId:up.orderId, upstream:up.r.json || up.r.text });
});
app.post('/api/order-status', strict, async (req,res) => {
  const { error, value } = jobStatusSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok:false, error:'Invalid job id.' });
  const job = load().jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok:false, error:'Job not found.' });
  if (fuReady() && job.upstreamOrderId) {
    const live = await statusUpstream(job);
    return res.json({ ok:true, job, live });
  }
  res.json({ ok:true, job });
});

/* 13c • PUBLIC TRACK (cdrCode included) */
app.get('/api/track/:id', async (req,res) => {
  const id = String(req.params.id || '').trim();
  if (!id || id.length < 3 || id.length > 60) return res.status(400).json({ ok:false, error:'Invalid job ID.' });
  const job = load().jobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ ok:false, error:'Job not found.' });
  let code = job.cdrCode || null, message = null, failed = false;
  if (!code && job.upstream && typeof job.upstream === 'object') {
    const s = job.upstream.SUCCESS || job.upstream.success || null;
    const e = job.upstream.ERROR || job.upstream.error || null;
    if (s && typeof s === 'object') { code = s.code || s.unlock_code || s.CODE || null; message = s.message || null; }
    else if (typeof s === 'string') code = s;
    if (e) { failed = true; message = (typeof e === 'object') ? (e.message || JSON.stringify(e)) : e; }
  }
  const maskedImei = job.imei ? job.imei.slice(0,6)+'******'+job.imei.slice(-3) : '';
  res.json({ ok:true, job:{
    id:job.id, type:job.type||'imei', serviceName:job.serviceName||job.service||'—',
    imei:maskedImei, status:job.status, payment_status:job.payment_status||'unpaid',
    failed, code:(job.status==='solved'||code)?(code||message):null, message,
    created:job.created, upstreamOrderId:job.upstreamOrderId||null,
    eta:(job.status==='queued'||job.status==='sent-to-server'||job.status==='processing')?'In progress — auto-refreshing.':null
  }});
});

/* 14 • 404 + BOOT */
app.use((req,res) => res.status(404).json({ ok:false, error:'Not found.' }));
app.use((err, req, res, next) => { console.error('[ERR]', err.message); res.status(err.status||500).json({ ok:false, error:'Server error.' }); });
app.listen(PORT, () => {
  console.log(`SIERRAUNLOCK API v3.14 online on :${PORT} — mode: ${fuReady() ? 'CONNECTED (IMEI+FILE+SERVER)' : 'MANUAL'}`);
  console.log(`  Policy: cost + $${process.env.UNLOCK_FLAT_FEE||'2'} • rate ${load().rate} SLE • split ${process.env.UNLOCK_COMMISSION_SPLIT||'0.75,0.25'}`);
  console.log(`  CDR webhook: /api/webhook/cdr ${process.env.CDR_REPLY_KEY ? '(key set)' : '(no key set)'}`);
});