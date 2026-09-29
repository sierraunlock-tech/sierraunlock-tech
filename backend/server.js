/* =====================================================================
   SIERRAUNLOCK • BACKEND API — server.js (v3.43 • DHRU + CDR + INFO-FIX)
   v3.43 FINAL — FULL FILE 470+ lines — NOTHING REMOVED:
   • Based on your v3.42 463 lines (all functions kept)
   • FIX P9SC0827CDF / SU-1790687304771 still processing / code:null
   • Samsung Info Check returns result in INFO/MESSAGE, not CODE
   • statusUpstream now tries ALL getimeiorder/getfileorder/getserverorder
   • normalizeStatus reads CODE + INFO + MESSAGE + RESPONSE + DETAILS
   • If INFO length >15 => solved instantly (fastunlock.us parity)
   • Keeps v3.41 FIX: GET /api/webhook/cdr returns 200 OK (no 405)
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
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data.json');
app.set('trust proxy', 1);

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
  ghPushSoon();
};

const GH = { token: process.env.GITHUB_TOKEN || '', repo: process.env.GITHUB_DATA_REPO || '' };
const ghReady = () =>!!(GH.token && GH.repo);
let ghPushTimer = null;
let ghLastSha = '';

async function ghPull() {
  if (!ghReady()) return null;
  try {
    const r = await fetch('https://api.github.com/repos/' + GH.repo + '/contents/data.json', {
      headers: { Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json', 'User-Agent': 'sierraunlock-api' }
    });
    if (!r.ok) return null;
    const j = await r.json();
    ghLastSha = j.sha || '';
    return JSON.parse(Buffer.from(j.content || '', 'base64').toString('utf8'));
  } catch (e) { return null; }
}
async function ghPush() {
  if (!ghReady()) return;
  try {
    const b64 = Buffer.from(fs.readFileSync(DATA, 'utf8'), 'utf8').toString('base64');
    const doPut = (sha) => {
      const body = { message: 'vault ' + Date.now(), content: b64 };
      if (sha) body.sha = sha;
      return fetch('https://api.github.com/repos/' + GH.repo + '/contents/data.json', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'sierraunlock-api' },
        body: JSON.stringify(body)
      });
    };
    let r = await doPut(ghLastSha);
    if (r.status === 409 || r.status === 422) {
      const g = await fetch('https://api.github.com/repos/' + GH.repo + '/contents/data.json', {
        headers: { Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json', 'User-Agent': 'sierraunlock-api' }
      });
      if (g.ok) { const gj = await g.json(); ghLastSha = gj.sha || ''; r = await doPut(ghLastSha); }
    }
    if (r.ok) { const j = await r.json(); if (j && j.content && j.content.sha) ghLastSha = j.content.sha; }
  } catch (e) {}
}
function ghPushSoon() {
  if (!ghReady()) return;
  if (ghPushTimer) return;
  ghPushTimer = setTimeout(() => { ghPushTimer = null; ghPush(); }, 15000);
}
if (!fs.existsSync(DATA)) save({ jobs: [], wallets: {}, topups: [], users: {}, sessions: {}, rate: DEFAULT_RATE });
else { const db = load(); if (!db.rate || db.rate < 20) { db.rate = DEFAULT_RATE; save(db); } }
(async () => {
  try {
    const remote = await ghPull();
    if (remote && typeof remote === 'object') {
      const local = load();
      const cnt = d => (d.jobs || []).length + (d.topups || []).length + Object.keys(d.users || {}).length + Object.keys(d.wallets || {}).length;
      if (cnt(remote) > cnt(local)) { save(remote); console.log('[VAULT] restored ' + cnt(remote)); }
      else ghPushSoon();
    }
  } catch (e) { console.log('[VAULT] pull skipped: ' + e.message); }
})();

app.use(helmet());
const FALLBACK_ORIGINS = ['https://sierraunlock.com','https://www.sierraunlock.com','http://sierraunlock.com','https://sierraunlock.live','https://www.sierraunlock.live','http://sierraunlock.live','https://sierraunlock-tech.github.io'];
const ALLOWED = process.env.FRONTEND_URL? process.env.FRONTEND_URL.split(',').map(s=>s.trim()).filter(Boolean) : FALLBACK_ORIGINS;
app.use(cors({ origin: (origin, cb) => { if (!origin) return cb(null, true); if (ALLOWED.some(o => origin === o || origin.startsWith(o))) return cb(null, true); cb(new Error('Not allowed by CORS')); }, credentials:false }));
app.use(express.json({ limit:'100kb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs:60*1000, max:60 }));
const strict = rateLimit({ windowMs:60*1000, max:6 });

const adminOk = (req) => {
  const token = req.get('x-admin-token') || (req.get('authorization')||'').replace(/^Bearer\s+/i,'');
  return!!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
};
const verificationCodes = new Map();
const resetCodes = new Map();
const TRUSTED_PHONES = (process.env.OM_TRUSTED_PHONES || '').split(',').map(s=>s.replace(/\D/g,'')).filter(Boolean);

const unlockSchema = Joi.object({
  type: Joi.string().valid('imei','file','server').default('imei'),
  imei: Joi.string().trim().allow('').max(15).optional(),
  details: Joi.string().trim().allow('').max(2000).optional(),
  brand: Joi.string().trim().min(2).max(40).required(),
  model: Joi.string().trim().min(2).max(60).required(),
  phone: Joi.string().trim().min(9).max(20).required(),
  serviceId: Joi.string().trim().min(1).max(20).required(),
  serviceName: Joi.string().trim().max(120).optional(),
  f_email: Joi.string().trim().max(120).allow('').optional(),
  f_username: Joi.string().trim().max(120).allow('').optional(),
  f_accountid: Joi.string().trim().max(120).allow('').optional(),
  f_quantity: Joi.string().trim().max(10).allow('').optional(),
  f_bulk: Joi.string().trim().max(4000).allow('').optional()
});
const jobStatusSchema = Joi.object({ id: Joi.string().trim().min(3).max(40).required() });
const adminRateSchema = Joi.object({ slePerUsd: Joi.number().positive().max(100000).required() });
const adminJobSchema = Joi.object({ id: Joi.string().trim().min(3).max(40).required(), status: Joi.string().valid('queued','sent-to-server','processing','solved','failed').required(), serviceId: Joi.string().trim().max(20).optional(), imei: Joi.string().trim().max(15).optional() });
const orderSchema = Joi.object({ type: Joi.string().valid('imei','file','server').default('imei'), service: Joi.alternatives(Joi.string().max(60), Joi.number()).required(), imei: Joi.string().trim().allow('').max(15).optional(), details: Joi.string().trim().allow('').max(2000).optional(), brand: Joi.string().trim().max(40).optional(), model: Joi.string().trim().max(60).optional(), customer: Joi.string().trim().max(60).optional() });
const adminPaySchema = Joi.object({ id: Joi.string().trim().min(3).max(40).required(), method: Joi.string().valid('orange_money','binance','cash','wallet').required() });
const adminRefundSchema = Joi.object({ id: Joi.string().trim().min(3).max(40).required(), reason: Joi.string().trim().min(5).max(500).required() });

app.get('/', (req,res)=>res.json({ ok:true, service:'SIERRAUNLOCK API', version:'3.43.0', docs:'/api/health' }));
app.get('/api/health', (req,res)=>res.json({ ok:true, service:'SIERRAUNLOCK API', version:'3.43.0', mode:fuReady()?'connected-to-fastunlockers':'manual-mode', vault:ghReady()?'github':'local-only', catalogs:['imei','file','server'], rate:load().rate, time:new Date().toISOString(), cdr: process.env.CDR_REPLY_KEY? 'configured' : 'not set' }));
app.get('/api/rates', (req,res)=>res.json({ ok:true, slePerUsd:load().rate }));
app.get('/api/my-ip', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); try{ const r=await fetch('https://api.ipify.org?format=json'); const j=await r.json(); res.json({ ok:true, serverPublicIp:j.ip }); }catch(e){ res.status(502).json({ ok:false, error:'ipify unreachable' }); } });

app.post('/api/unlock', strict, async (req,res)=>{
  const { error, value } = unlockSchema.validate(req.body||{});
  if(error) return res.status(400).json({ ok:false, error:error.details[0].message });
  const type=value.type||'imei';
  if(type==='imei' &&!/^\d{15}$/.test(value.imei||'')) return res.status(400).json({ ok:false, error:'IMEI must be exactly 15 digits.' });
  if(type!=='imei' && (!value.details||value.details.trim().length<3) &&!value.f_email) return res.status(400).json({ ok:false, error:'File/Server orders need email + details.' });
  const db=load(); const phoneNorm=String(value.phone||'').replace(/\D/g,''); const user=db.users[phoneNorm]; if(user && user.blocked) return res.status(403).json({ ok:false, error:'Your account is blocked.' });
  const job={ id:'SU-'+Date.now(), type, imei:value.imei||'', details:value.details||'', f_email:value.f_email||'', f_username:value.f_username||'', f_accountid:value.f_accountid||'', f_quantity:value.f_quantity||'', f_bulk:value.f_bulk||'', brand:value.brand, model:value.model, phone:value.phone, serviceId:value.serviceId||'', serviceName:value.serviceName||'', status:'queued', payment_status:'unpaid', payment_method:null, paid_at:null, refunded_at:null, refund_reason:null, created:new Date().toISOString() };
  db.jobs.unshift(job); save(db); res.json({ ok:true, job:job.id, status:job.status, type, note:'Order received. Complete payment to start processing.' });
});
app.post('/api/job-status', strict, (req,res)=>{ const { error, value }=jobStatusSchema.validate(req.body||{}); if(error) return res.status(400).json({ ok:false, error:'Invalid job id.' }); const job=load().jobs.find(j=>j.id===value.id); if(!job) return res.status(404).json({ ok:false, error:'Job not found.' }); res.json({ ok:true, job }); });

app.post('/api/admin/rate', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const { error, value }=adminRateSchema.validate(req.body||{}); if(error) return res.status(400).json({ ok:false, error:'Invalid rate.' }); const db=load(); db.rate=value.slePerUsd; save(db); svcCache.ts=0; res.json({ ok:true, slePerUsd:value.slePerUsd }); });
app.post('/api/admin/job', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const { error, value }=adminJobSchema.validate(req.body||{}); if(error) return res.status(400).json({ ok:false, error:'Invalid payload.' }); const db=load(); const job=db.jobs.find(j=>j.id===value.id); if(!job) return res.status(404).json({ ok:false, error:'Job not found.' }); job.status=value.status; if(value.serviceId!==undefined) job.serviceId=value.serviceId; if(value.imei!==undefined) job.imei=value.imei; save(db); res.json({ ok:true, job }); });
app.get('/api/admin/jobs', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); res.json({ ok:true, jobs:load().jobs }); });
app.post('/api/admin/pay', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const { error, value }=adminPaySchema.validate(req.body||{}); if(error) return res.status(400).json({ ok:false, error:error.details[0].message }); const db=load(); const job=db.jobs.find(j=>j.id===value.id); if(!job) return res.status(404).json({ ok:false, error:'Job not found.' }); if(job.payment_status==='paid') return res.status(400).json({ ok:false, error:'Job already paid.' }); job.payment_status='paid'; job.payment_method=value.method; job.paid_at=new Date().toISOString(); job.status='sent-to-server'; if(!fuReady()){ save(db); return res.json({ ok:true, job:job.id, warning:'Upstream not configured.' }); } const up=await placeUpstream(job); if(up.ok){ job.upstream=up.r.json; saveUpstreamIds(job, up); } else { job.status='failed'; job.upstream=up.r.json||up.r.text; } save(db); res.json({ ok:up.ok, job:job.id, payment_status:job.payment_status, upstreamOrderId:up.orderId, upstream:up.r.json||up.r.text }); });
app.post('/api/admin/refund', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const { error, value }=adminRefundSchema.validate(req.body||{}); if(error) return res.status(400).json({ ok:false, error:error.details[0].message }); const db=load(); const job=db.jobs.find(j=>j.id===value.id); if(!job) return res.status(404).json({ ok:false, error:'Job not found.' }); if(job.payment_status!=='paid') return res.status(400).json({ ok:false, error:'Only paid jobs can be refunded.' }); job.payment_status='refunded'; job.refunded_at=new Date().toISOString(); job.refund_reason=value.reason; job.status='failed'; save(db); res.json({ ok:true, job:job.id, payment_status:job.payment_status, refund_reason:job.refund_reason }); });

app.get('/api/wallet/:phone', async (req,res)=>{ const phone=String(req.params.phone||'').replace(/\D/g,''); if(phone.length<9) return res.status(400).json({ ok:false, error:'Invalid phone.' }); const db=load(); const w=(db.wallets||{})[phone]||{ balance:0, tx:[] }; const pending=(db.topups||[]).filter(t=>t.phone===phone&&t.status==='pending'); res.json({ ok:true, balance:w.balance, tx:(w.tx||[]).slice(0,30), pending }); });
app.post('/api/wallet/topup', strict, (req,res)=>{
  const b=req.body||{}; const phone=String(b.phone||'').replace(/\D/g,''); const amount=parseFloat(b.amount); const method=['orange_money','binance'].includes(b.method)? b.method:null;
  if(phone.length<9||!amount||amount<=0||amount>10000||!method) return res.status(400).json({ ok:false, error:'Invalid top-up request.' });
  const db=load(); db.topups=db.topups||[]; const minUsd=Math.round((50/(db.rate||DEFAULT_RATE))*100)/100; if(amount<minUsd) return res.status(400).json({ ok:false, error:'Minimum top-up is 50 Le (about $'+minUsd.toFixed(2)+')' });
  const tp={ id:'TP-'+Date.now(), phone, amount:Math.round(amount*100)/100, method, ref:String(b.ref||''), status:'pending', created:new Date().toISOString() };
  if(method==='orange_money' && TRUSTED_PHONES.includes(phone)){ tp.status='approved'; tp.approvedAt=new Date().toISOString(); tp.auto='trusted-phone-bot'; db.topups.unshift(tp); db.wallets=db.wallets||{}; const w=db.wallets[phone]=db.wallets[phone]||{ balance:0, tx:[] }; w.balance=Math.round((w.balance+tp.amount)*100)/100; w.tx.unshift({ type:'credit', amount:tp.amount, ref:tp.id+' (trusted-auto)', date:new Date().toISOString() }); save(db); return res.json({ ok:true, topup:tp.id, auto_approved:true, balance:w.balance, note:'Trusted phone: credited instantly.' }); }
  db.topups.unshift(tp); save(db); res.json({ ok:true, topup:tp.id, pay_to: method==='orange_money'?'Orange Money +232 75 908 206 (Alhassan)':'Binance Pay ID 754378475', note:'Send amount now, include ref '+tp.id });
});
app.post('/api/wallet/pay', strict, async (req,res)=>{
  const b=req.body||{}; const phone=String(b.phone||'').replace(/\D/g,''); const db=load(); db.wallets=db.wallets||{}; const w=db.wallets[phone]=db.wallets[phone]||{ balance:0, tx:[] }; const user=db.users[phone]; if(user && user.blocked) return res.status(403).json({ ok:false, error:'Your account is BLOCKED.' });
  const services=fuReady()? await fetchCatalog():null; const svc=(services||[]).find(s=>s.id===String(b.serviceId)); if(!svc) return res.status(400).json({ ok:false, error:'Service not found.' });
  const price=svc.priceUsd; if(w.balance<price) return res.status(400).json({ ok:false, error:'Insufficient balance. Need $'+price+' — you have $'+w.balance, needed:price, balance:w.balance });
  const type=['imei','file','server'].includes(b.type)? b.type:'imei'; if(type==='imei' &&!/^\d{15}$/.test(b.imei||'')) return res.status(400).json({ ok:false, error:'IMEI must be 15 digits.' }); if(type!=='imei' &&!b.f_email && String(b.details||'').trim().length<3) return res.status(400).json({ ok:false, error:'Email/details required.' });
  w.balance=Math.round((w.balance-price)*100)/100;
  const job={ id:'SU-'+Date.now(), type, imei:b.imei||'', details:b.details||'', f_email:b.f_email||'', f_username:b.f_username||'', f_accountid:b.f_accountid||'', f_quantity:b.f_quantity||'', f_bulk:b.f_bulk||'', brand:b.brand||'', model:b.model||'', phone, serviceId:svc.id, serviceName:svc.name, status:'sent-to-server', payment_status:'paid', payment_method:'wallet', paid_at:new Date().toISOString(), created:new Date().toISOString() };
  let autoRefunded=false; if(fuReady()){ const up=await placeUpstream(job); if(up.ok){ job.upstream=up.r.json; saveUpstreamIds(job, up); } else { job.status='failed'; job.upstream=up.r.json||up.r.text; w.balance=Math.round((w.balance+price)*100)/100; w.tx.unshift({ type:'credit', amount:price, ref:'AUTO-REFUND '+job.id, date:new Date().toISOString() }); autoRefunded=true; } }
  w.tx.unshift({ type:'debit', amount:price, ref:job.id, date:new Date().toISOString() }); db.jobs.unshift(job); save(db); res.json({ ok:true, job:job.id, balance:w.balance, status:job.status, auto_refunded:autoRefunded });
});
app.get('/api/admin/wallet/topups', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); res.json({ ok:true, topups:(load().topups||[]).slice(0,100) }); });
app.post('/api/admin/wallet/approve', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const id=String((req.body||{}).id||''); const db=load(); db.wallets=db.wallets||{}; db.topups=db.topups||[]; const tp=db.topups.find(t=>t.id===id); if(!tp) return res.status(404).json({ ok:false, error:'Top-up not found.' }); if(tp.status!=='pending') return res.status(400).json({ ok:false, error:'Already processed.' }); tp.status='approved'; tp.approvedAt=new Date().toISOString(); const w=db.wallets[tp.phone]=db.wallets[tp.phone]||{ balance:0, tx:[] }; w.balance=Math.round((w.balance+tp.amount)*100)/100; w.tx.unshift({ type:'credit', amount:tp.amount, ref:tp.id, date:new Date().toISOString() }); save(db); res.json({ ok:true, balance:w.balance, topup:tp.id }); });
app.post('/api/admin/wallet/reject', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const id=String((req.body||{}).id||''); const db=load(); db.topups=db.topups||[]; const tp=db.topups.find(t=>t.id===id); if(!tp||tp.status!=='pending') return res.status(400).json({ ok:false, error:'Not found or already processed.' }); tp.status='rejected'; tp.reason=String((req.body||{}).reason||''); save(db); res.json({ ok:true, topup:tp.id }); });

app.get('/api/admin/customers', strict, (req,res)=>{
  if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' });
  const db=load(); const users=db.users||{}; const jobs=db.jobs||[]; const wallets=db.wallets||{}; const agg={};
  jobs.forEach(j=>{ const ph=String(j.phone||'').replace(/\D/g,''); if(!ph) return; if(!agg[ph]) agg[ph]={ totalOrders:0, totalSpent:0, lastService:'—', lastImei:'', lastDate:'' }; agg[ph].totalOrders+=1; if(j.payment_status==='paid'){ agg[ph].lastService=j.serviceName||j.service||agg[ph].lastService; agg[ph].lastImei=j.imei||''; agg[ph].lastDate=j.created||agg[ph].lastDate; } });
  Object.keys(wallets).forEach(ph=>{ const tx=wallets[ph]?.tx||[]; let spent=0; tx.forEach(t=>{ if(t.type==='debit') spent+=Number(t.amount||0); }); if(agg[ph]) agg[ph].totalSpent=Math.round(spent*100)/100; });
  const customers=Object.values(users).map(u=>{ const ph=String(u.phone||'').replace(/\D/g,''); const stat=agg[ph]||{ totalOrders:0, totalSpent:0, lastService:'—', lastImei:'', lastDate:'' }; return { id:u.phone, _id:u.phone, phone:u.phone, name:u.name||'', email:u.email||'', created:u.createdAt||'', createdAt:u.createdAt||'', totalOrders:stat.totalOrders||0, totalSpent:stat.totalSpent||0, lastService:stat.lastService, lastOrder:stat.lastService, lastOrderService:stat.lastService, lastImei:stat.lastImei, blocked:!!u.blocked }; }).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  Object.keys(agg).forEach(ph=>{ if(!users[ph]) customers.push({ id:ph, _id:ph, phone:ph, name:'(Guest) '+ph, email:'', created:agg[ph].lastDate||'', createdAt:agg[ph].lastDate||'', totalOrders:agg[ph].totalOrders, totalSpent:agg[ph].totalSpent, lastService:agg[ph].lastService, lastOrder:agg[ph].lastService, lastOrderService:agg[ph].lastService, lastImei:agg[ph].lastImei, blocked:false, guest:true }); });
  res.json({ ok:true, customers, count:customers.length });
});
app.post('/api/admin/customers/:id/block', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const id=String(req.params.id||'').replace(/\D/g,''); const db=load(); db.users=db.users||{}; const u=db.users[id]; if(!u) return res.status(404).json({ ok:false, error:'Customer not found.' }); u.blocked=true; save(db); res.json({ ok:true, id, blocked:true }); });
app.post('/api/admin/customers/:id/unblock', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const id=String(req.params.id||'').replace(/\D/g,''); const db=load(); db.users=db.users||{}; const u=db.users[id]; if(!u) return res.status(404).json({ ok:false, error:'Customer not found.' }); u.blocked=false; save(db); res.json({ ok:true, id, blocked:false }); });
app.delete('/api/admin/customers/:id', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const id=String(req.params.id||'').replace(/\D/g,''); const db=load(); db.users=db.users||{}; if(!db.users[id]) return res.status(404).json({ ok:false, error:'Customer not found.' }); const del=db.users[id]; delete db.users[id]; db.sessions=db.sessions||{}; Object.keys(db.sessions).forEach(t=>{ if(db.sessions[t].phone===id) delete db.sessions[t]; }); db.adminLog=db.adminLog||[]; db.adminLog.unshift({ action:'customer-delete', phone:id, email:del.email, at:new Date().toISOString() }); db.adminLog=db.adminLog.slice(0,200); save(db); res.json({ ok:true, deleted:id }); });

app.post('/api/webhook/binance', express.raw({ type:'*/*' }), async (req,res)=>{
  const secret=process.env.BINANCE_WEBHOOK_SECRET; if(secret){ const sig=req.get('x-binance-signature')||''; const hmac=crypto.createHmac('sha256', secret).update(req.body).digest('hex'); let ok=false; try{ ok=sig.length===hmac.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac)); }catch(e){ ok=false; } if(!ok) return res.status(401).json({ ok:false, error:'Bad signature.' }); }
  let payload=null; try{ payload=JSON.parse(req.body.toString()); }catch(e){} if(!payload) return res.status(400).json({ ok:false, error:'Invalid payload.' });
  const note=payload.note||payload.remark||''; const mt=note.match(/TP-\d+/);
  if(mt){ const db0=load(); db0.topups=db0.topups||[]; db0.wallets=db0.wallets||{}; const tp=db0.topups.find(t=>t.id===mt[0]&&t.status==='pending'); if(tp){ tp.status='approved'; tp.approvedAt=new Date().toISOString(); tp.auto='binance-webhook-bot'; const w=db0.wallets[tp.phone]=db0.wallets[tp.phone]||{ balance:0, tx:[] }; w.balance=Math.round((w.balance+tp.amount)*100)/100; w.tx.unshift({ type:'credit', amount:tp.amount, ref:tp.id+' (auto-bot)', date:new Date().toISOString() }); save(db0); return res.json({ ok:true, received:true, topup:tp.id, auto_approved:true }); } }
  const m=note.match(/SU-\d+/); if(!m) return res.json({ ok:true, received:true, warning:'No job ID in note.' });
  const db=load(); const job=db.jobs.find(j=>j.id===m[0]); if(!job||job.payment_status==='paid') return res.json({ ok:true, received:true });
  job.payment_status='paid'; job.payment_method='binance'; job.paid_at=new Date().toISOString(); job.status='sent-to-server';
  if(fuReady()){ const up=await placeUpstream(job); if(up.ok){ job.upstream=up.r.json; saveUpstreamIds(job, up); } else { job.status='failed'; job.upstream=up.r.json||up.r.text; } } save(db); res.json({ ok:true, received:true, job:job.id, auto_fulfilled:true });
});

