/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3.20 • FULL AUTOMATION)
   ---------------------------------------------------------------------
   v3.20 FIXES:
   • EmailJS endpoint corrected to /api/v1.0/email/send
   • Upstream order sends parameter ALIASES (service+id+serviceid,
     imei+IMEI) so every DHRU fork accepts it
   • AUTO-RETRY BOT: 3 attempts per upstream placement
   • BINANCE TOP-UP AUTO-APPROVE BOT (TP- id in payment note)
   • Accounts + email verification + wallet + auto-refund + CDR
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
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data.json');
app.set('trust proxy', 1);

/* 02 • STORAGE */
const DEFAULT_RATE = 26.0;
const load = () => {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
  catch (e) { return { jobs: [], wallets: {}, topups: [], users: {}, sessions: {}, rate: DEFAULT_RATE }; }
};
const save = (d) => {
  d.jobs = (d.jobs || []).slice(0, 500);
  d.wallets = d.wallets || {};
  d.topups = (d.topups || []).slice(0, 500);
  d.users = d.users || {};
  d.sessions = d.sessions || {};
  fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
};
if (!fs.existsSync(DATA)) save({ jobs: [], wallets: {}, topups: [], users: {}, sessions: {}, rate: DEFAULT_RATE });
else {
  const db = load();
  if (!db.rate || db.rate < 20) { db.rate = DEFAULT_RATE; save(db); }
}

/* 03 • SECURITY + CORS */
app.use(helmet());
const FALLBACK_ORIGINS = [
  'https://sierraunlock.com', 'https://www.sierraunlock.com', 'http://sierraunlock.com',
  'https://sierraunlock.live', 'https://www.sierraunlock.live', 'http://sierraunlock.live',
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

/* 04 • AUTH */
const adminOk = (req) => !!process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;
const verificationCodes = new Map();

/* 05 • SCHEMAS */
const unlockSchema = Joi.object({
  type: Joi.string().valid('imei', 'file', 'server').default('imei'),
  imei: Joi.string().trim().allow('').max(15).optional(),
  details: Joi.string().trim().allow('').max(2000).optional(),
  brand: Joi.string().trim().min(2).max(40).required(),
  model: Joi.string().trim().min(2).max(60).required(),
  phone: Joi.string().trim().min(9).max(20).required(),
  serviceId: Joi.string().trim().max(20).optional(),
  serviceName: Joi.string().trim().max(120).optional(),
  f_email: Joi.string().trim().max(120).allow('').optional(),
  f_username: Joi.string().trim().max(120).allow('').optional(),
  f_accountid: Joi.string().trim().max(120).allow('').optional(),
  f_quantity: Joi.string().trim().max(10).allow('').optional(),
  f_bulk: Joi.string().trim().max(4000).allow('').optional()
});
const jobStatusSchema = Joi.object({ id: Joi.string().trim().min(3).max(40).required() });
const adminRateSchema = Joi.object({ slePerUsd: Joi.number().positive().max(100000).required() });
const adminJobSchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  status: Joi.string().valid('queued', 'sent-to-server', 'processing', 'solved', 'failed').required()
});
const orderSchema = Joi.object({
  type: Joi.string().valid('imei', 'file', 'server').default('imei'),
  service: Joi.alternatives(Joi.string().max(60), Joi.number()).required(),
  imei: Joi.string().trim().allow('').max(15).optional(),
  details: Joi.string().trim().allow('').max(2000).optional(),
  brand: Joi.string().trim().max(40).optional(),
  model: Joi.string().trim().max(60).optional(),
  customer: Joi.string().trim().max(60).optional()
});
const adminPaySchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  method: Joi.string().valid('orange_money', 'binance', 'cash', 'wallet').required()
});
const adminRefundSchema = Joi.object({
  id: Joi.string().trim().min(3).max(40).required(),
  reason: Joi.string().trim().min(5).max(500).required()
});

/* 06 • PUBLIC HEALTH */
app.get('/', (req, res) => res.json({ ok: true, service: 'SIERRAUNLOCK API', version: '3.20.0', docs: '/api/health' }));
app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '3.20.0',
  mode: fuReady() ? 'connected-to-fastunlockers' : 'manual-mode',
  catalogs: ['imei', 'file', 'server'],
  rate: load().rate,
  time: new Date().toISOString()
}));
app.get('/api/rates', (req, res) => res.json({ ok: true, slePerUsd: load().rate }));

/* 06b • MY-IP */
app.get('/api/my-ip', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    res.json({ ok: true, serverPublicIp: j.ip });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'ipify unreachable' });
  }
});

