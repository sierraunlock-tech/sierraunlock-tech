/* =====================================================================
   SIERRAUNLOCK • CORE ENGINE — main.js (v10.1 CLEAN PROFESSIONAL • MEGA MENU)
   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   Fixes: WA desk single source, mega-menu click+hover, mobile drawer,
          null-safe, no heavy DOM walker, XSS hardened, NO DUPLICATE SIGN IN
   ===================================================================== */
'use strict';

/* 01 • WHATSAPP DESK SWITCH — single source +232 75 908 206 */
(function () {
  const orig = window.open.bind(window);
  window.open = function (url, ...rest) {
    if (typeof url === 'string' && url.includes('wa.me/')) {
      url = url
        .replace(/wa\.me\/23231363736/g, 'wa.me/23275908206')
        .replace(/wa\.me\/232754378475/g, 'wa.me/23275908206')
        .replace(/wa\.me\/23233469056/g, 'wa.me/23275908206');
    }
    return orig(url, ...rest);
  };
})();

/* 02 • ACCOUNT GATE */
(function () {
  const GATED = ['unlockForm', 'repairForm', 'sellForm', 'shopForm', 'resForm', 'bizForm'];
  const user = () => sessionStorage.getItem('su_user');
  const need = () => {
    alert('🔐 Create your free SIERRAUNLOCK account or sign in to continue.');
    location.href = 'auth.html?next=' + encodeURIComponent(location.pathname);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a.btn-wa');
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
const SITE_VERSION = localStorage.getItem('su_version') || 'v2.1.0 • build 2026-09-27';
const TOOLS = [
  { icon: '🔓', name: 'Unlock Codes', tag: 'All Brands', img: null },
  { icon: '🧠', name: 'FRP Reset', tag: 'Owner-Verified', img: null },
  { icon: '⚡', name: 'Flashing & Firmware', tag: 'Software', img: null },
  { icon: '📡', name: 'Network Config', tag: 'GSM • LTE', img: null },
  { icon: '🔩', name: 'Screen Replacement', tag: 'Hardware', img: null },
  { icon: '🔋', name: 'Battery Swap', tag: 'Hardware', img: null },
  { icon: '🧩', name: 'Chip-Level Repair', tag: 'Board Work', img: null },
  { icon: '💾', name: 'Data Recovery', tag: 'Careful Handling', img: null },
  { icon: '💻', name: 'Laptop Repair', tag: 'Computer', img: null },
  { icon: '🧰', name: 'Genuine Spare Parts', tag: 'Marketplace', img: null },
  { icon: '✅', name: 'Legal IMEI Check', tag: 'Compliance', img: null },
  { icon: '🛡️', name: 'OS Optimization', tag: 'Performance', img: null }
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
  document.querySelectorAll('a[href*="wa.me/"]').forEach((a) => {
    a.href = a.href.replace(/23231363736|232754378475|23233469056/g, '23275908206');
  });
  normalizeNumbers();
  injectResellerLink();
  injectAccountLink();
  initNavMega();
  injectPageRotator();
  initRotator();
  initYearVersion();
  initActiveNav();
  initToolsMarquee();
  initReveal();
  initSierraAssistant();
  initPolishLayer();
});

/* 05 • NUMBER NORMALIZER — lightweight */
function normalizeNumbers() {
  const HREF_MAP = {
    'tel:+232754378475': 'tel:+23275908206',
    'tel:+23233469056': 'tel:+23275908206'
  };
  document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
    const h = a.getAttribute('href');
    if (HREF_MAP[h]) a.setAttribute('href', HREF_MAP[h]);
  });
  document.querySelectorAll('footer,.footer-col').forEach((el) => {
    if (el.innerHTML.includes('75 437 8475') || el.innerHTML.includes('33 469 056')) {
      el.innerHTML = el.innerHTML
        .replace(/\+232 75 437 8475/g, '+232 75 908 206')
        .replace(/\+232 33 469 056/g, '+232 75 908 206');
    }
  });
}