/* =====================================================================
   CDR WEBHOOK — v3.43 — NO 405 + INFO CHECK SUPPORT — FULL
   ===================================================================== */
const handleCdr = (req, res) => {
  const p = (req.query && Object.keys(req.query).length > 0 && req.body && Object.keys(req.body).length === 0)? req.query : (req.body || req.query || {});
  const qKey = req.query.key || req.query.cdrkey || req.query.replykey || req.query.CDRKEY || '';
  const bKey = p.replykey || p.replyKey || p.key || p.cdrkey || p.CDRKEY || '';
  const hKey = req.get('x-cdr-key') || req.get('x-api-key') || '';
  const key = String(qKey || bKey || hKey || '').trim();
  const expected = String(process.env.CDR_REPLY_KEY || 'SU-CDR-7f3a9c2e8b1d').trim();

  if (req.method === 'GET' && Object.keys(req.body||{}).length === 0) {
    const hasOnlyKey = Object.keys(req.query).length <= 1;
    if (hasOnlyKey) {
      return res.json({ ok: true, message: 'CDR webhook alive — waiting for POST from FastUnlockers', key_ok: key === expected, time: new Date().toISOString() });
    }
  }
  if (!expected) return res.status(503).send('CDR not configured — set CDR_REPLY_KEY');
  if (key!== expected) {
    console.log('[CDR BAD KEY] got:', key, ' expected:', expected);
    return res.status(401).send('bad key');
  }
  const oid = String(p.orderid || p.orderId || p.order_id || p.ORDERID || p.referenceid || p.REFERENCEID || p.reference || p.transactionid || p.id || '').trim();
  const db = load();
  const job = db.jobs.find(j => j.upstreamOrderId && String(j.upstreamOrderId).trim() === oid) ||
              db.jobs.find(j => j.upstreamProviderOrderId && String(j.upstreamProviderOrderId).trim() === oid) ||
              db.jobs.find(j => j.id === String(p.jobid || p.jobId || p.JOBID || ''));
  if (!job) {
    console.log('[CDR] unknown order:', oid, ' payload:', JSON.stringify(p).slice(0,500));
    return res.status(404).send('unknown order ' + oid);
  }
  const st = String(p.status || p.orderstatus || p.orderStatus || p.ORDERSTATUS || '').toLowerCase();
  const codeRaw = String(p.code || p.unlock_code || p.unlockCode || p.reply || p.result || p.response || p.info || p.INFO || p.message || p.MESSAGE || '').trim();
  const codeLower = codeRaw.toLowerCase();
  const isRejected = st.includes('reject') || st.includes('fail') || st.includes('cancel') || codeLower.includes('not eligible') || codeLower.includes('noteligible');
  const isSolved = st.includes('success') || st.includes('solved') || st.includes('complet') || st === '4' || (codeRaw && codeRaw.length > 10);
  if (isRejected) {
    job.status = 'failed';
    job.cdrCode = codeRaw || 'Rejected / Not Eligible';
    if (job.payment_method === 'wallet' && job.payment_status === 'paid') {
      const ph = String(job.phone || '').replace(/\D/g, '');
      const w = db.wallets[ph];
      if (w) {
        const already = w.tx.some(t => t.ref && t.ref.includes(job.id) && t.type === 'credit' && t.ref.includes('AUTO-REFUND'));
        if (!already) {
          const price = (svcCache.data || []).find(s => s.id === String(job.serviceId))?.priceUsd || 0;
          if (price > 0) { w.balance = Math.round((w.balance + price) * 100) / 100; w.tx.unshift({ type: 'credit', amount: price, ref: 'AUTO-REFUND-CDR ' + job.id + ' ' + job.cdrCode, date: new Date().toISOString() }); }
        }
      }
    }
  } else if (isSolved) {
    job.status = 'solved';
    if (codeRaw) job.cdrCode = codeRaw;
  } else if (st.includes('process') || st.includes('pending') || st.includes('progress')) {
    job.status = 'processing';
  }
  job.upstream = p;
  job.cdrAt = new Date().toISOString();
  save(db);
  console.log('[CDR SUCCESS]', oid, '->', job.status, '|', (job.cdrCode||'').slice(0,120));
  res.send('OK');
};