/* 07 • CUSTOMER ORDER */
app.post('/api/unlock', strict, async (req, res) => {
  const { error, value } = unlockSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  const type = value.type || 'imei';
  if (type === 'imei' && !/^\d{15}$/.test(value.imei || '')) {
    return res.status(400).json({ ok: false, error: 'IMEI must be exactly 15 digits.' });
  }
  if (type !== 'imei' && (!value.details || value.details.trim().length < 3) && !value.f_email) {
    return res.status(400).json({ ok: false, error: 'File/Server orders need email + details.' });
  }
  const db = load();
  const job = {
    id: 'SU-' + Date.now(), type,
    imei: value.imei || '', details: value.details || '',
    f_email: value.f_email || '', f_username: value.f_username || '',
    f_accountid: value.f_accountid || '', f_quantity: value.f_quantity || '',
    f_bulk: value.f_bulk || '',
    brand: value.brand, model: value.model, phone: value.phone,
    serviceId: value.serviceId || '', serviceName: value.serviceName || '',
    status: 'queued', payment_status: 'unpaid', payment_method: null,
    paid_at: null, refunded_at: null, refund_reason: null,
    created: new Date().toISOString()
  };
  db.jobs.unshift(job); save(db);
  res.json({ ok: true, job: job.id, status: job.status, type, note: 'Order received. Complete payment to start processing.' });
});

app.post('/api/job-status', strict, (req, res) => {
  const { error, value } = jobStatusSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: 'Invalid job id.' });
  const job = load().jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  res.json({ ok: true, job });
});

/* 08 • ADMIN rate/job */
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
  job.status = value.status; save(db);
  res.json({ ok: true, job });
});
app.get('/api/admin/jobs', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  res.json({ ok: true, jobs: load().jobs });
});

/* 08c • ADMIN PAY */
app.post('/api/admin/pay', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = adminPaySchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  if (job.payment_status === 'paid') return res.status(400).json({ ok: false, error: 'Job already paid.' });
  job.payment_status = 'paid'; job.payment_method = value.method;
  job.paid_at = new Date().toISOString(); job.status = 'sent-to-server';
  if (!fuReady()) { save(db); return res.json({ ok: true, job: job.id, warning: 'Upstream not configured.' }); }
  const up = await placeUpstream(job);
  if (up.ok) { job.upstream = up.r.json; job.upstreamOrderId = up.orderId; }
  else { job.status = 'failed'; job.upstream = up.r.json || up.r.text; }
  save(db);
  res.json({ ok: up.ok, job: job.id, payment_status: job.payment_status, upstreamOrderId: up.orderId, upstream: up.r.json || up.r.text });
});

/* 08d • ADMIN REFUND */
app.post('/api/admin/refund', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = adminRefundSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  const db = load();
  const job = db.jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  if (job.payment_status !== 'paid') return res.status(400).json({ ok: false, error: 'Only paid jobs can be refunded.' });
  job.payment_status = 'refunded'; job.refunded_at = new Date().toISOString();
  job.refund_reason = value.reason; job.status = 'failed';
  save(db);
  res.json({ ok: true, job: job.id, payment_status: job.payment_status, refund_reason: job.refund_reason });
});

/* 08e • WALLET VIEW */
app.get('/api/wallet/:phone', async (req, res) => {
  const phone = String(req.params.phone || '').replace(/\D/g, '');
  if (phone.length < 9) return res.status(400).json({ ok: false, error: 'Invalid phone.' });
  const db = load();
  const w = (db.wallets || {})[phone] || { balance: 0, tx: [] };
  const pending = (db.topups || []).filter(t => t.phone === phone && t.status === 'pending');
  res.json({ ok: true, balance: w.balance, tx: (w.tx || []).slice(0, 30), pending });
});

/* 08f • WALLET TOP-UP */
app.post('/api/wallet/topup', strict, (req, res) => {
  const b = req.body || {};
  const phone = String(b.phone || '').replace(/\D/g, '');
  const amount = parseFloat(b.amount);
  const method = ['orange_money', 'binance'].includes(b.method) ? b.method : null;
  if (phone.length < 9 || !amount || amount <= 0 || amount > 10000 || !method) {
    return res.status(400).json({ ok: false, error: 'Invalid top-up request.' });
  }
  const db = load(); db.topups = db.topups || [];
  const tp = {
    id: 'TP-' + Date.now(), phone,
    amount: Math.round(amount * 100) / 100,
    method, ref: String(b.ref || ''),
    status: 'pending',
    created: new Date().toISOString()
  };
  db.topups.unshift(tp); save(db);
  res.json({
    ok: true, topup: tp.id,
    pay_to: method === 'orange_money'
      ? 'Orange Money +232 75 908 206 (Alhassan)'
      : 'Binance Pay ID 754378475',
    note: 'Send the amount now, include ref ' + tp.id + '. Binance auto-approves via webhook; Orange Money needs one founder click.'
  });
});

