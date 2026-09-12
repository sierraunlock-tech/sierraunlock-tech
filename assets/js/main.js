/* =====================================================================
   SIERRAUNLOCK • CORE ENGINE — main.js (v9.7 • FINAL PACK)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The "Master Brain" on EVERY page.

   v9.7 FINAL FEATURES:
   • SIERRA Assistant auto-reply chatbot
   • Premium polish.css injector
   • Services mega-menu with Policy link
   • WhatsApp number normalization
   • Account gate
   • Hero rotator
   • Tools marquee
   • Scroll reveal
   • Mobile navigation

   CRITICAL NUMBER MAP:
   • Alhassan desk / Orange Money / WhatsApp : +232 75 908 206
   • Binance Pay ID                         : 754378475
   • Baimba / Koidu hub                     : +232 31 363 736

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
    alert('🔐 Create your free SIERRAUNLOCK account or sign in to continue. It protects you from fraud.');
    location.href = 'auth.html?next=' + encodeURIComponent(location.pathname);
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.btn-wa');
    if (a && (a.getAttribute('href') || '').includes('wa.me') && !user()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      need();
    }
  }, true);

  document.addEventListener('submit', (e) => {
    if (GATED.includes(e.target.id) && !user()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      need();
    }
  }, true);
})();

/* 03 • CONSTANTS */
const SITE_VERSION = localStorage.getItem('su_version') || 'v2.1.0 • build 2026-09-12';

const TOOLS = [
  { icon:'🔓', name:'Unlock Codes',        tag:'All Brands',       img:null },
  { icon:'🧠', name:'FRP Reset',           tag:'Owner-Verified',   img:null },
  { icon:'⚡', name:'Flashing & Firmware', tag:'Software',         img:null },
  { icon:'📡', name:'Network Config',      tag:'GSM • LTE',        img:null },
  { icon:'🔩', name:'Screen Replacement',  tag:'Hardware',         img:null },
  { icon:'🔋', name:'Battery Swap',        tag:'Hardware',         img:null },
  { icon:'🧩', name:'Chip-Level Repair',   tag:'Board Work',       img:null },
  { icon:'💾', name:'Data Recovery',       tag:'Careful Handling', img:null },
  { icon:'💻', name:'Laptop Repair',       tag:'Computer',         img:null },
  { icon:'🧰', name:'Genuine Spare Parts', tag:'Marketplace',      img:null },
  { icon:'✅', name:'Legal IMEI Check',    tag:'Compliance',       img:null },
  { icon:'🛡️', name:'OS Optimization',     tag:'Performance',      img:null }
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
  injectServicesMegaMenu();
  injectPageRotator();
  initNav();
  initRotator();
  initYearVersion();
  initActiveNav();
  initToolsMarquee();
  initReveal();
  initSierraAssistant();
  initPolishLayer();
});

/* 05 • GLOBAL ESCAPE HELPER */
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c];
  });
}

/* 06 • NUMBER NORMALIZER */
function normalizeNumbers() {
  const HREF_MAP = [
    ['tel:+232754378475', 'tel:+23275908206'],
    ['tel:+23233469056',  'tel:+23275908206']
  ];

  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    HREF_MAP.forEach(([from, to]) => {
      if (a.getAttribute('href') === from) a.setAttribute('href', to);
    });
  });

  const TEXT_MAP = [
    ['+232 75 437 8475', '+232 75 908 206'],
    ['+232 33 469 056',  '+232 75 908 206']
  ];

  if (!document.body) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];

  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(n => {
    let t = n.nodeValue;
    let changed = false;

    TEXT_MAP.forEach(([from, to]) => {
      if (t.includes(from)) {
        t = t.split(from).join(to);
        changed = true;
      }
    });

    if (changed) n.nodeValue = t;
  });
}

/* 07 • HERO ROTATOR INJECTOR */
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

/* 08 • NAV LINK INJECTORS */
function injectResellerLink() {
  const nav = document.getElementById('mainNav');
  if (!nav || nav.querySelector('[href="reseller.html"]')) return;

  const a = document.createElement('a');
  a.className = 'nav-link';
  a.href = 'reseller.html';
  a.textContent = 'Resellers';

  const faq = nav.querySelector('[href="faq.html"]');
  if (faq) nav.insertBefore(a, faq);
  else nav.appendChild(a);
}