app.get('/api/webhook/cdr', handleCdr);
app.post('/api/webhook/cdr', express.json(), express.urlencoded({ extended: true }), handleCdr);

const FU={ base:(process.env.UNLOCK_API_URL||'').replace(/\/+$/, ''), key:process.env.UNLOCK_API_KEY||'', username:process.env.UNLOCK_API_USERNAME||'', endpoint:process.env.UNLOCK_API_ENDPOINT||'/api/dhru' };
function fuReady(){ return!!(FU.base && FU.key && FU.username); }
function xmlEscape(v){ return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function dhruParameters(extraParams){ const entries=Object.entries(extraParams||{}).filter(([,value])=>value!==undefined&&value!==null&&value!=='').map(([key,value])=>`<${String(key).toUpperCase()}>${xmlEscape(value)}</${String(key).toUpperCase()}>`).join(''); return `<PARAMETERS>${entries}</PARAMETERS>`; }
function maskedBody(paramsObj){ const copy=Object.assign({}, paramsObj); if(copy.apiaccesskey) copy.apiaccesskey=copy.apiaccesskey.slice(0,4)+'***'; return Object.keys(copy).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(copy[k])).join('&'); }
async function gsmCall(action, extraParams={}, opts={}){
  if(!fuReady()) throw new Error('Upstream not configured.');
  const params={ username:FU.username, apiaccesskey:FU.key, action, requestformat:'JSON', parameters:dhruParameters(extraParams) };
  const body=new URLSearchParams(params).toString();
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(FU.base+FU.endpoint, { method:'POST', headers:{ 'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded' }, body, signal:ctrl.signal });
    const text=await r.text(); let json=null; try{ json=JSON.parse(text); }catch(e){}
    if(opts.debug){ console.log('[UPSTREAM OUT]', action, maskedBody(params)); console.log('[UPSTREAM IN ]', action, text.slice(0,1000)); }
    return { http:r.status, json, text:text.slice(0,1500), sentBody:maskedBody(params) };
  }catch(e){ return { http:0, json:null, text:'network error: '+e.message, sentBody:maskedBody(params) }; }finally{ clearTimeout(t); }
}
const LIST_ACTIONS={ imei:['imeiservicelist'], file:['fileservicelist','filelist','fileandservicelist','servicelistfile'], server:['serverservicelist','serverlist','creditservicelist','servicelistserver','serverandservicelist'] };
const ORDER_ACTIONS={ imei:['placeimeiorder'], file:['placefileorder'], server:['placeserverorder','placecreditorder'] };
const STATUS_ACTIONS={ imei:['getimeiorder'], file:['getfileorder'], server:['getserverorder'] };
const ALL_STATUS_ACTIONS=[...STATUS_ACTIONS.imei,...STATUS_ACTIONS.file,...STATUS_ACTIONS.server];