/* 08g • WALLET PAY */
app.post('/api/wallet/pay', strict, async (req, res) => {
  const b = req.body || {};
  const phone = String(b.phone || '').replace(/\D/g, '');
  const db = load(); db.wallets = db.wallets || {};
  const w = db.wallets[phone] = db.wallets[phone] || { balance: 0, tx: [] };

  const services = fuReady() ? await fetchCatalog() : null;
  const svc = (services || []).find(s => s.id === String(b.serviceId));
  if (!svc) return res.status(400).json({ ok: false, error: 'Service not found.' });

  const price = svc.priceUsd;
  if (w.balance < price) {
    return res.status(400).json({
      ok: false,
      error: 'Insufficient balance. Need $' + price + ' — you have $' + w.balance + '. Add Fund first.',
      needed: price, balance: w.balance
    });
  }

  const type = ['imei', 'file', 'server'].includes(b.type) ? b.type : 'imei';
  if (type === 'imei' && !/^\d{15}$/.test(b.imei || '')) {
    return res.status(400).json({ ok: false, error: 'IMEI must be 15 digits.' });
  }
  if (type !== 'imei' && !b.f_email && String(b.details || '').trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'Email/details required for file/server orders.' });
  }

  w.balance = Math.round((w.balance - price) * 100) / 100;

  const job = {
    id: 'SU-' + Date.now(), type,
    imei: b.imei || '', details: b.details || '',
    f_email: b.f_email || '', f_username: b.f_username || '',
    f_accountid: b.f_accountid || '', f_quantity: b.f_quantity || '',
    f_bulk: b.f_bulk || '',
    brand: b.brand || '', model: b.model || '', phone,
    serviceId: svc.id, serviceName: svc.name,
    status: 'sent-to-server',
    payment_status: 'paid', payment_method: 'wallet',
    paid_at: new Date().toISOString(),
    created: new Date().toISOString()
  };

  let autoRefunded = false;
  if (fuReady()) {
    const up = await placeUpstream(job);
    if (up.ok) {
      job.upstream = up.r.json; job.upstreamOrderId = up.orderId;
    } else {
      job.status = 'failed';
      job.upstream = up.r.json || up.r.text;
      w.balance = Math.round((w.balance + price) * 100) / 100;
      w.tx.unshift({ type: 'credit', amount: price, ref: 'AUTO-REFUND ' + job.id, date: new Date().toISOString() });
      autoRefunded = true;
    }
  }

  w.tx.unshift({ type: 'debit', amount: price, ref: job.id, date: new Date().toISOString() });
  db.jobs.unshift(job); save(db);
  res.json({ ok: true, job: job.id, balance: w.balance, status: job.status, auto_refunded: autoRefunded });
});

/* 08h • ADMIN TOP-UPS LIST */
app.get('/api/admin/wallet/topups', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  res.json({ ok: true, topups: (load().topups || []).slice(0, 100) });
});

/* 08i • ADMIN APPROVE TOP-UP */
app.post('/api/admin/wallet/approve', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const id = String((req.body || {}).id || '');
  const db = load(); db.wallets = db.wallets || {}; db.topups = db.topups || [];
  const tp = db.topups.find(t => t.id === id);
  if (!tp) return res.status(404).json({ ok: false, error: 'Top-up not found.' });
  if (tp.status !== 'pending') return res.status(400).json({ ok: false, error: 'Already processed.' });
  tp.status = 'approved'; tp.approvedAt = new Date().toISOString();
  const w = db.wallets[tp.phone] = db.wallets[tp.phone] || { balance: 0, tx: [] };
  w.balance = Math.round((w.balance + tp.amount) * 100) / 100;
  w.tx.unshift({ type: 'credit', amount: tp.amount, ref: tp.id, date: new Date().toISOString() });
  save(db);
  res.json({ ok: true, balance: w.balance, topup: tp.id });
});

/* 08j • ADMIN REJECT TOP-UP */
app.post('/api/admin/wallet/reject', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const id = String((req.body || {}).id || '');
  const db = load(); db.topups = db.topups || [];
  const tp = db.topups.find(t => t.id === id);
  if (!tp || tp.status !== 'pending') return res.status(400).json({ ok: false, error: 'Not found or already processed.' });
  tp.status = 'rejected'; tp.reason = String((req.body || {}).reason || '');
  save(db);
  res.json({ ok: true, topup: tp.id });
});

/* 09 • BINANCE WEBHOOK + TOP-UP AUTO-APPROVE BOT */
app.post('/api/webhook/binance', express.raw({ type: '*/*' }), async (req, res) => {
  const secret = process.env.BINANCE_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.get('x-binance-signature') || '';
    const hmac = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    let ok = false;
    try { ok = sig.length === hmac.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac)); } catch (e) { ok = false; }
    if (!ok) return res.status(401).json({ ok: false, error: 'Bad signature.' });
  }
  let payload = null; try { payload = JSON.parse(req.body.toString()); } catch (e) {}
  if (!payload) return res.status(400).json({ ok: false, error: 'Invalid payload.' });
  const note = payload.note || payload.remark || '';

  const mt = note.match(/TP-\d+/);
  if (mt) {
    const db0 = load(); db0.topups = db0.topups || []; db0.wallets = db0.wallets || {};
    const tp = db0.topups.find(t => t.id === mt[0] && t.status === 'pending');
    if (tp) {
      tp.status = 'approved'; tp.approvedAt = new Date().toISOString(); tp.auto = 'binance-webhook-bot';
      const w = db0.wallets[tp.phone] = db0.wallets[tp.phone] || { balance: 0, tx: [] };
      w.balance = Math.round((w.balance + tp.amount) * 100) / 100;
      w.tx.unshift({ type: 'credit', amount: tp.amount, ref: tp.id + ' (auto-bot)', date: new Date().toISOString() });
      save(db0);
      return res.json({ ok: true, received: true, topup: tp.id, auto_approved: true });
    }
  }

  const m = note.match(/SU-\d+/);
  if (!m) return res.json({ ok: true, received: true, warning: 'No job ID in note.' });
  const db = load();
  const job = db.jobs.find(j => j.id === m[0]);
  if (!job || job.payment_status === 'paid') return res.json({ ok: true, received: true });
  job.payment_status = 'paid'; job.payment_method = 'binance';
  job.paid_at = new Date().toISOString(); job.status = 'sent-to-server';
  if (fuReady()) {
    const up = await placeUpstream(job);
    if (up.ok) { job.upstream = up.r.json; job.upstreamOrderId = up.orderId; }
    else { job.status = 'failed'; job.upstream = up.r.json || up.r.text; }
  }
  save(db);
  res.json({ ok: true, received: true, job: job.id, auto_fulfilled: true });
});

