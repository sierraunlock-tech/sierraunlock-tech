require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data.json');

const load = () => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return { jobs: [], rate: 22.5 }; } };
const save = (d) => fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
if (!fs.existsSync(DATA)) save({ jobs: [], rate: 22.5 });

app.use(helmet());
app.use(cors({ origin: (process.env.FRONTEND_URL || '*').split(',') }));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));
const strict = rateLimit({ windowMs: 60 * 1000, max: 6 });

const adminOk = (req) => !!process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;
const HAS_UPSTREAM = () => !!(process.env.UNLOCK_API_URL && process.env.UNLOCK_API_KEY);

app.get('/api/health', (req, res) => res.json({
  ok: true, service: 'SIERRAUNLOCK API', version: '1.0.0',
  mode: HAS_UPSTREAM() ? 'connected-to-unlock-server' : 'manual-mode',
  time: new Date().toISOString()
}));

app.get('/api/rates', (req, res) => res.json({ ok: true, slePerUsd: load().rate }));

app.post('/api/unlock', strict, async (req, res) => {
  const { imei, brand, model, phone } = req.body || {};
  if (!/^\d{15}$/.test(imei || '')) return res.status(400).json({ ok: false, error: 'IMEI must be 15 digits.' });
  if (!brand || !model || !phone) return res.status(400).json({ ok: false, error: 'brand, model and phone are required.' });
  const db = load();
  const job = { id: 'SU-' + Date.now(), imei, brand, model, phone, status: 'queued', created: new Date().toISOString() };
  if (HAS_UPSTREAM()) {
    try {
      const r = await fetch(process.env.UNLOCK_API_URL + '/unlock', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.UNLOCK_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, brand, model })
      });
      job.upstream = await r.json();
      job.status = 'sent-to-server';
    } catch (e) { job.upstreamError = 'server unreachable — process manually'; }
  }
  db.jobs.unshift(job); save(db);
  res.json({ ok: true, job: job.id, status: job.status, note: 'Quote confirmed on WhatsApp.' });
});

app.post('/api/job-status', strict, (req, res) => {
  const job = load().jobs.find(j => j.id === (req.body || {}).id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  res.json({ ok: true, job });
});

app.post('/api/admin/rate', (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const v = parseFloat((req.body || {}).slePerUsd);
  if (!v || v <= 0) return res.status(400).json({ ok: false, error: 'Invalid rate.' });
  const db = load(); db.rate = v; save(db);
  res.json({ ok: true, slePerUsd: v });
});

app.post('/api/admin/job', (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ ok: false, error: 'Bad token.' });
  const db = load();
  const job = db.jobs.find(j => j.id === (req.body || {}).id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
  job.status = (req.body || {}).status || job.status;
  save(db);
  res.json({ ok: true, job });
});

app.post('/api/webhook/binance', express.raw({ type: '*/*' }), (req, res) => {
  res.json({ ok: true, received: true });
});

app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.listen(PORT, () => console.log('SIERRAUNLOCK API online on :' + PORT));