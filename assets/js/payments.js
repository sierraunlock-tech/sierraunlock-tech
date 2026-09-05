/* =====================================================================
   SIERRAUNLOCK • PAYMENTS + LIVE CONVERTER ENGINE — payments.js (v2 • DOCUMENTED + HARDENED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The "Currency Brain" of the website (payments.html ONLY). It powers
   the live SLE ⇄ USD ⇄ USDT ⇄ BTC ⇄ ETH converter that customers use
   to understand exactly how much they are paying in their chosen currency.

   SECTION MAP:
   01  Default rates + fallback values (used when offline)
   02  State management (SLE from admin, crypto from Binance live)
   03  Boot — wire inputs, swap button, auto-refresh
   04  Live crypto rates fetcher (Binance public API, free, no key)
   05  Converter math with input validation (max cap, positive-only)
   06  Rate line + live dot renderer
   07  Admin dashboard hook (EXT-11: setSleRate, refresh)

   SECURITY NOTES:
   • Max amount cap prevents absurd calculations (10 billion limit).
   • Negative amounts and NaN are rejected silently (show 0).
   • Swap button has a 300 ms debounce to prevent rapid-fire abuse.
   • Binance API is public and free — no secret keys exposed.

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   ===================================================================== */
'use strict';
(function () {

  /* 01 • DEFAULT RATES + FALLBACK VALUES */
  const DEFAULT_SLE_PER_USD = 22.5;                 /* admin can override (EXT-11) */
  const FALLBACK = { BTC: 65000, ETH: 3200 };       /* used only if offline */
  const MAX_AMOUNT = 10_000_000_000;                /* 10 billion cap — prevents abuse */
  const SWAP_COOLDOWN = 300;                        /* 300 ms debounce on swap button */

  /* 02 • STATE MANAGEMENT — SLE from admin, crypto from Binance live */
  const state = {
    sle: parseFloat(localStorage.getItem('su_rate_sle')) || DEFAULT_SLE_PER_USD,
    btc: FALLBACK.BTC,
    eth: FALLBACK.ETH,
    live: false,
    updated: null,
    lastSwap: 0
  };

  const el = (id) => document.getElementById(id);
  const getVUSD = () => ({ SLE: 1 / state.sle, USD: 1, USDT: 1, BTC: state.btc, ETH: state.eth });

  /* 03 • BOOT — wire inputs, swap button, auto-refresh */
  document.addEventListener('DOMContentLoaded', () => {
    if (!el('payAmount')) return;                    /* only runs on payments.html */
    ['payAmount', 'payFrom', 'payTo'].forEach(id => el(id).addEventListener('input', convert));
    el('swapBtn').addEventListener('click', () => {
      const now = Date.now();
      if (now - state.lastSwap < SWAP_COOLDOWN) return;   /* debounce rapid clicks */
      state.lastSwap = now;
      const a = el('payFrom'); const b = el('payTo');
      const t = a.value; a.value = b.value; b.value = t; convert();
    });
    fetchLive();
    setInterval(fetchLive, 60000);                   /* auto-refresh every minute */
    renderRates();
    convert();
  });

  /* 04 • LIVE CRYPTO RATES FROM BINANCE (public, approved, free) */
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

  /* 05 • CONVERTER MATH WITH INPUT VALIDATION */
  function convert() {
    let amt = parseFloat(el('payAmount').value) || 0;
    if (amt < 0) amt = 0;                            /* reject negative */
    if (amt > MAX_AMOUNT) amt = MAX_AMOUNT;          /* cap at 10 billion */
    const from = el('payFrom').value, to = el('payTo').value;
    const v = getVUSD();
    const out = amt * v[from] / v[to];
    const dec = ({ BTC: 6, ETH: 5 })[to] ?? 2;
    el('payResult').textContent = out.toLocaleString('en-US', { maximumFractionDigits: dec }) + ' ' + to;
  }

  /* 06 • RATE LINE + LIVE DOT RENDERER */
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

  /* 07 • ADMIN DASHBOARD HOOK (EXT-11) — allows admin to set SLE rate */
  window.SU_PAY = {
    setSleRate(v) { localStorage.setItem('su_rate_sle', String(v)); state.sle = v; renderRates(); convert(); },
    refresh() { fetchLive(); }
  };
})();