/* 09b • CDR WEBHOOK */
app.post('/api/webhook/cdr', express.urlencoded({ extended: true }), (req, res) => {
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

/* 10 • GSM HUB ADAPTER */
const FU = {
  base: (process.env.UNLOCK_API_URL || '').replace(/\/+$/, ''),
  key: process.env.UNLOCK_API_KEY || '',
  username: process.env.UNLOCK_API_USERNAME || '',
  endpoint: '/api/dhru'
};
function fuReady() { return !!(FU.base && FU.key && FU.username); }

async function gsmCall(action, extraParams = {}) {
  if (!fuReady()) throw new Error('Upstream not configured.');
  const params = { username: FU.username, apiaccesskey: FU.key, action };
  Object.keys(extraParams).forEach(k => {
    const v = extraParams[k];
    if (v !== undefined && v !== null && v !== '') params[k] = v;
  });
  const body = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(FU.base + FU.endpoint, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body, signal: ctrl.signal
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { http: r.status, json, text: text.slice(0, 600) };
  } catch (e) {
    return { http: 0, json: null, text: 'network error: ' + e.message };
  } finally { clearTimeout(t); }
}

const LIST_ACTIONS = {
  imei: ['imeiservicelist'],
  file: ['fileservicelist', 'filelist', 'fileandservicelist', 'servicelistfile'],
  server: [
    'serverservicelist', 'serverlist', 'creditservicelist',
    'servicelistserver', 'serverandservicelist',
    'chimeralist', 'chimera',
    'octopluslist', 'octoplus',
    'umtlist', 'umt', 'ultimatemultitool',
    'dcunlockerlist', 'dcunlocker', 'dchculist',
    'avengerslist', 'avengers',
    'ncklist', 'nckbox',
    'infinitylist', 'infinity', 'infinitybox',
    'unlocktoollist', 'unlocktool', 'utlist',
    'pandoralist', 'pandora',
    'tsmlist', 'tsmtool',
    'cheetahlist', 'cheetah',
    'borneolist', 'borneo',
    'gsmserverlist', 'gsmserver'
  ]
};
const ORDER_ACTIONS = {
  imei: ['placeimeiorder'],
  file: ['placefileorder'],
  server: ['placeserverorder', 'placecreditorder']
};
const STATUS_ACTIONS = {
  imei: ['imeiorderstatus'],
  file: ['fileorderstatus'],
  server: ['serverorderstatus', 'creditorderstatus']
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
        id: String(s.SERVICEID || sid),
        name: String(s.SERVICENAME || '').trim(),
        group: String(gname), type,
        costUsd: credit, priceUsd,
        profitUsd: Math.round(profit * 100) / 100,
        sierraunlockShareUsd: Math.round(profit * su * 100) / 100,
        alhassanShareUsd: Math.round(profit * al * 100) / 100,
        priceSle: Math.round(priceUsd * rate),
        time: String(s.TIME || ''),
        info: String(s.INFO || '')
      });
    });
  });
  return out;
}

async function fetchList(type) {
  const merged = [];
  const seen = {};
  for (const action of (LIST_ACTIONS[type] || [])) {
    try {
      const r = await gsmCall(action);
      if (r.http === 200 && r.json && r.json.SUCCESS) {
        parseList(r.json.SUCCESS, type).forEach(s => {
          const k = s.type + ':' + s.id;
          if (!seen[k]) { seen[k] = 1; merged.push(s); }
        });
      }
    } catch (e) { /* try next action */ }
  }
  return merged;
}

async function placeUpstreamOnce(job) {
  const type = job.type || 'imei';
  let last = { http: 0, json: null, text: 'no attempt' };
  for (const action of (ORDER_ACTIONS[type] || ORDER_ACTIONS.imei)) {
    const sid = String(job.serviceId || job.service);
    const r = await gsmCall(action, {
      service: sid, id: sid, serviceid: sid,
      imei: job.imei || '', IMEI: job.imei || '',
      details: job.details || '',
      email: job.f_email || '',
      accountid: job.f_accountid || '',
      quantity: job.f_quantity || '',
      bulkimei: job.f_bulk || '',
      brand: job.brand || '',
      model: job.model || '',
      customer: job.id
    });
    last = r;
    const sb = r.json && r.json.SUCCESS;
    if (r.http === 200 && sb) {
      return { ok: true, r, orderId: sb.orderid || sb.order_id || sb.reference || null };
    }
  }
  return { ok: false, r: last, orderId: null };
}