/* 06 • HERO ROTATOR INJECT */
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

/* 07 • NAV LINKS */
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
  // ✅ FIX: Prevent duplicate "Sign In" by checking if ANY auth.html link already exists
  if (!nav || nav.querySelector('#acctLink') || nav.querySelector('[href="auth.html"]')) return;
  
  const a = document.createElement('a');
  a.className = 'nav-link';
  a.id = 'acctLink';
  a.href = 'auth.html';
  let name = '';
  try {
    name = JSON.parse(localStorage.getItem('su_profile') || '{}').name || '';
  } catch (e) {}
  a.textContent = sessionStorage.getItem('su_user') ? '👤 ' + (name || 'Account') : '👤 Sign In';
  nav.appendChild(a);
}

/* 08 • NAV + MEGA MENU + MOBILE PROFESSIONAL — v10 */
function initNavMega() {
  const mainNav = document.getElementById('mainNav');
  const navToggle = document.getElementById('navToggle');
  const servicesItem = document.getElementById('servicesNavItem');
  const servicesTrigger = document.getElementById('servicesTrigger');
  const servicesMega = document.getElementById('servicesMega');

  if (servicesItem && servicesMega) {
    const openMega = () => {
      servicesItem.classList.add('open');
      servicesTrigger?.setAttribute('aria-expanded', 'true');
    };
    const closeMega = () => {
      servicesItem.classList.remove('open');
      servicesTrigger?.setAttribute('aria-expanded', 'false');
    };

    servicesTrigger?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (servicesItem.classList.contains('open')) closeMega();
      else openMega();
    });

    let hoverTimer;
    servicesItem.addEventListener('mouseenter', () => {
      if (window.innerWidth > 1440) {
        clearTimeout(hoverTimer);
        openMega();
      }
    });
    servicesItem.addEventListener('mouseleave', () => {
      if (window.innerWidth > 1440) {
        hoverTimer = setTimeout(closeMega, 150);
      }
    });

    document.addEventListener('click', (e) => {
      if (!servicesItem.contains(e.target)) closeMega();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMega();
    });

    servicesMega.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 1440) {
          mainNav?.classList.remove('open');
          if (navToggle) {
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.textContent = '☰';
          }
        }
      });
    });
  }

  if (!navToggle || !mainNav) return;
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.textContent = open ? '✕' : '☰';
    document.body.style.overflow = open ? 'hidden' : '';
  });

  mainNav.querySelectorAll('a.nav-link:not(#servicesTrigger)').forEach((a) => {
    a.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.textContent = '☰';
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('click', (e) => {
    if (mainNav.classList.contains('open') && !mainNav.contains(e.target) && !navToggle.contains(e.target)) {
      mainNav.classList.remove('open');
      navToggle.textContent = '☰';
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
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
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = ROTATOR_PHRASES[i];
      el.style.opacity = '1';
    }, 200);
  }, 2800);
}

/* 10 • YEAR + VERSION */
function initYearVersion() {
  const y = document.getElementById('year');
  const v = document.getElementById('siteVersion');
  if (y) y.textContent = new Date().getFullYear();
  if (v) v.textContent = SITE_VERSION;
}

/* 11 • ACTIVE NAV */
function initActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === page) a.classList.add('active');
  });
}