function injectAccountLink() {
  const nav = document.getElementById('mainNav');
  if (!nav || nav.querySelector('#acctLink')) return;

  const a = document.createElement('a');
  a.className = 'nav-link';
  a.id = 'acctLink';
  a.href = 'auth.html';

  let name = '';
  try {
    name = JSON.parse(localStorage.getItem('su_profile') || '{}').name || '';
  } catch (e) {}

  a.textContent = sessionStorage.getItem('su_user')
    ? ('👤 ' + (name || 'Account'))
    : '👤 Sign In';

  nav.appendChild(a);
}

/* 09 • SERVICES MEGA MENU */
function injectServicesMegaMenu() {
  const HREF = 'live-services.html';

  document.querySelectorAll('a[href="' + HREF + '"]').forEach(function (a) {
    if (!a.closest('#mainNav')) a.remove();
  });

  const old = document.getElementById('suMegaMenu');
  if (old) old.remove();

  if (!document.getElementById('suMegaCss')) {
    const css = document.createElement('style');
    css.id = 'suMegaCss';
    css.textContent = [
      '.su-wrap{position:relative;display:inline-block}',
      '.su-mega{display:none;position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#fff;border:1px solid #e1ecf4;border-radius:16px;box-shadow:0 18px 50px rgba(11,31,51,.18);padding:20px;grid-template-columns:repeat(3,minmax(210px,1fr));gap:20px;z-index:9999;min-width:660px;animation:suMegaIn .18s ease}',
      '@keyframes suMegaIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
      '.su-wrap:hover .su-mega,.su-wrap:focus-within .su-mega,.su-wrap.open .su-mega{display:grid}',
      '.su-mega h4{font-size:11.5px;letter-spacing:.8px;text-transform:uppercase;color:#0072C6;margin:0 0 10px;font-weight:800}',
      '.su-mega a{display:block;padding:8px 10px;border-radius:9px;color:#12263a;text-decoration:none;font-size:13.5px;line-height:1.3;transition:background .15s,color .15s}',
      '.su-mega a:hover,.su-mega a:focus{background:#eef6ff;color:#0072C6}',
      '.su-mega .hot{background:linear-gradient(120deg,#1EB53A,#0072C6);color:#fff;font-weight:700}',
      '.su-mega .hot:hover{filter:brightness(1.08);color:#fff}',
      '@media(max-width:900px){.su-wrap{display:block}.su-mega{position:static;min-width:0;transform:none;grid-template-columns:1fr;padding:10px;box-shadow:none;border:0;animation:none}.su-wrap:hover .su-mega{display:none}.su-wrap.open .su-mega{display:grid}}'
    ].join('');
    document.head.appendChild(css);
  }

  const nav = document.getElementById('mainNav');
  if (!nav) return;

  const nodes = Array.prototype.slice.call(nav.querySelectorAll('li, div, a, button, span'));
  const trigger = nodes.find(function (el) {
    const t = (el.textContent || '').trim().toLowerCase();
    return t === 'services' || t === 'services ▾' || t.indexOf('services') === 0;
  });

  if (!trigger) return;

  let wrap = trigger.closest('li, div.dropdown, [class*="drop"]');

  if (!wrap || wrap === nav) {
    wrap = document.createElement('span');
    wrap.className = 'su-wrap';
    trigger.parentNode.insertBefore(wrap, trigger);
    wrap.appendChild(trigger);
  } else {
    wrap.classList.add('su-wrap');
  }

  const mega = document.createElement('div');
  mega.className = 'su-mega';
  mega.id = 'suMegaMenu';

  mega.innerHTML =
    '<div class="su-col"><h4>🔓 Unlock Services</h4>' +
      '<a class="hot" href="live-services.html">⚡ Live Catalog — Buy Now</a>' +
      '<a href="live-services.html#g=network">🌐 Network & Carrier Unlock</a>' +
      '<a href="live-services.html#g=frp">🧠 FRP / iCloud / Passcode Bypass</a>' +
      '<a href="live-services.html#g=checks">✅ IMEI & Info Checks</a>' +
      '<a href="live-services.html#g=tools">🧰 Tool Licenses</a>' +
    '</div>' +

    '<div class="su-col"><h4>📦 Order Tools</h4>' +
      '<a href="live-services.html">🛒 Place Order</a>' +
      '<a href="track.html">📍 Track My Order</a>' +
      '<a href="auth.html">📜 Order History</a>' +
      '<a href="services.html">📁 File Service</a>' +
      '<a href="reseller.html">🖥 Server Service</a>' +
    '</div>' +

    '<div class="su-col"><h4>👤 My Account</h4>' +
      '<a href="auth.html">🔐 Sign In / Create Account</a>' +
      '<a href="reseller.html">🤝 Become a Reseller</a>' +
      '<a href="payments.html">💳 Payments</a>' +
      '<a href="faq.html">❓ Help & FAQ</a>' +
      '<a href="policy.html">📋 Terms & Refund Policy</a>' +
    '</div>';

  wrap.appendChild(mega);

  trigger.addEventListener('click', function (e) {
    if (window.innerWidth <= 900) {
      e.preventDefault();
      wrap.classList.toggle('open');
    }
  });
}