async function placeUpstream(job) {
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = await placeUpstreamOnce(job);
    if (last.ok) return last;
    const msg = JSON.stringify((last.r && last.r.json) || (last.r && last.r.text) || '');
    if (/Required|Invalid|Not enough|balance|Denied/i.test(msg)) break;
    if (attempt < 3) await new Promise(wait => setTimeout(wait, 2000));
  }
  return last;
}

async function statusUpstream(job) {
  const type = job.type || 'imei';
  for (const action of (STATUS_ACTIONS[type] || STATUS_ACTIONS.imei)) {
    const r = await gsmCall(action, { id: job.upstreamOrderId, orderid: job.upstreamOrderId, order_id: job.upstreamOrderId });
    if (r.http === 200 && r.json) return r.json;
  }
  return null;
}

/* 11 • UPSTREAM TEST + PROBE */
app.get('/api/upstream-test', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const r = await gsmCall('accountinfo');
  res.json({ ok: r.http === 200 && !!(r.json && r.json.SUCCESS), http: r.http, sample: r.json || r.text });
});
app.get('/api/admin/probe', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const out = {};
  const cands = ['accountinfo', ...LIST_ACTIONS.imei, ...LIST_ACTIONS.file, ...LIST_ACTIONS.server];
  for (const a of cands) {
    try { const r = await gsmCall(a); out[a] = { http: r.http, ok: !!(r.json && r.json.SUCCESS) }; }
    catch (e) { out[a] = { http: 0, ok: false, err: e.message }; }
  }
  res.json({ ok: true, probe: out });
});

/* 12 • CATALOG */
let svcCache = { ts: 0, data: null };

app.post('/api/admin/refresh-catalog', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  svcCache.ts = 0;
  res.json({ ok: true, note: 'Catalog cache cleared. Next /api/services call will re-fetch from FastUnlockers.' });
});

app.get('/api/admin/debug-catalog', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  svcCache.ts = 0;
  const services = await fetchCatalog();
  if (!services) return res.json({ ok: false, error: 'No services returned' });
  const groups = {};
  const types = { imei: 0, file: 0, server: 0 };
  services.forEach(s => {
    groups[s.group] = (groups[s.group] || 0) + 1;
    types[s.type] = (types[s.type] || 0) + 1;
  });
  res.json({
    ok: true,
    total: services.length,
    byType: types,
    byGroup: groups,
    sampleChimera: services.filter(s => /chimera/i.test(s.name + ' ' + s.group)).slice(0, 3),
    sampleOctoplus: services.filter(s => /octoplus/i.test(s.name + ' ' + s.group)).slice(0, 3),
    sampleUMT: services.filter(s => /umt|ultimate/i.test(s.name + ' ' + s.group)).slice(0, 3)
  });
});

async function fetchCatalog() {
  if (svcCache.data && Date.now() - svcCache.ts < 600000) return svcCache.data;
  const [imei, file, server] = await Promise.all([fetchList('imei'), fetchList('file'), fetchList('server')]);
  const services = [...imei, ...file, ...server];
  if (!services.length) return null;
  services.sort((a, b) => a.type.localeCompare(b.type) || a.group.localeCompare(b.group) || Number(a.id) - Number(b.id));
  svcCache = { ts: Date.now(), data: services };
  return services;
}

app.get('/api/services', async (req, res) => {
  if (!fuReady()) return res.json({ ok: false, mode: 'manual', services: [] });
  const services = await fetchCatalog();
  if (!services) return res.status(502).json({ ok: false, error: 'Upstream services unreachable' });
  const pub = services.map(s => ({
    id: s.id, name: s.name, group: s.group, type: s.type,
    priceUsd: s.priceUsd, priceSle: s.priceSle, time: s.time, info: s.info
  }));
  res.json({ ok: true, cached: (Date.now() - svcCache.ts) < 600000, count: pub.length, services: pub });
});

app.get('/api/admin/services', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  if (!fuReady()) return res.json({ ok: false, mode: 'manual', services: [] });
  const services = await fetchCatalog();
  if (!services) return res.status(502).json({ ok: false, error: 'Upstream services unreachable' });
  const splitStr = (process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25').split(',');
  res.json({
    ok: true, count: services.length,
    policy: {
      flatFeeUsd: parseFloat(process.env.UNLOCK_FLAT_FEE || '2'),
      sierraunlockShare: parseFloat(splitStr[0]) || 0.75,
      alhassanShare: parseFloat(splitStr[1]) || 0.25,
      rateSlePerUsd: load().rate
    },
    services
  });
});

