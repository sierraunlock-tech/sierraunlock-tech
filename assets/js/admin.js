/* =====================================================================
   SIERRAUNLOCK • ADMIN DASHBOARD ENGINE — admin.js (v2 • DOCUMENTED + HARDENED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The private "control room" of the platform (admin.html). Founders use
   it to: view live stats, set the SLE rate, set tool pricing, approve
   seller listings & community shops, publish marketplace items, log
   repair/unlock jobs, change the site version and change the admin PIN.

   SECTION MAP:
   01  Storage helpers
   02  Boot (login gate + 30-min inactivity auto-logout)
   03  Tab switching
   04  Login + brute-force lockout (5 wrong tries = 60 s freeze)
   05  Overview stats
   06  SLE exchange rate
   07  Tool pricing (supplier cost + $5-$10 margin)
   08  Seller submissions (approve / reject)
   09  Community shops (verify / remove)
   10  Marketplace listings (publish / remove)
   11  Jobs board (log / advance / delete)
   12  Settings (version, PIN change, danger zone)

   SECURITY NOTES:
   • PIN is stored base64-encoded (light obfuscation) — CHANGE DEFAULT 2026!
   • The brute-force lockout lives HERE (security.js must not duplicate it).
   • Admin session expires automatically after 30 minutes of inactivity.

   OWNER: SIERRAUNLOCK Founders • Waterloo / Koidu, Sierra Leone
   ===================================================================== */