/* 12 • TOOLS MARQUEE */
function initToolsMarquee() {
  const anchor = document.querySelector('.legal-strip');
  if (!anchor || document.getElementById('toolsSection')) return;
  const section = document.createElement('section');
  section.className = 'tools-section';
  section.id = 'toolsSection';
  section.innerHTML =
    '<div class="section-head"><h2>Our Tools & Services — Live in Motion</h2><div class="underline"></div><p>The full arsenal we work with daily. Hover to pause.</p></div><div class="marquee"><div class="marquee-track" id="toolsTrack"></div></div>';
  anchor.insertAdjacentElement('afterend', section);
  const track = section.querySelector('#toolsTrack');
  const buildCard = (t) => {
    const card = document.createElement('article');
    card.className = 'tool-card';
    const icon = document.createElement('div');
    icon.className = 'tool-icon';
    icon.textContent = t.icon;
    const txt = document.createElement('div');
    txt.innerHTML = '<div class="tool-name"></div><div class="tool-tag"></div>';
    txt.querySelector('.tool-name').textContent = t.name;
    txt.querySelector('.tool-tag').textContent = t.tag;
    card.appendChild(icon);
    card.appendChild(txt);
    return card;
  };
  [...TOOLS, ...TOOLS].forEach((t) => track.appendChild(buildCard(t)));
}

/* 13 • SCROLL REVEAL */
function initReveal() {
  const targets = document.querySelectorAll('.card,.founder-card,.stat,.section-head,.badge,.tool-card');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('reveal-in'));
    return;
  }
  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 6) * 70 + 'ms';
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('reveal-in');
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  targets.forEach((el) => io.observe(el));
}

/* 14 • SMART RETURN */
(function () {
  if (sessionStorage.getItem('su_seen') === '1') {
    document.documentElement.classList.add('su-returning');
  } else {
    sessionStorage.setItem('su_seen', '1');
  }
})();

