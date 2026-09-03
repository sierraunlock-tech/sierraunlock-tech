/* =====================================================================
   SIERRAUNLOCK • PAYMENTS + LIVE CONVERTER ENGINE
   File : assets/js/payments.js
   Ext  : EXT-09
   Rates: crypto = Binance public API (free, no key) • SLE = admin rate
   ===================================================================== */
   'use strict';
   (function () {
   
     const DEFAULT_SLE_PER_USD = 22.5;                 /* admin can override (EXT-11) */
     const FALLBACK = { BTC: 65000, ETH: 3200 };       /* used only if offline */
   
     const state = {
       sle: parseFloat(localStorage.getItem('su_rate_sle')) || DEFAULT_SLE_PER_USD,
       btc: FALLBACK.BTC,
       eth: FALLBACK.ETH,
       live: false,
       updated: null
     };
   
     const el = (id) => document.getElementById(id);
     const getVUSD = () => ({ SLE: 1 / state.sle, USD: 1, USDT: 1, BTC: state.btc, ETH: state.eth });
   
     document.addEventListener('DOMContentLoaded', () => {
       if (!el('payAmount')) return;                    /* only runs on payments.html */
       ['payAmount', 'payFrom', 'payTo'].forEach(id => el(id).addEventListener('input', convert));
       el('swapBtn').addEventListener('click', () => {
         const a = el('payFrom'); const b = el('payTo');
         const t = a.value; a.value = b.value; b.value = t; convert();
       });
       fetchLive();
       setInterval(fetchLive, 60000);                   /* auto-refresh every minute */
       renderRates();
       convert();
     });
   
     /* ---- LIVE CRYPTO RATES FROM BINANCE (public, approved, free) ---- */
     function fetchLive() {
       Promise.all([
         fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').then(r => r.json()),
         fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT').then(r => r.json())
       ]).then(([b, e]) => {
         state.btc = parseFloat(b.price);
         state.eth = parseFloat(e.price);
         state.live = true;
         state.updated = new Date();
         renderRates(); convert();
       }).catch(() => { state.live = false; renderRates(); });
     }
   
     /* ---- CONVERTER ---- */
     function convert() {
       const amt = parseFloat(el('payAmount').value) || 0;
       const from = el('payFrom').value, to = el('payTo').value;
       const v = getVUSD();
       const out = amt * v[from] / v[to];
       const dec = ({ BTC: 6, ETH: 5 })[to] ?? 2;
       el('payResult').textContent = out.toLocaleString('en-US', { maximumFractionDigits: dec }) + ' ' + to;
     }
   
     /* ---- RATE LINE + LIVE DOT ---- */
     function renderRates() {
       el('rateLine').innerHTML =
         '1 USD = ' + state.sle.toFixed(2) + ' SLE &nbsp;•&nbsp; 1 BTC = $' +
         state.btc.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' &nbsp;•&nbsp; 1 ETH = $' +
         state.eth.toLocaleString('en-US', { maximumFractionDigits: 0 });
       el('liveDot').className = state.live ? 'live-dot on' : 'live-dot off';
       el('liveLabel').textContent = state.live ? 'LIVE — Binance API' : 'OFFLINE — fallback rates';
       el('updated').textContent = state.updated
         ? 'Updated ' + state.updated.toLocaleTimeString()
         : 'Connecting to Binance…';
     }
   
     /* ---- HOOK FOR ADMIN DASHBOARD (EXT-11) ---- */
     window.SU_PAY = {
       setSleRate(v) { localStorage.setItem('su_rate_sle', String(v)); state.sle = v; renderRates(); convert(); },
       refresh() { fetchLive(); }
     };
   })();