'use strict';
(function () {

  /* 01 • STORAGE HELPERS — safe JSON read/write on localStorage */
  const $ = (id) => document.getElementById(id);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const TOOL_NAMES = ['Unlock Codes','FRP Reset','Flashing & Firmware','Network Config','Screen Replacement','Battery Swap','Chip-Level Repair','Data Recovery','Laptop Repair','Spare Parts Sourcing','Legal IMEI Check','OS Optimization'];

  /* 02 • BOOT — show login or dashboard; start session watchdog */
  const SESSION_MS = 30 * 60 * 1000;                    /* 30 minutes inactivity = logout */
  const touchSession = () => sessionStorage.setItem('su_admin_t', String(Date.now()));
  function checkSession() {
    if (sessionStorage.getItem('su_admin_ok') !== '1') return;
    const t = parseInt(sessionStorage.getItem('su_admin_t') || '0', 10);
    if (Date.now() - t > SESSION_MS) { sessionStorage.removeItem('su_admin_ok'); showLogin(); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('pinInput')) return;                          /* only runs on admin.html */
    (sessionStorage.getItem('su_admin_ok') === '1') ? showDash() : showLogin();
    $('loginBtn').addEventListener('click', tryLogin);
    $('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
    $('logoutBtn').addEventListener('click', () => { sessionStorage.removeItem('su_admin_ok'); showLogin(); });
    document.addEventListener('click', () => { if (sessionStorage.getItem('su_admin_ok') === '1') touchSession(); }, true);
    setInterval(checkSession, 30000);                    /* watchdog every 30 s */
    wireTabs(); wireRates(); wirePricing(); wirePending(); wireShops(); wireProducts(); wireJobs(); wireSettings();
  });

  /* 03 • TAB SWITCHING — left menu shows/hides dashboard panels */
  function wireTabs() {
    document.querySelectorAll('.adm-tab').forEach(t => t.addEventListener('click', () => {
      document.querySelectorAll('.adm-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.querySelectorAll('.adm-sec').forEach(s => s.hidden = true);
      const target = $('sec-' + t.dataset.tab);
      if (target) target.hidden = false;
    }));
  }

  function showLogin() { $('loginView').hidden = false; $('dashView').hidden = true; }
  function showDash()  { $('loginView').hidden = true;  $('dashView').hidden = false; renderAll(); }

  /* 04 • LOGIN + BRUTE-FORCE LOCKOUT — 5 wrong tries = 60 s freeze */
  const LOCK_MAX = 5, LOCK_MS = 60000;
  const lockGet = () => get('su_admin_lock', { fails: 0, until: 0 });
  const lockSet = (s) => set('su_admin_lock', s);

  function tryLogin() {
    const rem = Math.max(0, lockGet().until - Date.now());
    if (rem > 0) { $('loginErr').textContent = '🔒 Too many wrong tries. Locked for ' + Math.ceil(rem / 1000) + ' s.'; return; }
    const ok = btoa($('pinInput').value) === (localStorage.getItem('su_pin') || btoa('2026'));
    if (ok) {
      lockSet({ fails: 0, until: 0 });                   /* clear lock on success */
      sessionStorage.setItem('su_admin_ok', '1');
      touchSession();
      $('pinInput').value = ''; $('loginErr').textContent = '';
      showDash();
    } else {
      const s = lockGet(); s.fails += 1;
      if (s.fails >= LOCK_MAX) { s.until = Date.now() + LOCK_MS; s.fails = 0; $('loginErr').textContent = '🔒 5 wrong tries — locked for 60 seconds.'; }
      else { $('loginErr').textContent = 'Wrong PIN (' + s.fails + '/' + LOCK_MAX + '). Default is 2026 until you change it in Settings.'; }
      lockSet(s);
      const c = $('loginCard'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    }
  }

  function renderAll() { renderOverview(); renderPending(); renderShops(); renderProducts(); renderJobs(); renderSettings(); }

  /* 05 • OVERVIEW STATS — live counters on the dashboard */
  function renderOverview() {
    const jobs = get('su_jobs', []), shops = get('su_shops', []), prods = get('su_products', []), pend = get('su_pending_products', []);
    $('stJobs').textContent = jobs.length;
    $('stSolved').textContent = jobs.filter(j => j.status === 'solved').length;
    $('stPendingShops').textContent = shops.filter(s => !s.verified).length;
    $('stPendingProd').textContent = pend.length;
    $('stProducts').textContent = prods.length;
    $('stRate').textContent = (parseFloat(localStorage.getItem('su_rate_sle')) || 22.5).toFixed(2);
    $('stVersion').textContent = localStorage.getItem('su_version') || 'v2.0.0';
  }

  /* 06 • SLE EXCHANGE RATE — feeds the Payments live converter */
  function wireRates() {
    $('rateSave').addEventListener('click', () => {
      const v = parseFloat($('rateInput').value);
      if (!v || v <= 0) { alert('Enter a valid SLE-per-USD rate.'); return; }
      localStorage.setItem('su_rate_sle', String(v));
      renderOverview();
      alert('✔ SLE rate saved. The Payments converter uses it on next load.');
    });
  }

  /* 07 • TOOL PRICING — private cost + margin math (auto-saves on typing) */
  function wirePricing() {
    const box = $('pricingRows');
    const pricing = get('su_pricing', {});
    box.innerHTML = TOOL_NAMES.map(t => {
      const p = pricing[t] || { base: 0, margin: 5 };
      return '<div class="prow"><span>' + t + '</span>' +
        '<input type="number" min="0" step="1" class="pbase" data-t="' + t + '" value="' + p.base + '" aria-label="Supplier cost for ' + t + '">' +
        '<select class="pmargin" data-t="' + t + '" aria-label="Margin for ' + t + '">' +
        [5,6,7,8,9,10].map(m => '<option' + (p.margin === m ? ' selected' : '') + '>+' + m + '</option>').join('') +
        '</select><span class="psell">$' + (p.base + p.margin) + '</span></div>';
    }).join('');
    const save = () => {
      const out = {};
      box.querySelectorAll('.prow').forEach(r => {
        const t = r.querySelector('.pbase').dataset.t;
        const base = parseFloat(r.querySelector('.pbase').value) || 0;
        const margin = parseInt(r.querySelector('.pmargin').value.replace('+', ''), 10);
        out[t] = { base: base, margin: margin };
        r.querySelector('.psell').textContent = '$' + (base + margin);
      });
      set('su_pricing', out);
    };
    box.addEventListener('input', save);
    box.addEventListener('change', save);
  }

  /* 08 • SELLER SUBMISSIONS — approve publishes to marketplace, reject deletes */
  function renderPending() {
    const arr = get('su_pending_products', []);
    const box = $('pendingList');
    box.innerHTML = arr.length ? arr.map((p, i) =>
      '<div class="row-item">' +
      (p.img ? '<img src="' + p.img + '" alt="" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none">' : '') +
      '<div class="info"><strong></strong><br><small></small></div>' +
      '<button class="btn btn-brand btn-sm" data-act="approve" data-i="' + i + '">Approve ✔</button>' +
      '<button class="btn btn-sm" style="background:#FDECEA;color:#B00020" data-act="reject" data-i="' + i + '">Reject</button></div>'
    ).join('') : '<p style="color:var(--ink-soft)">No seller submissions waiting.</p>';
    const infos = box.querySelectorAll('.info');
    arr.forEach((p, i) => {
      infos[i].querySelector('strong').textContent = p.name + ' (' + p.brand + ') — ' + p.price;
      infos[i].querySelector('small').textContent = 'Seller: ' + (p.seller || '—') + ' ' + (p.phone || '') + ' • ' + p.desc;
    });
  }
  function wirePending() {
    $('pendingList').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const arr = get('su_pending_products', []); const i = +b.dataset.i;
      if (b.dataset.act === 'approve') {
        const item = arr.splice(i, 1)[0];
        item.pending = false;
        const live = get('su_products', []); live.unshift(item); set('su_products', live);
        set('su_pending_products', arr);
      }
      if (b.dataset.act === 'reject') { arr.splice(i, 1); set('su_pending_products', arr); }
      renderPending(); renderProducts(); renderOverview();
    });
  }

  /* 09 • COMMUNITY SHOPS — verify pins on the GPS map or remove them */
  function renderShops() {
    const arr = get('su_shops', []);
    $('shopList').innerHTML = arr.length ? arr.map((s, i) =>
      '<div class="row-item"><div class="info"><strong></strong><br><small></small></div>' +
      (s.verified ? '<span class="tag tag-solved">✔ Verified</span>' : '<button class="btn btn-brand btn-sm" data-act="approve" data-i="' + i + '">Approve</button>') +
      '<button class="btn btn-sm" style="background:#FDECEA;color:#B00020" data-act="delshop" data-i="' + i + '">Remove</button></div>'
    ).join('') : '<p style="color:var(--ink-soft)">No community shops submitted yet.</p>';
    const infos = $('shopList').querySelectorAll('.info');
    arr.forEach((s, i) => {
      infos[i].querySelector('strong').textContent = s.name + ' — ' + s.area + ', ' + s.district;
      infos[i].querySelector('small').textContent = 'Owner: ' + (s.owner || '—') + ' • ' + (s.phone || '');
    });
  }
  function wireShops() {
    $('shopList').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const arr = get('su_shops', []); const i = +b.dataset.i;
      if (b.dataset.act === 'approve') { arr[i].verified = true; set('su_shops', arr); }
      if (b.dataset.act === 'delshop') { arr.splice(i, 1); set('su_shops', arr); }
      renderShops(); renderOverview();
    });
  }

  /* 10 • MARKETPLACE — publish new listings or remove live ones */
  function renderProducts() {
    const arr = get('su_products', []);
    $('prodList').innerHTML = arr.length ? arr.map((p, i) =>
      '<div class="row-item">' +
      (p.img ? '<img src="' + p.img + '" alt="" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none">' : '') +
      '<div class="info"><strong></strong><br><small></small></div>' +
      '<button class="btn btn-sm" style="background:#FDECEA;color:#B00020" data-act="delprod" data-i="' + i + '">Remove</button></div>'
    ).join('') : '<p style="color:var(--ink-soft)">No live listings yet — approve seller submissions or add one above.</p>';
    const infos = $('prodList').querySelectorAll('.info');
    arr.forEach((p, i) => {
      infos[i].querySelector('strong').textContent = p.name + ' (' + p.brand + ')';
      infos[i].querySelector('small').textContent = p.price + ' • ' + p.desc;
    });
  }
  function wireProducts() {
    $('prodForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const g = (id) => $(id).value.trim();
      const arr = get('su_products', []);
      arr.unshift({ icon: g('pIcon') || '🧩', img: null, name: g('pName'), brand: g('pBrand'), cat: g('pCat'), cond: g('pCond'), desc: g('pDesc'), price: g('pPrice') || 'Quote' });
      set('su_products', arr); e.target.reset();
      renderProducts(); renderOverview();
    });
    $('prodList').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const arr = get('su_products', []); arr.splice(+b.dataset.i, 1); set('su_products', arr);
      renderProducts(); renderOverview();
    });
  }

  /* 11 • JOBS BOARD — track every job: pending → progress → solved */
  function renderJobs() {
    const arr = get('su_jobs', []);
    $('jobList').innerHTML = arr.length ? arr.map((j, i) =>
      '<div class="row-item"><div class="info"><strong></strong><br><small></small></div>' +
      '<span class="tag tag-' + j.status + '">' + j.status + '</span>' +
      (j.status !== 'solved' ? '<button class="btn btn-brand btn-sm" data-act="advance" data-i="' + i + '">' + (j.status === 'pending' ? 'Start' : 'Mark Solved ✔') + '</button>' : '') +
      '<button class="btn btn-sm" style="background:#FDECEA;color:#B00020" data-act="deljob" data-i="' + i + '">Delete</button></div>'
    ).join('') : '<p style="color:var(--ink-soft)">No jobs yet — log the first one above.</p>';
    const infos = $('jobList').querySelectorAll('.info');
    arr.forEach((j, i) => {
      infos[i].querySelector('strong').textContent = j.customer + ' — ' + j.device;
      infos[i].querySelector('small').textContent = j.service + ' • ' + j.hub;
    });
  }
  function wireJobs() {
    $('jobForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const g = (id) => $(id).value.trim();
      const arr = get('su_jobs', []);
      arr.unshift({ id: Date.now(), customer: g('jCustomer'), device: g('jDevice'), service: g('jService'), hub: g('jHub'), status: 'pending' });
      set('su_jobs', arr); e.target.reset();
      renderJobs(); renderOverview();
    });
    $('jobList').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const arr = get('su_jobs', []); const i = +b.dataset.i;
      if (b.dataset.act === 'advance') arr[i].status = arr[i].status === 'pending' ? 'progress' : 'solved';
      if (b.dataset.act === 'deljob') arr.splice(i, 1);
      set('su_jobs', arr); renderJobs(); renderOverview();
    });
  }

  /* 12 • SETTINGS — version label, PIN change, danger-zone wipe */
  function renderSettings() {
    $('verInput').value = localStorage.getItem('su_version') || 'v2.0.0';
    $('rateInput').value = (parseFloat(localStorage.getItem('su_rate_sle')) || 22.5);
  }
  function wireSettings() {
    $('verSave').addEventListener('click', () => {
      const v = $('verInput').value.trim(); if (!v) return;
      localStorage.setItem('su_version', v); renderOverview();
      alert('✔ Version updated site-wide (all footers on next load).');
    });
    $('pinSave').addEventListener('click', () => {
      const cur = $('pinCur').value, nw = $('pinNew').value;
      if (btoa(cur) !== (localStorage.getItem('su_pin') || btoa('2026'))) { alert('Current PIN is wrong.'); return; }
      if (nw.length < 4) { alert('New PIN must be at least 4 characters.'); return; }
      localStorage.setItem('su_pin', btoa(nw)); $('pinCur').value = ''; $('pinNew').value = '';
      alert('✔ PIN changed.');
    });
    $('dangerClear').addEventListener('click', () => {
      if (!confirm('Delete ALL local admin data (shops, products, pending, jobs, pricing, rate, version)?')) return;
      ['su_shops','su_products','su_pending_products','su_jobs','su_pricing','su_rate_sle','su_version'].forEach(k => localStorage.removeItem(k));
      renderAll();
    });
  }
})();