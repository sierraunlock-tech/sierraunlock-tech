/* =====================================================================
   SIERRAUNLOCK • CORE ENGINE v5
   v5: animated rotator line auto-injected into EVERY page hero.
   ===================================================================== */
'use strict';

/* 1 • CENTRAL WHATSAPP DESK SWITCH (all flows → Alhassan) */
(function () {
  const orig = window.open.bind(window);
  window.open = function (url, ...rest) {
    if (typeof url === 'string') url = url.replace('wa.me/23231363736', 'wa.me/232754378475');
    return orig(url, ...rest);
  };
})();

/* 2 • ACCOUNT GATE — sign-in required to buy, sell or list */
(function () {
  const GATED = ['unlockForm', 'repairForm', 'sellForm', 'shopForm', 'resForm', 'bizForm'];
  const user = () => sessionStorage.getItem('su_user');
  const need = () => {
    alert('🔐 Create your free SIERRAUNLOCK account (or sign in) to buy, sell or list — 1 minute, and it protects you from fraud.');
    location.href = 'auth.html?next=' + encodeURIComponent(location.pathname);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.btn-wa');
    if (a && (a.getAttribute('href') || '').includes('wa.me') && !user()) { e.preventDefault(); e.stopImmediatePropagation(); need(); }
  }, true);
  document.addEventListener('submit', (e) => {
    if (GATED.includes(e.target.id) && !user()) { e.preventDefault(); e.stopImmediatePropagation(); need(); }
  }, true);
})();

const SITE_VERSION = localStorage.getItem('su_version') || 'v1.4.0 • build 2026-09-02';

const TOOLS = [
  { icon:'🔓', name:'Unlock Codes',        tag:'All Brands',      img:null },
  { icon:'🧠', name:'FRP Reset',           tag:'Owner-Verified',  img:null },
  { icon:'⚡', name:'Flashing & Firmware', tag:'Software',        img:null },
  { icon:'📡', name:'Network Config',      tag:'GSM • LTE',       img:null },
  { icon:'🔩', name:'Screen Replacement',  tag:'Hardware',        img:null },
  { icon:'🔋', name:'Battery Swap',        tag:'Hardware',        img:null },
  { icon:'🧩', name:'Chip-Level Repair',   tag:'Board Work',      img:null },
  { icon:'💾', name:'Data Recovery',       tag:'Careful Handling',img:null },
  { icon:'💻', name:'Laptop Repair',       tag:'Computer',        img:null },
  { icon:'🧰', name:'Genuine Spare Parts', tag:'Marketplace',     img:null },
  { icon:'✅', name:'Legal IMEI Check',    tag:'Compliance',      img:null },
  { icon:'🛡️', name:'OS Optimization',     tag:'Performance',     img:null }
];

const ROTATOR_PHRASES = [
  'Any Brand. Any Network.',
  'iPhone • Samsung • Tecno',
  'Infinix • Itel • Nokia',
  'Huawei • Xiaomi • Google',
  'Legal. Certified. Trusted.'
];

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href*="wa.me/23231363736"]').forEach(a => a.href = a.href.replace('23231363736', '232754378475'));
  injectResellerLink();
  injectAccountLink();
  injectPageRotator();
  initNav();
  initRotator();
  initYearVersion();
  initActiveNav();
  initToolsMarquee();
  initReveal();
});

/* NEW v5: put the animated green line inside EVERY page hero */
function injectPageRotator() {
  if (document.getElementById('rotatorText')) return;           /* index already has it */
  const h1 = document.querySelector('section[class*="hero"] h1'); /* matches .hero, .services-hero, .mkt-hero, .shops-hero, .pay-hero, .res-hero … */
  if (!h1) return;
  const br = document.createElement('br');
  const span = document.createElement('span');
  span.className = 'rotator';
  span.id = 'rotatorText';
  span.textContent = ROTATOR_PHRASES[0];
  h1.appendChild(br);
  h1.appendChild(span);
}

function injectResellerLink() {
  const nav = document.getElementById('mainNav');
  if (!nav || nav.querySelector('[href="reseller.html"]')) return;
  const a = document.createElement('a');
  a.className = 'nav-link'; a.href = 'reseller.html'; a.textContent = 'Resellers';
  const faq = nav.querySelector('[href="faq.html"]');
  if (faq) nav.insertBefore(a, faq); else nav.appendChild(a);
}

function injectAccountLink() {
  const nav = document.getElementById('mainNav');
  if (!nav || nav.querySelector('#acctLink')) return;
  const a = document.createElement('a');
  a.className = 'nav-link'; a.id = 'acctLink'; a.href = 'auth.html';
  let name = '';
  try { name = (JSON.parse(localStorage.getItem('su_profile') || '{}').name || ''); } catch (e) {}
  a.textContent = sessionStorage.getItem('su_user') ? ('👤 ' + (name || 'Account')) : '👤 Sign In';
  nav.appendChild(a);
}

function initNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? '✕' : '☰';
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '☰';
  }));
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove('open'); toggle.textContent = '☰';
    }
  });
}

function initRotator() {
  const el = document.getElementById('rotatorText');
  if (!el) return;
  let i = 0;
  setInterval(() => {
    i = (i + 1) % ROTATOR_PHRASES.length;
    el.classList.remove('swap'); void el.offsetWidth;
    el.textContent = ROTATOR_PHRASES[i];
    el.classList.add('swap');
  }, 2800);
}

function initYearVersion() {
  const y = document.getElementById('year');
  const v = document.getElementById('siteVersion');
  if (y) y.textContent = new Date().getFullYear();
  if (v) v.textContent = SITE_VERSION;
}

function initActiveNav() {
  const page = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

function initToolsMarquee() {
  const anchor = document.querySelector('.legal-strip');
  if (!anchor || document.getElementById('toolsSection')) return;
  const section = document.createElement('section');
  section.className = 'tools-section'; section.id = 'toolsSection';
  section.innerHTML = `
    <div class="section-head">
      <h2>Our Tools &amp; Services — Live in Motion</h2>
      <div class="underline"></div>
      <p>The full arsenal we work with daily. Hover to pause, click a service page to book.</p>
    </div>
    <div class="marquee"><div class="marquee-track" id="toolsTrack"></div></div>`;
  anchor.insertAdjacentElement('afterend', section);
  const track = section.querySelector('#toolsTrack');
  const buildCard = (t) => {
    const card = document.createElement('article');
    card.className = 'tool-card';
    const icon = document.createElement('div');
    icon.className = 'tool-icon';
    if (t.img) {
      const im = document.createElement('img');
      im.src = 'assets/images/tools/' + t.img;
      im.alt = t.name;
      im.onerror = () => { icon.textContent = t.icon; };
      icon.appendChild(im);
    } else { icon.textContent = t.icon; }
    const txt = document.createElement('div');
    txt.innerHTML = `<div class="tool-name"></div><div class="tool-tag"></div>`;
    txt.querySelector('.tool-name').textContent = t.name;
    txt.querySelector('.tool-tag').textContent = t.tag;
    card.appendChild(icon); card.appendChild(txt);
    return card;
  };
  [...TOOLS, ...TOOLS].forEach(t => track.appendChild(buildCard(t)));
}

function initReveal() {
  const targets = document.querySelectorAll('.card, .founder-card, .stat, .section-head, .badge, .tool-card');
  if (!targets.length || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('reveal-in')); return;
  }
  targets.forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i % 6) * 70 + 'ms'; });
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('reveal-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  targets.forEach(el => io.observe(el));
}