/* 13 • ADMIN MANUAL ORDER */
app.post('/api/order', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { error, value } = orderSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: error.details[0].message });
  if (!fuReady()) return res.status(503).json({ ok: false, error: 'Upstream not configured.' });
  const job = {
    id: 'SU-' + Date.now(), type: value.type || 'imei',
    imei: value.imei || '', details: value.details || '',
    service: String(value.service),
    brand: value.brand || '', model: value.model || '', customer: value.customer || '',
    status: 'sent-to-server',
    payment_status: 'paid', payment_method: 'manual',
    paid_at: new Date().toISOString(),
    created: new Date().toISOString()
  };
  const up = await placeUpstream(job);
  if (up.ok) { job.upstream = up.r.json; job.upstreamOrderId = up.orderId; }
  else { job.status = 'failed'; job.upstream = up.r.json || up.r.text; }
  const db = load(); db.jobs.unshift(job); save(db);
  res.json({ ok: up.ok, job: job.id, upstreamOrderId: up.orderId, upstream: up.r.json || up.r.text });
});

app.post('/api/order-status', strict, async (req, res) => {
  const { error, value } = jobStatusSchema.validate(req.body || {});
  if (error) return res.status(400).json({ ok: false, error: 'Invalid job id.' });
  const job = load().jobs.find(j => j.id === value.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  if (fuReady() && job.upstreamOrderId) {
    const live = await statusUpstream(job);
    return res.json({ ok: true, job, live });
  }
  res.json({ ok: true, job });
});

/* 13b • ADMIN RETRY */
app.post('/api/admin/retry', strict, async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const id = String((req.body || {}).id || '');
  const db = load();
  const job = db.jobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  if (!fuReady()) return res.status(503).json({ ok: false, error: 'Upstream not configured.' });
  const up = await placeUpstream(job);
  if (up.ok) {
    job.status = 'sent-to-server';
    job.upstream = up.r.json;
    job.upstreamOrderId = up.orderId;
  } else {
    job.status = 'failed';
    job.upstream = up.r.json || up.r.text;
  }
  save(db);
  res.json({ ok: up.ok, job: job.id, upstreamOrderId: up.orderId, upstream: up.r.json || up.r.text });
});

/* 13c • PUBLIC TRACK */
app.get('/api/track/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id || id.length < 3 || id.length > 60) return res.status(400).json({ ok: false, error: 'Invalid job ID.' });
  const job = load().jobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  let code = job.cdrCode || null, message = null, failed = false;
  if (!code && job.upstream && typeof job.upstream === 'object') {
    const s = job.upstream.SUCCESS || job.upstream.success || null;
    const e = job.upstream.ERROR || job.upstream.error || null;
    if (s && typeof s === 'object') {
      code = s.code || s.unlock_code || s.CODE || null;
      message = s.message || null;
    } else if (typeof s === 'string') code = s;
    if (e) {
      failed = true;
      message = (typeof e === 'object') ? (e.message || JSON.stringify(e)) : e;
    }
  }
  const maskedImei = job.imei ? job.imei.slice(0, 6) + '******' + job.imei.slice(-3) : '';
  res.json({
    ok: true,
    job: {
      id: job.id, type: job.type || 'imei',
      serviceName: job.serviceName || job.service || '—',
      imei: maskedImei, status: job.status,
      payment_status: job.payment_status || 'unpaid',
      failed, code: (job.status === 'solved' || code) ? (code || message) : null, message,
      created: job.created, upstreamOrderId: job.upstreamOrderId || null,
      eta: (job.status === 'queued' || job.status === 'sent-to-server' || job.status === 'processing')
        ? 'In progress — auto-refreshing.' : null
    }
  });
});

/* 13d • AUTH ENDPOINTS (EmailJS verified) */
const EMAILJS = {
  service: process.env.EMAILJS_SERVICE_ID || '',
  template: process.env.EMAILJS_TEMPLATE_ID || '',
  public: process.env.EMAILJS_PUBLIC_KEY || '',
  private: process.env.EMAILJS_PRIVATE_KEY || ''
};
const emailReady = () => !!(EMAILJS.service && EMAILJS.template && EMAILJS.private);

async function sendVerificationEmail(toEmail, toName, code) {
  if (!emailReady()) return { ok: false, error: 'EmailJS not configured' };
  try {
    const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS.service,
        template_id: EMAILJS.template,
        user_id: EMAILJS.public,
        accessToken: EMAILJS.private,
        template_params: { to_email: toEmail, to_name: toName, code }
      })
    });
    let detail = '';
    try { detail = (await r.text()).slice(0, 200); } catch (e) {}
    return { ok: r.ok, status: r.status, detail };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

