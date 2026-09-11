/* =====================================================================
   SIERRAUNLOCK • CORE ENGINE — main.js (v9 • LIVE CATALOG LINK ADDED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The "Master Brain" that runs on EVERY page of the website. It:
   • Routes every WhatsApp flow to Alhassan's correct business desk
   • Normalizes wrong/outdated phone numbers automatically on load
   • Blocks unauthenticated users from buying/selling/listing (account gate)
   • Injects the animated rotator line into every hero
   • Injects the Tools & Services marquee under the legal strip
   • Powers the mobile hamburger menu, scroll reveal, year/version footer
   • Smart Return Mode — pages open instantly after first visit
   • NEW (v9): Auto-injects "Live Unlock Catalog (Buy Now)" under the
     Services menu on EVERY page so customers can buy from the live
     251-service FastUnlockers catalog directly from sierraunlock.com

   SECTION MAP:
   01  Central WhatsApp desk switch (all flows → Alhassan 23275908206)
   02  Account gate (sign-in required for protected forms)
   03  Constants: site version, tool catalog, rotator phrases
   04  Boot: DOMContentLoaded handlers + number normalization
   05  Number normalizer (fixes wrong numbers automatically on every page)
   06  Hero rotator injector (adds animated brand line to every hero)
   07  Nav link injectors (Resellers + Account link)
   07b NEW: Live Catalog link injector under Services menu (site-wide)
   08  Hamburger menu (mobile nav drawer)
   09  Rotator engine (cycles brand phrases every 2.8 s)
   10  Year + version footer injector
   11  Active nav link highlighter
   12  Tools marquee injector
   13  Scroll reveal (IntersectionObserver)
   14  Smart Return Mode (animations play once per session)

   CRITICAL NUMBER MAP (do not change without updating the normalizer):
   • Alhassan phone / Orange Money / WhatsApp desk : +232 75 908 206
   • Alhassan Binance Pay ID (crypto ONLY)         : 754378475
   • Baimba phone / Koidu hub                      : +232 31 363 736

   LIVE CATALOG NOTE (v9):
   The Live Unlock Catalog page (live-services.html) displays 251 real
   services from FastUnlockers with Alhassan's wholesale cost x 1.8
   margin baked in. The link is auto-injected under Services so customers
   on any page can jump directly to buy. The admin-orders.html page
   (founder fulfilment desk) is intentionally NOT linked publicly —
   founders open it by direct URL only (money safety).

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   ===================================================================== */
'use strict';

/* 01 • CENTRAL WHATSAPP DESK SWITCH — forces all wa.me flows to Alhassan's real phone */
(function () {
  const orig = window.open.bind(window);
  window.open = function (url, ...rest) {
    if (typeof url === 'string') {
      url = url
        .replace('wa.me/23231363736',  'wa.me/23275908206')   /* Baimba → Alhassan desk */
        .replace('wa.me/232754378475', 'wa.me/23275908206')   /* Binance ID misused as phone → Alhassan */
        .replace('wa.me/23233469056',  'wa.me/23275908206');  /* legacy number → Alhassan */
    }
    return orig(url, ...rest);
  };
})();

/* 02 • ACCOUNT GATE — blocks gated forms until user signs in */
(function () {
  const GATED = ['unlockForm', 'repairForm', 'sellForm', 'shopForm', 'resForm', 'bizForm'];
  const user = () => sessionStorage.getItem('su_user');
  const need = () => {
    alert('🔐 Create your free SIERRAUNLOCK account (or sign in) to buy, sell or list — 1 minute, and it protects you from fraud.');
    location.href = 'auth.html?next=' + encodeURIComponent(location.pathname);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.btn-wa');
    if (a && (a.getAttribute('href') || '').includes('wa.me') && !user()) {
      e.preventDefault(); e.stopImmediatePropagation(); need();
    }
  }, true);
  document.addEventListener('submit', (e) => {
    if (GATED.includes(e.target.id) && !user()) {
      e.preventDefault(); e.stopImmediatePropagation(); need();
    }
  }, true);
})();

/* 03 • CONSTANTS — site version, tool catalog, rotator phrases */
const SITE_VERSION = localStorage.getItem('su_version') || 'v2.0.0 • build 2026-09-06';

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

/* 04 • BOOT — runs once the DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
  /* first thing: fix any leftover wrong WhatsApp links in the HTML */
  document.querySelectorAll('a[href*="wa.me/"]').forEach(a => {
    a.href = a.href
      .replace('23231363736',  '23275908206')
      .replace('232754378475', '23275908206')
      .replace('23233469056',  '23275908206');
  });

  normalizeNumbers();
  injectResellerLink();
  injectAccountLink();
  injectLiveCatalogLink();   /* NEW v9 — puts Live Catalog under Services everywhere */
  injectPageRotator();
  initNav();
  initRotator();
  initYearVersion();
  initActiveNav();
  initToolsMarquee();
  initReveal();
});