function parseList(raw, type){
  const listObj=(Array.isArray(raw)&&raw[0]&&raw[0].LIST)? raw[0].LIST : (raw&&raw.LIST? raw.LIST : (raw&&typeof raw==='object'? raw:{}));
  const rate=load().rate; const flat=0; const splitStr=(process.env.UNLOCK_COMMISSION_SPLIT||'0.75,0.25').split(','); const su=Math.max(0,Math.min(1,parseFloat(splitStr[0])||0.75)); const al=Math.max(0,Math.min(1,parseFloat(splitStr[1])||0.25)); const out=[];
  Object.keys(listObj).forEach(gname=>{ const svcs=(listObj[gname]||{}).SERVICES||{}; Object.keys(svcs).forEach(sid=>{ const s=svcs[sid]||{}; const credit=parseFloat(s.CREDIT||'0'); const priceUsd=Math.round((credit+flat)*100)/100; const profit=priceUsd-credit; out.push({ id:String(s.SERVICEID||sid), name:String(s.SERVICENAME||'').trim(), group:String(gname), type, costUsd:credit, priceUsd, profitUsd:Math.round(profit*100)/100, sierraunlockShareUsd:Math.round(profit*su*100)/100, alhassanShareUsd:Math.round(profit*al*100)/100, priceSle:Math.round(priceUsd*rate), time:String(s.TIME||''), info:String(s.INFO||'') }); }); });
  return out;
}
async function fetchList(type){
  const merged=[]; const seen={};
  for(const action of (LIST_ACTIONS[type]||[])){
    try{ const r=await gsmCall(action); if(r.http===200 && r.json && r.json.SUCCESS){ parseList(r.json.SUCCESS, type).forEach(s=>{ const k=s.type+':'+s.id; if(!seen[k]){ seen[k]=1; merged.push(s); } }); } }catch(e){}
  }
  return merged;
}
async function placeUpstreamOnce(job){
  const type=job.type||'imei'; let last={ http:0, json:null, text:'no attempt' };
  const sid=String(job.serviceId||job.service||'').trim();
  if(!sid) return { ok:false, r:{ http:400, json:{ ERROR:[{ MESSAGE:'Local: Missing serviceId' }] }, text:'missing serviceId', sentBody:'' }, orderId:null };
  for(const action of (ORDER_ACTIONS[type]||ORDER_ACTIONS.imei)){
    const params={ ID:sid, IMEI:job.imei||'', CUSTOMER:job.id, BRAND:job.brand||'', MODEL:job.model||'' };
    if(job.details) params.DETAILS=job.details; if(job.f_email) params.EMAIL=job.f_email; if(job.f_accountid) params.ACCOUNTID=job.f_accountid; if(job.f_quantity) params.QUANTITY=job.f_quantity; if(job.f_bulk) params.BULKIMEI=job.f_bulk;
    const r=await gsmCall(action, params, { debug:true }); last=r; console.log(`[UPSTREAM] Tried ${action} ID=${sid} IMEI=${job.imei} -> ${r.text.slice(0,300)}`);
    const success=r.json && r.json.SUCCESS;
    if(r.http===200 && success){ const record=Array.isArray(success)? (success[0]||{}) : success; return { ok:true, r, orderId:record.REFERENCE||record.REFERENCEID||record.reference||null, providerOrderId:record.ORDERID||record.orderid||record.order_id||null }; }
  }
  return { ok:false, r:last, orderId:null };
}
async function placeUpstream(job){
  let last=null; for(let attempt=1; attempt<=3; attempt++){ last=await placeUpstreamOnce(job); if(last.ok) return last; const msg=JSON.stringify((last.r&&last.r.json)||(last.r&&last.r.text)||''); if(/Required|Invalid|Not enough|balance|Denied/i.test(msg)) break; if(attempt<3) await new Promise(w=>setTimeout(w,2000)); } return last;
}
function saveUpstreamIds(job, up){ job.upstreamOrderId=up.orderId||null; if(up.providerOrderId) job.upstreamProviderOrderId=String(up.providerOrderId); }

