/* =====================================================================
   SIERRAUNLOCK • CORE ENGINE — main.js (v9.4 • PROFESSIONAL MEGA MENU)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The "Master Brain" on EVERY page. v9.4 replaces the old single link
   with a PROFESSIONAL 3-COLUMN MEGA MENU under "Services", mirroring
   the FastUnlockers client-area structure (Place Order / IMEI Service /
   File Service / Server Service / Order History / My Account) but
   branded for SIERRAUNLOCK customers:
     COLUMN 1 — Unlock Services (Live Catalog, Network, FRP/iCloud,
                IMEI Checks, Tool Licenses)
     COLUMN 2 — Order Tools (Place Order, Track Order, Order History,
                File Service, Server Service)
     COLUMN 3 — My Account (Sign In, Reseller, Payments, Help)
   • Animated fade/slide, hover + keyboard accessible
   • Mobile: stacks inside the hamburger drawer (tap Services to open)
   • Fits phones, tablets, laptops, desktops (responsive grid)
   • Also keeps: WhatsApp desk switch, account gate, number normalizer,
     hero rotator, tools marquee, scroll reveal, smart return mode

   SECTION MAP:
   01 WhatsApp desk switch      08 Hamburger menu
   02 Account gate              09 Rotator engine
   03 Constants                 10 Year + version footer
   04 Boot                      11 Active nav highlighter
   05 Number normalizer         12 Tools marquee injector
   06 Hero rotator injector     13 Scroll reveal
   07 Nav injectors             14 Smart Return Mode
   07b SERVICES MEGA MENU (v9.4) + stray-link cleanup

   CRITICAL NUMBER MAP:
   • Alhassan desk / Orange Money / WhatsApp : +232 75 908 206
   • Binance Pay ID (crypto ONLY)            : 754378475
   • Baimba / Koidu hub                      : +232 31 363 736

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   ===================================================================== */
'use strict';

/* 01 • CENTRAL WHATSAPP DESK SWITCH */
(function () {
  const orig = window.open.bind(window);
  window.open = function (url, ...rest) {
    if (typeof url === 'string') {
      url = url
        .replace('wa.me/23231363736',  'wa.me/23275908206')
        .replace('wa.me/232754378475', 'wa.me/23275908206')
        .replace('wa.me/23233469056',  'wa.me/23275908206');
    }
    return orig(url, ...rest);
  };
})();

/* 02 • ACCOUNT GATE */
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

/* 03 • CONSTANTS */
const SITE_VERSION = localStorage.getItem('su_version') || 'v2.1.0 • build 2026-09-12';

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

/* 04 • BOOT */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href*="wa.me/"]').forEach(a => {
    a.href = a.href
      .replace('23231363736',  '23275908206')
      .replace('232754378475', '23275908206')
      .replace('23233469056',  '23275908206');
  });
  normalizeNumbers();
  injectResellerLink();
  injectAccountLink();
  injectServicesMegaMenu();   /* v9.4 — professional dropdown */
  injectPageRotator();
  initNav();
  initRotator();
  initYearVersion();
  initActiveNav();
  initToolsMarquee();
  initReveal();
});

/* 05 • NUMBER NORMALIZER */
function normalizeNumbers() {
  const HREF_MAP = [
    ['tel:+232754378475', 'tel:+23275908206'],
    ['tel:+23233469056',  'tel:+23275908206']
  ];
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    HREF_MAP.forEach(([f, t]) => { if (a.getAttribute('href') === f) a.setAttribute('href', t); });
  });
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