/* 15 • SIERRA ASSISTANT — v10 cleaned */
function initSierraAssistant() {
  if (location.pathname.includes('admin-orders')) return;
  if (document.getElementById('sierraAssistant')) return;
  if (!document.getElementById('sierraAssistantCss')) {
    const css = document.createElement('style');
    css.id = 'sierraAssistantCss';
    css.textContent = [
      '#sierraAssistant{position:fixed;bottom:24px;right:24px;z-index:9998;font-family:Segoe UI,Arial,sans-serif}',
      '#saBtn{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1EB53A,#0072C6);border:0;color:#fff;font-size:28px;cursor:pointer;box-shadow:0 8px 24px rgba(30,181,58,.4);transition:transform .2s;display:flex;align-items:center;justify-content:center;position:relative}',
      '#saBtn:hover{transform:scale(1.08)}',
      '#saBtn.pulse::after{content:"";position:absolute;width:64px;height:64px;border-radius:50%;background:rgba(30,181,58,.4);animation:saPulse 2s infinite}',
      '@keyframes saPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.6);opacity:0}}',
      '#saBadge{position:absolute;top:-4px;right:-4px;background:#e74c3c;color:#fff;font-size:11px;font-weight:700;padding:4px 8px;border-radius:10px}',
      '#saWindow{position:absolute;bottom:80px;right:0;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(11,31,51,.25);display:none;flex-direction:column;overflow:hidden}',
      '#saWindow.open{display:flex}',
      '#saHeader{background:linear-gradient(135deg,#1EB53A,#0072C6);color:#fff;padding:16px 18px;display:flex;justify-content:space-between;align-items:center}',
      '#saHeader.title{display:flex;align-items:center;gap:10px}',
      '#saHeader.avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px}',
      '#saHeader.name{font-weight:700;font-size:15px}',
      '#saHeader.status{font-size:11.5px;opacity:.9;display:flex;align-items:center;gap:6px}',
      '#saHeader.dot{width:8px;height:8px;border-radius:50%;background:#7dff9b}',
      '#saClose{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer}',
      '#saBody{flex:1;overflow-y:auto;padding:16px;background:#f4f8fb;display:flex;flex-direction:column;gap:10px}',
      '.sa-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.45;word-wrap:break-word}',
      '.sa-msg.bot{background:#fff;color:#12263a;border:1px solid #e1ecf4;align-self:flex-start;border-bottom-left-radius:4px}',
      '.sa-msg.user{background:linear-gradient(135deg,#1EB53A,#0072C6);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
      '.sa-msg a{color:#0072C6;font-weight:700}',
      '.sa-msg.user a{color:#fff;text-decoration:underline}',
      '#saQuickReplies{padding:8px 16px 12px;background:#f4f8fb;border-top:1px solid #e1ecf4;display:flex;gap:6px;flex-wrap:wrap}',
      '.sa-qr{background:#fff;border:1.5px solid #d5e3ee;color:#0072C6;padding:7px 12px;border-radius:16px;font-size:12.5px;font-weight:600;cursor:pointer}',
      '.sa-qr:hover{background:#0072C6;color:#fff}',
      '#saInput{display:flex;padding:10px 12px;gap:8px;background:#fff;border-top:1px solid #e1ecf4}',
      '#saInput input{flex:1;padding:10px 14px;border:1.5px solid #d5e3ee;border-radius:20px;font-size:14px;outline:none}',
      '#saInput input:focus{border-color:#0072C6}',
      '#saInput button{background:linear-gradient(135deg,#1EB53A,#0072C6);border:0;color:#fff;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer}'
    ].join('');
    document.head.appendChild(css);
  }
  const KB = [
    { keywords: ['price', 'cost'], response: 'Flat <strong>$2 USD</strong> added. $0.10 → $2.10, $10 → $12<br>👉 <a href="live-services.html">Catalog →</a>' },
    { keywords: ['track'], response: 'Enter SU- ID 👉 <a href="track.html">Track →</a>' },
    { keywords: ['payment', 'orange', 'binance'], response: '🟠 OM +232 75 908 206 | 🟡 Binance 754378475' },
    { keywords: ['hello', 'hi'], response: 'Hello! 👋 I am SIERRA AI. How can I help?' }
  ];
  const root = document.createElement('div');
  root.id = 'sierraAssistant';
  root.innerHTML =
    '<button id="saBtn" aria-label="Chat"><span>💬</span><span id="saBadge">1</span></button><div id="saWindow"><div id="saHeader"><div class="title"><div class="avatar">🤖</div><div><div class="name">SIERRA Assistant</div><div class="status"><span class="dot"></span> Online</div></div></div><button id="saClose">✕</button></div><div id="saBody"></div><div id="saQuickReplies"></div><form id="saInput"><input type="text" id="saText" placeholder="Ask..."><button type="submit">➤</button></form></div>';
  document.body.appendChild(root);
  const btn = document.getElementById('saBtn'),
    win = document.getElementById('saWindow'),
    body = document.getElementById('saBody'),
    input = document.getElementById('saInput'),
    txt = document.getElementById('saText'),
    badge = document.getElementById('saBadge'),
    close = document.getElementById('saClose');
    
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function addMsg(t, who) {
    const m = document.createElement('div');
    m.className = 'sa-msg ' + who;
    m.innerHTML = t;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  }
  function findResp(q) {
    const l = q.toLowerCase();
    for (const k of KB) if (k.keywords.some((w) => l.includes(w))) return k.response;
    return 'Team: <a href="https://wa.me/23275908206">+232 75 908 206</a>';
  }
  btn.addEventListener('click', () => {
    win.classList.toggle('open');
    badge.style.display = 'none';
  });
  close.addEventListener('click', () => win.classList.remove('open'));
  input.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = txt.value.trim();
    if (!v) return;
    addMsg(esc(v), 'user');
    txt.value = '';
    setTimeout(() => addMsg(findResp(v), 'bot'), 500);
  });
}

/* 16 • POLISH LAYER */
function initPolishLayer() {
  if (!document.getElementById('polishCss')) {
    const link = document.createElement('link');
    link.id = 'polishCss';
    link.rel = 'stylesheet';
    // ✅ This is the correct path. Ensure this file actually exists in your project folder!
    link.href = 'assets/css/polish.css'; 
    document.head.appendChild(link);
  }
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener(
      'scroll',
      () => {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
      },
      { passive: true }
    );
  }
}