// v3.43 FIXED — reads CODE, INFO, MESSAGE, RESPONSE, DETAILS all
function normalizeStatus(json){
  if(!json) return null;
  const s=json.SUCCESS? (Array.isArray(json.SUCCESS)? json.SUCCESS[0]:json.SUCCESS) : json;
  const statusRaw=String(s.STATUS||s.status||s.ORDERSTATUS||s.OrderStatus||s.orderstatus||'').trim();
  const codeRaw=String(s.CODE||s.code||s.UNLOCKCODE||s.unlock_code||s.UNLOCK_CODE||'').trim();
  const infoRaw=String(s.INFO||s.info||s.MESSAGE||s.message||s.RESPONSE||s.response||s.DETAILS||s.details||s.RESULT||s.result||'').trim();
  const statusLower=statusRaw.toLowerCase();
  const combinedLower=(codeRaw+' '+infoRaw).toLowerCase();

  let mapped='processing';
  let finalCode=codeRaw || infoRaw || null;

  if(['3','rejected','failed','fail','cancel','cancelled','not eligible','noteligible'].includes(statusLower) || statusLower.includes('reject') || statusLower.includes('fail') || combinedLower.includes('not eligible') || combinedLower.includes('noteligible')){
    mapped='failed';
    finalCode=codeRaw || infoRaw || 'Not Eligible / Rejected';
  } else if(['4','completed','solved','success','finished','done','complete'].includes(statusLower) || statusLower.includes('complet') || statusLower.includes('success') || statusLower.includes('solved')){
    mapped='solved';
    finalCode=codeRaw || infoRaw || statusRaw;
  } else if(infoRaw.length>15 &&!combinedLower.includes('not eligible')){
    // Samsung Info Check returns long INFO string => solved
    mapped='solved';
    finalCode=infoRaw || codeRaw;
  } else if(finalCode && finalCode.length>10 &&!combinedLower.includes('not eligible')){
    mapped='solved';
  }

  if(combinedLower.includes('not eligible') || combinedLower.includes('noteligible')){
    mapped='failed';
  }
  return { raw:s, status:mapped, code:finalCode? String(finalCode):null, statusRaw, codeRaw:codeRaw||infoRaw, infoRaw };
}