/* 10 • HAMBURGER MENU */
function initNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');

  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? '✕' : '☰';
  });

  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      if (a.closest('.su-mega')) return;
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    });
  });

  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove('open');
      toggle.textContent = '☰';
    }
  });
}

/* 11 • ROTATOR ENGINE */
function initRotator() {
  const el = document.getElementById('rotatorText');
  if (!el) return;

  let i = 0;

  setInterval(() => {
    i = (i + 1) % ROTATOR_PHRASES.length;
    el.classList.remove('swap');
    void el.offsetWidth;
    el.textContent = ROTATOR_PHRASES[i];
    el.classList.add('swap');
  }, 2800);
}

/* 12 • YEAR + VERSION FOOTER */
function initYearVersion() {
  const y = document.getElementById('year');
  const v = document.getElementById('siteVersion');

  if (y) y.textContent = new Date().getFullYear();
  if (v) v.textContent = SITE_VERSION;
}

/* 13 • ACTIVE NAV HIGHLIGHTER */
function initActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

/* 14 • TOOLS MARQUEE INJECTOR */
function initToolsMarquee() {
  const anchor = document.querySelector('.legal-strip');
  if (!anchor || document.getElementById('toolsSection')) return;

  const section = document.createElement('section');
  section.className = 'tools-section';
  section.id = 'toolsSection';

  section.innerHTML = `
    <div class="section-head">
      <h2>Our Tools &amp; Services — Live in Motion</h2>
      <div class="underline"></div>
      <p>The full arsenal we work with daily. Hover to pause, click a service page to book.</p>
    </div>
    <div class="marquee">
      <div class="marquee-track" id="toolsTrack"></div>
    </div>`;

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
    } else {
      icon.textContent = t.icon;
    }

    const txt = document.createElement('div');
    txt.innerHTML = '<div class="tool-name"></div><div class="tool-tag"></div>';
    txt.querySelector('.tool-name').textContent = t.name;
    txt.querySelector('.tool-tag').textContent = t.tag;

    card.appendChild(icon);
    card.appendChild(txt);

    return card;
  };

  [...TOOLS, ...TOOLS].forEach(t => track.appendChild(buildCard(t)));
}

/* 15 • SCROLL REVEAL */
function initReveal() {
  const targets = document.querySelectorAll(
    '.card, .founder-card, .stat, .section-head, .badge, .tool-card, .philosophy-card, .timeline-item, .reveal'
  );

  if (!targets.length || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('reveal-in'));
    return;
  }

  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 6) * 70 + 'ms';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('reveal-in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });

  targets.forEach(el => io.observe(el));
}

/* 16 • SMART RETURN MODE */
(function () {
  if (sessionStorage.getItem('su_seen') === '1') {
    document.documentElement.classList.add('su-returning');
  } else {
    sessionStorage.setItem('su_seen', '1');
  }
})();