/* 05 • NUMBER NORMALIZER — fixes wrong tel: links AND visible text automatically */
function normalizeNumbers() {
  /* fix tel: hrefs */
  const HREF_MAP = [
    ['tel:+232754378475', 'tel:+23275908206'],   /* Binance ID misused as phone */
    ['tel:+23233469056',  'tel:+23275908206']    /* legacy removed number */
  ];
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    HREF_MAP.forEach(([f, t]) => { if (a.getAttribute('href') === f) a.setAttribute('href', t); });
  });

  /* fix visible text across the whole page */
  const TEXT_MAP = [
    ['+232 75 437 8475', '+232 75 908 206'],
    ['+232 33 469 056',  '+232 75 908 206']
  ];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    let t = n.nodeValue, changed = false;
    TEXT_MAP.forEach(([f, r]) => {
      if (t.includes(f)) { t = t.split(f).join(r); changed = true; }
    });
    if (changed) n.nodeValue = t;
  });
}

/* 06 • HERO ROTATOR INJECTOR — adds animated brand line to every hero (except index) */
function injectPageRotator() {
  if (document.getElementById('rotatorText')) return;   /* index already has it */
  const h1 = document.querySelector('section[class*="hero"] h1');
  if (!h1) return;
  const br = document.createElement('br');
  const span = document.createElement('span');
  span.className = 'rotator';
  span.id = 'rotatorText';
  span.textContent = ROTATOR_PHRASES[0];
  h1.appendChild(br);
  h1.appendChild(span);
}

/* 07 • NAV LINK INJECTORS — Resellers + Account (sign in / profile) */
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
  a.textContent = sessionStorage.getItem('su_user')
    ? ('👤 ' + (name || 'Account'))
    : '👤 Sign In';
  nav.appendChild(a);
}

/* 07b • LIVE CATALOG LINK INJECTOR (v9)
   Auto-adds "Live Unlock Catalog (Buy Now)" link under the Services menu
   on EVERY page of the site. Safe: never duplicates, never breaks existing
   menus. Tries three strategies in order:
     1. Find a "Services" nav link with a dropdown sibling → append into it
     2. Find the "Services" nav link → insert link right after it
     3. Fallback: append to #mainNav or <header>
   Purpose: let customers on any page jump to the live 251-service catalog
   (live-services.html) where they can buy real FastUnlockers services
   with prices in USD and Leone. */
function injectLiveCatalogLink() {
  const LABEL = 'Live Unlock Catalog (Buy Now)';
  const HREF  = 'live-services.html';
  if (document.querySelector('a[href="' + HREF + '"]')) return; /* already there */

  /* find every element that looks like the "Services" nav trigger */
  const triggers = [].slice.call(document.querySelectorAll('a, button, span, div'))
    .filter(function (el) {
      return el.children.length === 0 &&
        (el.textContent || '').trim().toLowerCase() === 'services';
    });

  let placed = false;

  /* Strategy 1: inject into an existing dropdown/menu next to Services */
  triggers.forEach(function (t) {
    if (placed) return;
    const parent = t.closest('li, .dropdown, [class*="drop"], nav') || t.parentElement;
    if (!parent) return;
    const menu = parent.querySelector(
      'ul, .dropdown-content, .dropdown-menu, [class*="menu"], [class*="content"]'
    );
    if (menu && menu !== t && menu !== parent) {
      const a = document.createElement('a');
      a.href = HREF; a.textContent = LABEL;
      if (menu.firstElementChild) a.className = menu.firstElementChild.className || '';
      menu.appendChild(a);
      placed = true;
    }
  });

  /* Strategy 2: insert link as sibling right after the Services trigger */
  if (!placed && triggers.length) {
    const t2 = triggers[0];
    const a2 = document.createElement('a');
    a2.href = HREF; a2.textContent = 'Live Services';
    if (t2.className) a2.className = t2.className;
    t2.parentNode.insertBefore(a2, t2.nextSibling);
    placed = true;
  }

  /* Strategy 3: last-resort append into <nav> or <header> */
  if (!placed) {
    const nav = document.querySelector('#mainNav, nav, header');
    if (nav) {
      const a3 = document.createElement('a');
      a3.href = HREF; a3.textContent = 'Live Services';
      a3.className = 'nav-link';
      nav.appendChild(a3);
    }
  }
}

/* 08 • HAMBURGER MENU — mobile nav drawer */
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

/* 09 • ROTATOR ENGINE — cycles brand phrases every 2.8 seconds */
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

/* 10 • YEAR + VERSION FOOTER INJECTOR */
function initYearVersion() {
  const y = document.getElementById('year');
  const v = document.getElementById('siteVersion');
  if (y) y.textContent = new Date().getFullYear();
  if (v) v.textContent = SITE_VERSION;
}

/* 11 • ACTIVE NAV LINK HIGHLIGHTER — highlights the current page */
function initActiveNav() {
  const page = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

/* 12 • TOOLS MARQUEE INJECTOR — auto-inserts under the legal strip */
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

/* 13 • SCROLL REVEAL — fades elements in as they enter the viewport */
function initReveal() {
  const targets = document.querySelectorAll(
    '.card, .founder-card, .stat, .section-head, .badge, .tool-card, .philosophy-card, .timeline-item, .reveal'
  );
  if (!targets.length || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('reveal-in')); return;
  }
  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 6) * 70 + 'ms';
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('reveal-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  targets.forEach(el => io.observe(el));
}

/* 14 • SMART RETURN MODE — animations play once per session; return visits open instantly */
(function () {
  if (sessionStorage.getItem('su_seen') === '1') {
    document.documentElement.classList.add('su-returning');   /* skip entrance replays */
  } else {
    sessionStorage.setItem('su_seen', '1');                   /* first visit: play the show */
  }
})();