/* 06 • HERO ROTATOR INJECTOR */
function injectPageRotator() {
  if (document.getElementById('rotatorText')) return;
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

/* 07 • NAV LINK INJECTORS — Resellers + Account */
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

/* 07b • SERVICES MEGA MENU (v9.4)
   Builds a professional 3-column dropdown under the Services nav item:
     col 1 Unlock Services  •  col 2 Order Tools  •  col 3 My Account
   Mirrors FastUnlockers client-area concepts (Place Order, IMEI/File/
   Server Service, Order History, My Account) in customer language.
   • Injects its own CSS once (animated, responsive, accessible)
   • Desktop: opens on hover / keyboard focus
   • Mobile: tap Services toggles it inside the hamburger drawer
   • Cleans stray old "Live Services" links from v9.0 first */
function injectServicesMegaMenu() {
  const HREF = 'live-services.html';

  /* cleanup strays from older versions */
  document.querySelectorAll('a[href="' + HREF + '"]').forEach(function (a) {
    if (!a.closest('#mainNav')) a.remove();
  });
  const old = document.getElementById('suMegaMenu');
  if (old) old.remove();

  /* inject CSS once */
  if (!document.getElementById('suMegaCss')) {
    const css = document.createElement('style');
    css.id = 'suMegaCss';
    css.textContent = [
      '.su-wrap{position:relative}',
      '.su-mega{display:none;position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#ffffff;border:1px solid #e1ecf4;border-radius:16px;box-shadow:0 18px 50px rgba(11,31,51,.18);padding:20px;grid-template-columns:repeat(3,minmax(210px,1fr));gap:20px;z-index:999;min-width:660px;animation:suMegaIn .18s ease}',
      '@keyframes suMegaIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
      '.su-wrap:hover .su-mega,.su-wrap:focus-within .su-mega,.su-wrap.open .su-mega{display:grid}',
      '.su-mega h4{font-size:11.5px;letter-spacing:.8px;text-transform:uppercase;color:#0072C6;margin:0 0 10px;font-weight:800}',
      '.su-mega a{display:block;padding:8px 10px;border-radius:9px;color:#12263a;text-decoration:none;font-size:13.5px;line-height:1.3;transition:background .15s,color .15s}',
      '.su-mega a:hover,.su-mega a:focus{background:#eef6ff;color:#0072C6}',
      '.su-mega .hot{background:linear-gradient(120deg,#1EB53A,#0072C6);color:#fff;font-weight:700}',
      '.su-mega .hot:hover{filter:brightness(1.08);color:#fff}',
      '@media(max-width:900px){.su-mega{position:static;min-width:0;transform:none;grid-template-columns:1fr;padding:10px;box-shadow:none;border:0;animation:none}.su-wrap.open .su-mega{display:grid}.su-wrap:hover .su-mega{display:none}.su-wrap.open .su-mega{display:grid}}'
    ].join('');
    document.head.appendChild(css);
  }

  const nav = document.getElementById('mainNav');
  if (!nav) return;

  /* find the Services trigger inside the navbar */
  const nodes = [].slice.call(nav.querySelectorAll('li, div, a, button, span'));
  const trigger = nodes.find(function (el) {
    const t = (el.textContent || '').trim().toLowerCase();
    return t === 'services' || t === 'services ▾' || t.indexOf('services') === 0;
  });
  if (!trigger) return;

  /* the container that will hold the mega menu (li / div.dropdown / trigger itself) */
  const wrap = (trigger.closest('li, div.dropdown, [class*="drop"]') || trigger);
  wrap.classList.add('su-wrap');

  const mega = document.createElement('div');
  mega.className = 'su-mega';
  mega.id = 'suMegaMenu';
  mega.innerHTML =
    '<div class="su-col"><h4>🔓 Unlock Services</h4>' +
      '<a class="hot" href="live-services.html">⚡ Live Catalog — Buy Now</a>' +
      '<a href="live-services.html#g=network">🌐 Network & Carrier Unlock</a>' +
      '<a href="live-services.html#g=frp">🧠 FRP / iCloud / Passcode Bypass</a>' +
      '<a href="live-services.html#g=checks">✅ IMEI & Info Checks</a>' +
      '<a href="live-services.html#g=tools">🧰 Tool Licenses (CM2, iAPro, iRemove)</a>' +
    '</div>' +
    '<div class="su-col"><h4>📦 Order Tools</h4>' +
      '<a href="live-services.html">🛒 Place Order (IMEI Service)</a>' +
      '<a href="track.html">📍 Track My Order</a>' +
      '<a href="auth.html">📜 Order History (Sign In)</a>' +
      '<a href="services.html">📁 File Service (Firmware / Flashing)</a>' +
      '<a href="reseller.html">🖥 Server Service (Reseller Credits)</a>' +
    '</div>' +
    '<div class="su-col"><h4>👤 My Account</h4>' +
      '<a href="auth.html">🔐 Sign In / Create Account</a>' +
      '<a href="reseller.html">🤝 Become a Reseller</a>' +
      '<a href="payments.html">💳 Payments (OM • Binance • Cash)</a>' +
      '<a href="faq.html">❓ Help & FAQ</a>' +
    '</div>';
  wrap.appendChild(mega);

  /* mobile: tap Services toggles the mega inside the drawer */
  trigger.addEventListener('click', function (e) {
    if (window.innerWidth <= 900) {
      e.preventDefault();
      wrap.classList.toggle('open');
    }
  });
}

/* 08 • HAMBURGER MENU */
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
    if (a.closest('.su-mega')) return;           /* mega links close drawer below */
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

/* 09 • ROTATOR ENGINE */
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

/* 10 • YEAR + VERSION FOOTER */
function initYearVersion() {
  const y = document.getElementById('year');
  const v = document.getElementById('siteVersion');
  if (y) y.textContent = new Date().getFullYear();
  if (v) v.textContent = SITE_VERSION;
}

/* 11 • ACTIVE NAV HIGHLIGHTER */
function initActiveNav() {
  const page = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

/* 12 • TOOLS MARQUEE INJECTOR */
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

/* 13 • SCROLL REVEAL */
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

/* 14 • SMART RETURN MODE */
(function () {
  if (sessionStorage.getItem('su_seen') === '1') {
    document.documentElement.classList.add('su-returning');
  } else {
    sessionStorage.setItem('su_seen', '1');
  }
})();