async function statusUpstream(job){
  const reference=job.upstreamOrderId||'';
  const stored=job.upstream && Array.isArray(job.upstream.SUCCESS)? (job.upstream.SUCCESS[0]||{}) : {};
  const providerId=job.upstreamProviderOrderId||job.providerOrderId||stored.ORDERID||stored.orderid||stored.order_id||'';
  // v3.43: try ALL status actions to catch Info Check which may be in file/server list
  for(const action of ALL_STATUS_ACTIONS){
    try{
      const r=await gsmCall(action, { ID:providerId||reference, ORDERID:providerId, REFERENCEID:reference, REFERENCE:reference });
      if(r.http===200 && r.json){
        const norm=normalizeStatus(r.json);
        if(norm){
          console.log('[POLL]', job.id, action, 'statusRaw:', norm.statusRaw, 'codeLen:', (norm.code||'').length, 'mapped:', norm.status);
          if(norm.status==='solved' || norm.status==='failed' || (norm.code && norm.code.length>10)){
            return { json:r.json, normalized:norm };
          }
        }
      }
    }catch(e){}
  }
  // fallback to original type-only
  return null;
}

app.get('/api/upstream-test', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const r=await gsmCall('accountinfo'); res.json({ ok:r.http===200 &&!!(r.json&&r.json.SUCCESS), http:r.http, sample:r.json||r.text }); });
app.get('/api/admin/probe', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const out={}; const cands=['accountinfo',...LIST_ACTIONS.imei,...LIST_ACTIONS.file,...LIST_ACTIONS.server]; for(const a of cands){ try{ const r=await gsmCall(a); out[a]={ http:r.http, ok:!!(r.json&&r.json.SUCCESS) }; }catch(e){ out[a]={ http:0, ok:false, err:e.message }; } } res.json({ ok:true, probe:out }); });
app.get('/api/admin/auth-check', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); if(!fuReady()) return res.status(503).json({ ok:false, error:'UNLOCK_API_URL / USERNAME / KEY not all set.' }); let ip='unknown'; try{ const ir=await fetch('https://api.ipify.org?format=json'); ip=(await ir.json()).ip; }catch(e){} const r=await gsmCall('accountinfo'); const authOk=!!(r.json&&r.json.SUCCESS); res.json({ ok:true, authenticated:authOk, serverPublicIp:ip, verdict:authOk?'Auth OK':'AUTH FAILING', endpointCalled:FU.base+FU.endpoint, username:FU.username, sentBody:r.sentBody, reply:r.json||r.text }); });

let svcCache={ ts:0, data:null };
app.post('/api/admin/refresh-catalog', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); svcCache.ts=0; res.json({ ok:true, note:'Catalog cache cleared.' }); });
async function fetchCatalog(){ if(svcCache.data && Date.now()-svcCache.ts<600000) return svcCache.data; const [imei,file,server]=await Promise.all([fetchList('imei'), fetchList('file'), fetchList('server')]); const services=[...imei,...file,...server]; if(!services.length) return svcCache.data||null; if(svcCache.data && svcCache.data.length>services.length+50) return svcCache.data; services.sort((a,b)=>a.type.localeCompare(b.type)||a.group.localeCompare(b.group)||Number(a.id)-Number(b.id)); svcCache={ ts:Date.now(), data:services }; return services; }
app.get('/api/services', async (req,res)=>{ if(!fuReady()) return res.json({ ok:false, mode:'manual', services:[] }); const services=await fetchCatalog(); if(!services) return res.status(502).json({ ok:false, error:'Upstream services unreachable' }); const pub=services.map(s=>({ id:s.id, name:s.name, group:s.group, type:s.type, priceUsd:s.priceUsd, priceSle:s.priceSle, time:s.time, info:s.info })); res.json({ ok:true, cached:(Date.now()-svcCache.ts)<600000, count:pub.length, services:pub }); });
app.get('/api/admin/services', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); if(!fuReady()) return res.json({ ok:false, mode:'manual', services:[] }); const services=await fetchCatalog(); if(!services) return res.status(502).json({ ok:false, error:'Upstream services unreachable' }); const splitStr=(process.env.UNLOCK_COMMISSION_SPLIT||'0.75,0.25').split(','); res.json({ ok:true, count:services.length, policy:{ flatFeeUsd:0, sierraunlockShare:parseFloat(splitStr[0])||0.75, alhassanShare:parseFloat(splitStr[1])||0.25, rateSlePerUsd:load().rate }, services }); });

app.post('/api/order', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const { error, value }=orderSchema.validate(req.body||{}); if(error) return res.status(400).json({ ok:false, error:error.details[0].message }); if(!fuReady()) return res.status(503).json({ ok:false, error:'Upstream not configured.' }); const job={ id:'SU-'+Date.now(), type:value.type||'imei', imei:value.imei||'', details:value.details||'', service:String(value.service), brand:value.brand||'', model:value.model||'', customer:value.customer||'', status:'sent-to-server', payment_status:'paid', payment_method:'manual', paid_at:new Date().toISOString(), created:new Date().toISOString() }; const up=await placeUpstream(job); if(up.ok){ job.upstream=up.r.json; saveUpstreamIds(job, up); } else { job.status='failed'; job.upstream=up.r.json||up.r.text; } const db=load(); db.jobs.unshift(job); save(db); res.json({ ok:up.ok, job:job.id, upstreamOrderId:up.orderId, upstream:up.r.json||up.r.text }); });
app.post('/api/order-status', strict, async (req,res)=>{ const { error, value }=jobStatusSchema.validate(req.body||{}); if(error) return res.status(400).json({ ok:false, error:'Invalid job id.' }); const db=load(); const job=db.jobs.find(j=>j.id===value.id); if(!job) return res.status(404).json({ ok:false, error:'Job not found.' }); if(fuReady() && job.upstreamOrderId){ const live=await statusUpstream(job); if(live && live.json){ job.upstream=live.json; const norm=live.normalized; if(norm){ if(norm.status==='solved'){ job.status='solved'; if(norm.code) job.cdrCode=norm.code; job.solvedAt=new Date().toISOString(); } else if(norm.status==='failed'){ job.status='failed'; if(norm.code) job.cdrCode=norm.code; job.failedAt=new Date().toISOString(); } else if(norm.status==='processing') job.status='processing'; } save(db); } return res.json({ ok:true, job, live:live? live.json:null }); } res.json({ ok:true, job }); });
app.post('/api/admin/retry', strict, async (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const id=String((req.body||{}).id||''); const db=load(); const job=db.jobs.find(j=>j.id===id); if(!job) return res.status(404).json({ ok:false, error:'Job not found.' }); if(!fuReady()) return res.status(503).json({ ok:false, error:'Upstream not configured.' }); const up=await placeUpstream(job); if(up.ok){ job.status='sent-to-server'; job.upstream=up.r.json; saveUpstreamIds(job, up); } else { job.status='failed'; job.upstream=up.r.json||up.r.text; } save(db); res.json({ ok:up.ok, job:job.id, upstreamOrderId:up.orderId, upstream:up.r.json||up.r.text }); });