/* 17 • SIERRA ASSISTANT AUTO-REPLY BOT */
function initSierraAssistant() {
  if (location.pathname.includes('admin-orders')) return;
  if (document.getElementById('sierraAssistant')) return;

  if (!document.getElementById('sierraAssistantCss')) {
    const css = document.createElement('style');
    css.id = 'sierraAssistantCss';
    css.textContent = [
      '#sierraAssistant{position:fixed;bottom:24px;right:24px;z-index:9998;font-family:Segoe UI,Arial,sans-serif}',
      '#saBtn{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1EB53A,#0072C6);border:0;color:#fff;font-size:28px;cursor:pointer;box-shadow:0 8px 24px rgba(30,181,58,.4);transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center;position:relative}',
      '#saBtn:hover{transform:scale(1.08);box-shadow:0 12px 32px rgba(30,181,58,.5)}',
      '#saBtn.pulse::after{content:"";position:absolute;width:64px;height:64px;border-radius:50%;background:rgba(30,181,58,.4);animation:saPulse 2s infinite}',
      '@keyframes saPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.6);opacity:0}}',
      '#saBadge{position:absolute;top:-4px;right:-4px;background:#e74c3c;color:#fff;font-size:11px;font-weight:700;padding:4px 8px;border-radius:10px;min-width:20px;text-align:center}',
      '#saWindow{position:absolute;bottom:80px;right:0;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(11,31,51,.25);display:none;flex-direction:column;overflow:hidden;animation:saWindowIn .25s ease}',
      '#saWindow.open{display:flex}',
      '@keyframes saWindowIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
      '#saHeader{background:linear-gradient(135deg,#1EB53A,#0072C6);color:#fff;padding:16px 18px;display:flex;justify-content:space-between;align-items:center}',
      '#saHeader .title{display:flex;align-items:center;gap:10px}',
      '#saHeader .avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px}',
      '#saHeader .name{font-weight:700;font-size:15px;line-height:1.2}',
      '#saHeader .status{font-size:11.5px;opacity:.9;display:flex;align-items:center;gap:6px}',
      '#saHeader .dot{width:8px;height:8px;border-radius:50%;background:#7dff9b}',
      '#saClose{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:6px}',
      '#saClose:hover{background:rgba(255,255,255,.15)}',
      '#saBody{flex:1;overflow-y:auto;padding:16px;background:#f4f8fb;display:flex;flex-direction:column;gap:10px}',
      '.sa-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.45;word-wrap:break-word;animation:saMsgIn .25s ease}',
      '@keyframes saMsgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
      '.sa-msg.bot{background:#fff;color:#12263a;border:1px solid #e1ecf4;align-self:flex-start;border-bottom-left-radius:4px}',
      '.sa-msg.user{background:linear-gradient(135deg,#1EB53A,#0072C6);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
      '.sa-msg a{color:#0072C6;font-weight:700;text-decoration:none}',
      '.sa-msg.user a{color:#fff;text-decoration:underline}',
      '.sa-msg.bot strong{color:#1EB53A}',
      '#saQuickReplies{padding:8px 16px 12px;background:#f4f8fb;border-top:1px solid #e1ecf4;display:flex;gap:6px;flex-wrap:wrap}',
      '.sa-qr{background:#fff;border:1.5px solid #d5e3ee;color:#0072C6;padding:7px 12px;border-radius:16px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s}',
      '.sa-qr:hover{background:#0072C6;color:#fff;border-color:#0072C6}',
      '#saInput{display:flex;padding:10px 12px;gap:8px;background:#fff;border-top:1px solid #e1ecf4}',
      '#saInput input{flex:1;padding:10px 14px;border:1.5px solid #d5e3ee;border-radius:20px;font-size:14px;outline:none}',
      '#saInput input:focus{border-color:#0072C6}',
      '#saInput button{background:linear-gradient(135deg,#1EB53A,#0072C6);border:0;color:#fff;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '.sa-typing{display:inline-flex;gap:4px;padding:4px 0}',
      '.sa-typing span{width:6px;height:6px;border-radius:50%;background:#8a9bab;animation:saTyping 1.2s infinite}',
      '.sa-typing span:nth-child(2){animation-delay:.15s}',
      '.sa-typing span:nth-child(3){animation-delay:.3s}',
      '@keyframes saTyping{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}',
      '@media(max-width:480px){#sierraAssistant{bottom:16px;right:16px}#saWindow{width:calc(100vw - 32px);height:calc(100vh - 100px);bottom:72px}#saBtn{width:56px;height:56px;font-size:24px}}'
    ].join('');
    document.head.appendChild(css);
  }

  const KB = [
    {
      keywords: ['price','cost','how much','fee','charge','expensive','cheap','affordable'],
      response: 'We add a flat <strong>$2 USD</strong> to every wholesale service.<br><br>Examples:<br>• Small check → <strong>$2.10</