app.post('/api/auth/register', strict, async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  const p = String(phone || '').replace(/\D/g, '');
  if (!name || name.length < 2) return res.status(400).json({ ok: false, error: 'Name required (min 2 chars).' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok: false, error: 'Invalid email.' });
  if (p.length < 9) return res.status(400).json({ ok: false, error: 'Invalid phone.' });
  if (!password || password.length < 6) return res.status(400).json({ ok: false, error: 'Password min 6 chars.' });
  const db = load();
  db.users = db.users || {};
  if (db.users[p]) return res.status(400).json({ ok: false, error: 'This phone number is already registered. Please sign in.' });
  const emailTaken = Object.values(db.users).some(u => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (emailTaken) return res.status(400).json({ ok: false, error: 'This email is already used by another account.' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  verificationCodes.set(p, { code, expires: Date.now() + 600000, email, name, password });
  const sent = await sendVerificationEmail(email, name, code);
  if (!sent.ok) {
    verificationCodes.delete(p);
    return res.status(500).json({ ok: false, error: 'Could not send email. Try again. ' + (sent.error || sent.detail || '') });
  }
  res.json({ ok: true, phone: p, note: 'Verification code sent to ' + email });
});

app.post('/api/auth/verify', strict, (req, res) => {
  const { phone, code } = req.body || {};
  const p = String(phone || '').replace(/\D/g, '');
  const rec = verificationCodes.get(p);
  if (!rec) return res.status(400).json({ ok: false, error: 'No pending verification. Please register again.' });
  if (Date.now() > rec.expires) { verificationCodes.delete(p); return res.status(400).json({ ok: false, error: 'Code expired. Please register again.' }); }
  if (rec.code !== String(code).trim()) return res.status(400).json({ ok: false, error: 'Wrong code. Try again.' });
  const db = load(); db.users = db.users || {};
  const hash = bcrypt.hashSync(rec.password, 10);
  db.users[p] = {
    phone: p, email: rec.email, name: rec.name, passwordHash: hash,
    verified: true, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString()
  };
  verificationCodes.delete(p);
  const token = 'u-' + p + '-' + Date.now();
  db.sessions = db.sessions || {};
  db.sessions[token] = { phone: p, created: new Date().toISOString() };
  save(db);
  res.json({ ok: true, token, user: { phone: p, email: rec.email, name: rec.name } });
});

app.post('/api/auth/login', strict, (req, res) => {
  const { emailOrPhone, password } = req.body || {};
  const p = String(emailOrPhone || '').replace(/\D/g, '');
  const db = load(); db.users = db.users || {};
  let user = null, phone = null;
  if (/^\d{9,}$/.test(p)) { user = db.users[p]; phone = p; }
  else {
    const entry = Object.entries(db.users).find(([k, u]) => u.email && u.email.toLowerCase() === String(emailOrPhone).toLowerCase());
    if (entry) { phone = entry[0]; user = entry[1]; }
  }
  if (!user) return res.status(401).json({ ok: false, error: 'Account not found. Please register.' });
  if (!bcrypt.compareSync(password || '', user.passwordHash)) return res.status(401).json({ ok: false, error: 'Wrong password.' });
  user.lastLogin = new Date().toISOString();
  db.sessions = db.sessions || {};
  const token = 'u-' + phone + '-' + Date.now();
  db.sessions[token] = { phone, created: new Date().toISOString() };
  save(db);
  res.json({ ok: true, token, user: { phone, email: user.email, name: user.name } });
});

app.get('/api/auth/me', strict, (req, res) => {
  const token = req.get('x-user-token');
  if (!token) return res.status(401).json({ ok: false, error: 'Not logged in.' });
  const db = load(); db.sessions = db.sessions || {};
  const s = db.sessions[token];
  if (!s) return res.status(401).json({ ok: false, error: 'Session expired. Please log in again.' });
  db.users = db.users || {};
  const user = db.users[s.phone];
  if (!user) return res.status(401).json({ ok: false, error: 'Account missing.' });
  const w = (db.wallets || {})[s.phone] || { balance: 0, tx: [] };
  const myJobs = (db.jobs || []).filter(j => (j.phone || '').replace(/\D/g, '') === s.phone).slice(0, 100);
  res.json({
    ok: true,
    user: { phone: user.phone, email: user.email, name: user.name, createdAt: user.createdAt, lastLogin: user.lastLogin },
    wallet: { balance: w.balance, tx: (w.tx || []).slice(0, 20) },
    orders: myJobs
  });
});

app.post('/api/auth/logout', strict, (req, res) => {
  const token = req.get('x-user-token');
  if (token) { const db = load(); db.sessions = db.sessions || {}; delete db.sessions[token]; save(db); }
  res.json({ ok: true });
});

app.post('/api/auth/resend', strict, async (req, res) => {
  const { phone } = req.body || {};
  const p = String(phone || '').replace(/\D/g, '');
  const rec = verificationCodes.get(p);
  if (!rec) return res.status(400).json({ ok: false, error: 'No pending verification. Please register again.' });
  rec.code = String(Math.floor(100000 + Math.random() * 900000));
  rec.expires = Date.now() + 600000;
  verificationCodes.set(p, rec);
  const sent = await sendVerificationEmail(rec.email, rec.name, rec.code);
  res.json(sent.ok ? { ok: true, note: 'New code sent to ' + rec.email } : { ok: false, error: 'Email send failed. ' + (sent.detail || '') });
});

/* ===== v3.21 PACK 15: PASSWORD RESET + FOUNDER ACCOUNT MANAGEMENT ===== */
const resetCodes = new Map(); /* phone -> { code, expires } */

/* Customer: request password-reset code (email sent via EmailJS) */
app.post('/api/auth/forgot', strict, async (req, res) => {
  const { emailOrPhone } = req.body || {};
  const p = String(emailOrPhone || '').replace(/\D/g, '');
  const db = load(); db.users = db.users || {};
  let user = null, phone = null;
  if (/^\d{9,}$/.test(p)) { user = db.users[p]; phone = p; }
  else {
    const entry = Object.entries(db.users).find(([k, u]) => u.email && u.email.toLowerCase() === String(emailOrPhone).toLowerCase());
    if (entry) { phone = entry[0]; user = entry[1]; }
  }
  if (user && phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(phone, { code, expires: Date.now() + 600000 });
    await sendVerificationEmail(user.email, user.name, code);
  }
  res.json({ ok: true, note: 'If that account exists, a 6-digit reset code was sent to its email.' });
});

/* Customer: set new password with the reset code */
app.post('/api/auth/reset', strict, (req, res) => {
  const { emailOrPhone, code, newPassword } = req.body || {};
  const p = String(emailOrPhone || '').replace(/\D/g, '');
  const db = load(); db.users = db.users || {};
  let phone = null;
  if (/^\d{9,}$/.test(p) && db.users[p]) phone = p;
  else {
    const entry = Object.entries(db.users).find(([k, u]) => u.email && u.email.toLowerCase() === String(emailOrPhone).toLowerCase());
    if (entry) phone = entry[0];
  }
  if (!phone) return res.status(400).json({ ok: false, error: 'Account not found.' });
  const rec = resetCodes.get(phone);
  if (!rec) return res.status(400).json({ ok: false, error: 'No reset requested. Click Forgot Password first.' });
  if (Date.now() > rec.expires) { resetCodes.delete(phone); return res.status(400).json({ ok: false, error: 'Code expired. Request a new one.' }); }
  if (rec.code !== String(code).trim()) return res.status(400).json({ ok: false, error: 'Wrong code.' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ ok: false, error: 'New password min 6 chars.' });
  db.users[phone].passwordHash = bcrypt.hashSync(newPassword, 10);
  resetCodes.delete(phone);
  db.sessions = db.sessions || {};
  Object.keys(db.sessions).forEach(t => { if (db.sessions[t].phone === phone) delete db.sessions[t]; });
  save(db);
  res.json({ ok: true, note: 'Password changed. Sign in with your new password.' });
});

/* Founder: list all customers (passwords never exposed) */
app.get('/api/admin/users', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const db = load(); db.users = db.users || {};
  const list = Object.values(db.users).map(u => ({
    phone: u.phone, email: u.email, name: u.name,
    createdAt: u.createdAt, lastLogin: u.lastLogin,
    balance: ((db.wallets || {})[u.phone] || {}).balance || 0,
    orders: (db.jobs || []).filter(j => (j.phone || '').replace(/\D/g, '') === u.phone).length
  }));
  res.json({ ok: true, count: list.length, users: list });
});

/* Founder: delete account (wallet + order records kept for accounting) */
app.post('/api/admin/user/delete', strict, (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const { phone, reason } = req.body || {};
  const p = String(phone || '').replace(/\D/g, '');
  if (!p) return res.status(400).json({ ok: false, error: 'Phone required.' });
  const db = load(); db.users = db.users || {};
  if (!db.users[p]) return res.status(404).json({ ok: false, error: 'Account not found.' });
  const deleted = db.users[p];
  delete db.users[p];
  db.sessions = db.sessions || {};
  Object.keys(db.sessions).forEach(t => { if (db.sessions[t].phone === p) delete db.sessions[t]; });
  db.adminLog = db.adminLog || [];
  db.adminLog.unshift({ action: 'user-delete', phone: p, email: deleted.email, reason: String(reason || ''), at: new Date().toISOString() });
  db.adminLog = db.adminLog.slice(0, 200);
  save(db);
  res.json({ ok: true, note: 'Account deleted. Wallet/order records kept for accounting.' });
});

/* 14 • 404 + BOOT */
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error('[ERR]', err.message);
  res.status(err.status || 500).json({ ok: false, error: 'Server error.' });
});
app.listen(PORT, () => {
  console.log(`SIERRAUNLOCK API v3.20 online on :${PORT} — mode: ${fuReady() ? 'CONNECTED (IMEI+FILE+SERVER+CHIMERA UNION)' : 'MANUAL'}`);
  console.log(`  Policy: cost + $${process.env.UNLOCK_FLAT_FEE || '2'} • rate ${load().rate} SLE • split ${process.env.UNLOCK_COMMISSION_SPLIT || '0.75,0.25'}`);
  console.log(`  CDR webhook: /api/webhook/cdr ${process.env.CDR_REPLY_KEY ? '(key set)' : '(no key set)'}`);
  console.log(`  Bots: auto-retry x3 upstream + Binance top-up auto-approve`);
  console.log(`  Auth: EmailJS ${emailReady() ? 'ready' : 'NOT CONFIGURED'}`);
});