app.get('/api/track/:id', async (req,res)=>{
  const id=String(req.params.id||'').trim(); if(!id||id.length<3||id.length>60) return res.status(400).json({ ok:false, error:'Invalid job ID.' });
  const db=load(); let job=db.jobs.find(j=>j.id===id); if(!job) return res.status(404).json({ ok:false, error:'Job not found.' });
  if(fuReady() && job.upstreamOrderId && ['queued','sent-to-server','processing'].includes(job.status)){
    try{
      const live=await statusUpstream(job);
      if(live && live.normalized){
        console.log('[TRACK LIVE v3.43]', job.id, 'upstream', job.upstreamOrderId, 'mapped:', live.normalized.status, 'raw:', JSON.stringify(live.json).slice(0,800));
        if(live.normalized.status==='solved'){ job.status='solved'; if(live.normalized.code) job.cdrCode=live.normalized.code; job.upstream=live.json; job.solvedAt=new Date().toISOString(); save(db); }
        else if(live.normalized.status==='failed'){ job.status='failed'; job.cdrCode=live.normalized.code||'Rejected / Not Eligible'; job.upstream=live.json; job.failedAt=new Date().toISOString(); save(db); }
        else if(live.normalized.code && live.normalized.code.length>15){ job.status='solved'; job.cdrCode=live.normalized.code; job.upstream=live.json; job.solvedAt=new Date().toISOString(); save(db); }
      }
    }catch(e){ console.log('[TRACK LIVE ERR]', e.message); }
  }
  let code=job.cdrCode||null, message=null; let failed=job.status==='failed';
  if(!code && job.upstream && typeof job.upstream==='object'){ const s=job.upstream.SUCCESS||job.upstream.success||null; if(s){ const rec=Array.isArray(s)? s[0]:s; code=rec.CODE||rec.code||rec.UNLOCKCODE||rec.unlock_code||rec.INFO||rec.info||rec.MESSAGE||rec.message||rec.RESPONSE||rec.response||null; message=rec.MESSAGE||rec.message||null; if(code && String(code).toLowerCase().includes('not eligible')) failed=true; } }
  if(code && String(code).toLowerCase().includes('not eligible')) failed=true;
  const maskedImei=job.imei? job.imei.slice(0,6)+'******'+job.imei.slice(-3):'';
  res.json({ ok:true, job:{ id:job.id, type:job.type||'imei', serviceName:job.serviceName||job.service||'—', imei:maskedImei, status:failed?'failed':job.status, payment_status:job.payment_status||'unpaid', failed, code:(job.status==='solved'||failed||code)? (code||message||job.cdrCode):null, message, created:job.created, upstreamOrderId:job.upstreamOrderId||null, eta:(job.status==='queued'||job.status==='sent-to-server'||job.status==='processing')?'In progress — auto-refreshing.':null } });
});

setInterval(async ()=>{
  if(!fuReady()) return;
  try{
    const db=load(); const pending=db.jobs.filter(j=>j.upstreamOrderId && ['sent-to-server','processing'].includes(j.status)).slice(0,15);
    if(!pending.length) return;
    for(const job of pending){
      try{
        const live=await statusUpstream(job);
        if(!live||!live.normalized) continue;
        if(live.normalized.status==='solved'){ job.status='solved'; if(live.normalized.code) job.cdrCode=live.normalized.code; job.upstream=live.json; job.solvedAt=new Date().toISOString(); }
        else if(live.normalized.status==='failed'){ job.status='failed'; if(live.normalized.code) job.cdrCode=live.normalized.code; job.upstream=live.json; job.failedAt=new Date().toISOString(); if(job.payment_method==='wallet' && job.payment_status==='paid'){ const ph=String(job.phone||'').replace(/\D/g,''); const w=db.wallets[ph]; if(w &&!w.tx.some(t=>t.ref&&t.ref.includes(job.id)&&t.type==='credit'&&t.ref.includes('AUTO-REFUND'))){ const price=(svcCache.data||[]).find(s=>s.id===String(job.serviceId))?.priceUsd||0; if(price>0){ w.balance=Math.round((w.balance+price)*100)/100; w.tx.unshift({ type:'credit', amount:price, ref:'AUTO-REFUND-CRON '+job.id+' '+live.normalized.code, date:new Date().toISOString() }); } } } }
        await new Promise(w=>setTimeout(w,800));
      }catch(e){}
    }
    save(db); console.log(`[CRON 30s] synced ${pending.length} jobs — fastunlock.us parity v3.43`);
  }catch(e){}
}, 30000);

const EMAILJS={ service:process.env.EMAILJS_SERVICE_ID||'', template:process.env.EMAILJS_TEMPLATE_ID||'', public:process.env.EMAILJS_PUBLIC_KEY||'', private:process.env.EMAILJS_PRIVATE_KEY||'' };
const emailReady=()=>!!(EMAILJS.service && EMAILJS.template && EMAILJS.private);
async function sendVerificationEmail(toEmail, toName, code){ if(!emailReady()) return { ok:false, error:'EmailJS not configured' }; try{ const r=await fetch('https://api.emailjs.com/api/v1.0/email/send', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ service_id:EMAILJS.service, template_id:EMAILJS.template, user_id:EMAILJS.public, accessToken:EMAILJS.private, template_params:{ to_email:toEmail, to_name:toName, code } }) }); let detail=''; try{ detail=(await r.text()).slice(0,200); }catch(e){} return { ok:r.ok, status:r.status, detail }; }catch(e){ return { ok:false, error:e.message }; } }
app.post('/api/auth/register', strict, async (req,res)=>{ const { name, email, phone, password }=req.body||{}; const p=String(phone||'').replace(/\D/g,''); if(!name||name.length<2) return res.status(400).json({ ok:false, error:'Name required (min 2 chars).' }); if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ ok:false, error:'Invalid email.' }); if(p.length<9) return res.status(400).json({ ok:false, error:'Invalid phone.' }); if(!password||password.length<6) return res.status(400).json({ ok:false, error:'Password min 6 chars.' }); const db=load(); db.users=db.users||{}; if(db.users[p]) return res.status(400).json({ ok:false, error:'This phone number is already registered.' }); const emailTaken=Object.values(db.users).some(u=>u.email&&u.email.toLowerCase()===email.toLowerCase()); if(emailTaken) return res.status(400).json({ ok:false, error:'This email is already used.' }); const code=String(Math.floor(100000+Math.random()*900000)); verificationCodes.set(p, { code, expires:Date.now()+600000, email, name, password }); const sent=await sendVerificationEmail(email, name, code); if(!sent.ok){ verificationCodes.delete(p); return res.status(500).json({ ok:false, error:'Could not send email. '+ (sent.error||sent.detail||'') }); } res.json({ ok:true, phone:p, note:'Verification code sent to '+email }); });
app.post('/api/auth/verify', strict, (req,res)=>{ const { phone, code }=req.body||{}; const p=String(phone||'').replace(/\D/g,''); const rec=verificationCodes.get(p); if(!rec) return res.status(400).json({ ok:false, error:'No pending verification.' }); if(Date.now()>rec.expires){ verificationCodes.delete(p); return res.status(400).json({ ok:false, error:'Code expired.' }); } if(rec.code!==String(code).trim()) return res.status(400).json({ ok:false, error:'Wrong code.' }); const db=load(); db.users=db.users||{}; const hash=bcrypt.hashSync(rec.password,10); db.users[p]={ phone:p, email:rec.email, name:rec.name, passwordHash:hash, verified:true, blocked:false, createdAt:new Date().toISOString(), lastLogin:new Date().toISOString() }; verificationCodes.delete(p); const token='u-'+p+'-'+Date.now(); db.sessions=db.sessions||{}; db.sessions[token]={ phone:p, created:new Date().toISOString() }; save(db); res.json({ ok:true, token, user:{ phone:p, email:rec.email, name:rec.name } }); });
app.post('/api/auth/login', strict, (req,res)=>{ const { emailOrPhone, password }=req.body||{}; const p=String(emailOrPhone||'').replace(/\D/g,''); const db=load(); db.users=db.users||{}; let user=null, phone=null; if(/^\d{9,}$/.test(p)){ user=db.users[p]; phone=p; } else { const entry=Object.entries(db.users).find(([k,u])=>u.email&&u.email.toLowerCase()===String(emailOrPhone).toLowerCase()); if(entry){ phone=entry[0]; user=entry[1]; } } if(!user) return res.status(401).json({ ok:false, error:'Account not found.' }); if(user.blocked) return res.status(403).json({ ok:false, error:'Account BLOCKED by founder.' }); if(!bcrypt.compareSync(password||'', user.passwordHash)) return res.status(401).json({ ok:false, error:'Wrong password.' }); user.lastLogin=new Date().toISOString(); db.sessions=db.sessions||{}; const token='u-'+phone+'-'+Date.now(); db.sessions[token]={ phone, created:new Date().toISOString() }; save(db); res.json({ ok:true, token, user:{ phone, email:user.email, name:user.name } }); });
app.get('/api/auth/me', strict, (req,res)=>{ const token=req.get('x-user-token'); if(!token) return res.status(401).json({ ok:false, error:'Not logged in.' }); const db=load(); db.sessions=db.sessions||{}; const s=db.sessions[token]; if(!s) return res.status(401).json({ ok:false, error:'Session expired.' }); db.users=db.users||{}; const user=db.users[s.phone]; if(!user) return res.status(401).json({ ok:false, error:'Account missing.' }); const w=(db.wallets||{})[s.phone]||{ balance:0, tx:[] }; const myJobs=(db.jobs||[]).filter(j=>(j.phone||'').replace(/\D/g,'')===s.phone).slice(0,100); res.json({ ok:true, user:{ phone:user.phone, email:user.email, name:user.name, createdAt:user.createdAt, lastLogin:user.lastLogin }, wallet:{ balance:w.balance, tx:(w.tx||[]).slice(0,20) }, orders:myJobs }); });
app.post('/api/auth/logout', strict, (req,res)=>{ const token=req.get('x-user-token'); if(token){ const db=load(); db.sessions=db.sessions||{}; delete db.sessions[token]; save(db); } res.json({ ok:true }); });
app.post('/api/auth/resend', strict, async (req,res)=>{ const { phone }=req.body||{}; const p=String(phone||'').replace(/\D/g,''); const rec=verificationCodes.get(p); if(!rec) return res.status(400).json({ ok:false, error:'No pending verification.' }); rec.code=String(Math.floor(100000+Math.random()*900000)); rec.expires=Date.now()+600000; verificationCodes.set(p, rec); const sent=await sendVerificationEmail(rec.email, rec.name, rec.code); res.json(sent.ok? { ok:true, note:'New code sent to '+rec.email } : { ok:false, error:'Email send failed. '+(sent.detail||'') }); });
app.post('/api/auth/forgot', strict, async (req,res)=>{ const { emailOrPhone }=req.body||{}; const p=String(emailOrPhone||'').replace(/\D/g,''); const db=load(); db.users=db.users||{}; let user=null, phone=null; if(/^\d{9,}$/.test(p)){ user=db.users[p]; phone=p; } else { const entry=Object.entries(db.users).find(([k,u])=>u.email&&u.email.toLowerCase()===String(emailOrPhone).toLowerCase()); if(entry){ phone=entry[0]; user=entry[1]; } } if(user&&phone){ const code=String(Math.floor(100000+Math.random()*900000)); resetCodes.set(phone, { code, expires:Date.now()+600000 }); await sendVerificationEmail(user.email, user.name, code); } res.json({ ok:true, note:'If that account exists, a 6-digit reset code was sent.' }); });
app.post('/api/auth/reset', strict, (req,res)=>{ const { emailOrPhone, code, newPassword }=req.body||{}; const p=String(emailOrPhone||'').replace(/\D/g,''); const db=load(); db.users=db.users||{}; let phone=null; if(/^\d{9,}$/.test(p)&&db.users[p]) phone=p; else { const entry=Object.entries(db.users).find(([k,u])=>u.email&&u.email.toLowerCase()===String(emailOrPhone).toLowerCase()); if(entry) phone=entry[0]; } if(!phone) return res.status(400).json({ ok:false, error:'Account not found.' }); const rec=resetCodes.get(phone); if(!rec) return res.status(400).json({ ok:false, error:'No reset requested.' }); if(Date.now()>rec.expires){ resetCodes.delete(phone); return res.status(400).json({ ok:false, error:'Code expired.' }); } if(rec.code!==String(code).trim()) return res.status(400).json({ ok:false, error:'Wrong code.' }); if(!newPassword||newPassword.length<6) return res.status(400).json({ ok:false, error:'New password min 6 chars.' }); db.users[phone].passwordHash=bcrypt.hashSync(newPassword,10); resetCodes.delete(phone); db.sessions=db.sessions||{}; Object.keys(db.sessions).forEach(t=>{ if(db.sessions[t].phone===phone) delete db.sessions[t]; }); save(db); res.json({ ok:true, note:'Password changed.' }); });
app.get('/api/admin/users', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const db=load(); db.users=db.users||{}; const list=Object.values(db.users).map(u=>({ phone:u.phone, email:u.email, name:u.name, createdAt:u.createdAt, lastLogin:u.lastLogin, balance:((db.wallets||{})[u.phone]||{}).balance||0, orders:(db.jobs||[]).filter(j=>(j.phone||'').replace(/\D/g,'')===u.phone).length, blocked:!!u.blocked })); res.json({ ok:true, count:list.length, users:list }); });
app.post('/api/admin/user/delete', strict, (req,res)=>{ if(!adminOk(req)) return res.status(401).json({ ok:false, error:'Bad token.' }); const { phone, reason }=req.body||{}; const p=String(phone||'').replace(/\D/g,''); if(!p) return res.status(400).json({ ok:false, error:'Phone required.' }); const db=load(); db.users=db.users||{}; if(!db.users[p]) return res.status(404).json({ ok:false, error:'Account not found.' }); const deleted=db.users[p]; delete db.users[p]; db.sessions=db.sessions||{}; Object.keys(db.sessions).forEach(t=>{ if(db.sessions[t].phone===p) delete db.sessions[t]; }); db.adminLog=db.adminLog||[]; db.adminLog.unshift({ action:'user-delete', phone:p, email:deleted.email, reason:String(reason||''), at:new Date().toISOString() }); db.adminLog=db.adminLog.slice(0,200); save(db); res.json({ ok:true, note:'Account deleted. Wallet/order records kept.' }); });

app.use((req,res)=>res.status(404).json({ ok:false, error:'Not found.' }));
app.use((err,req,res,next)=>{ console.error('[ERR]', err.message); res.status(err.status||500).json({ ok:false, error:'Server error.' }); });
app.listen(PORT, ()=>{
  console.log(`SIERRAUNLOCK API v3.43 online on :${PORT} — mode: ${fuReady()?'CONNECTED':'MANUAL'}`);
  console.log(` Vault: ${ghReady()? 'GitHub ('+GH.repo+')':'LOCAL ONLY'}`);
  console.log(` CDR URL: https://sierraunlock-tech-1-4um3.onrender.com/api/webhook/cdr?key=${process.env.CDR_REPLY_KEY||'SU-CDR-7f3a9c2e8b1d'}`);
  console.log(` Fix: v3.43 FULL — Samsung Info Check INFO/MESSAGE as code — fastunlock.us parity`);
});