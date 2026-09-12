/* =====================================================================
   SIERRAUNLOCK • CORE ENGINE — main.js (v9.7 • FINAL PACK)
   ===================================================================== */
'use strict';

/* 01 • WHATSAPP DESK SWITCH */
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
  const GATED = ['unlockForm','repairForm','sellForm','shopForm','resForm','bizForm'];
  const user = () => sessionStorage.getItem('su_user');
  const need = () => {
    alert('🔐 Create your free SIERRAUNLOCK account or sign in to continue.');
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
  {icon:'🔓',name:'Unlock Codes',tag:'All Brands',img:null},
  {icon:'🧠',name:'FRP Reset',tag:'Owner-Verified',img:null},
  {icon:'⚡',name:'Flashing & Firmware',tag:'Software',img:null},
  {icon:'📡',name:'Network Config',tag:'GSM • LTE',img:null},
  {icon:'🔩',name:'Screen Replacement',tag:'Hardware',img:null},
  {icon:'🔋',name:'Battery Swap',tag:'Hardware',img:null},
  {icon:'🧩',name:'Chip-Level Repair',tag:'Board Work',img:null},
  {icon:'💾',name:'Data Recovery',tag:'Careful Handling',img:null},
  {icon:'💻',name:'Laptop Repair',tag:'Computer',img:null},
  {icon:'🧰',name:'Genuine Spare Parts',tag:'Marketplace',img:null},
  {icon:'✅',name:'Legal IMEI Check',tag:'Compliance',img:null},
  {icon:'🛡️',name:'OS Optimization',tag:'Performance',img:null}
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
      .replace('23231363736','23275908206')
      .replace('232754378475','23275908206')
      .replace('23233469056','23275908206');
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

/* 05 • NUMBER NORMALIZER */
function normalizeNumbers() {
  const HREF_MAP = [
    ['tel:+232754378475','tel:+23275908206'],
    ['tel:+23233469056','tel:+23275908206']
  ];
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    HREF_MAP.forEach(([f,t]) => { if (a.getAttribute('href') === f) a.setAttribute('href', t); });
  });
  const TEXT_MAP = [
    ['+232 75 437 8475','+232 75 908 206'],
    ['+232 33 469 056','+232 75 908 206']
  ];
  if (!document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => {
    let t = n.nodeValue, changed = false;
    TEXT_MAP.forEach(([f,r]) => { if (t.includes(f)) { t = t.split(f).join(r); changed = true; } });
    if (changed) n.nodeValue = t;
  });
}

/* 06 • HERO ROTATOR */
function injectPageRotator() {
  if (document.getElementById('rotatorText')) return;
  const h1 = document.querySelector('section[class*="hero"] h1');
  if (!h1) return;
  const br = document.createElement('br');
  const span = document.createElement('span');
  span.className = 'rotator'; span.id = 'rotatorText';
  span.textContent = ROTATOR_PHRASES[0];
  h1.appendChild(br); h1.appendChild(span);
}

/* 07 • NAV LINKS */
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
  try { name = (JSON.parse(localStorage.getItem('su_profile')||'{}').name||''); } catch(e){}
  a.textContent = sessionStorage.getItem('su_user') ? ('👤 '+(name||'Account')) : '👤 Sign In';
  nav.appendChild(a);
}

/* 08 • SERVICES MEGA MENU */
function injectServicesMegaMenu() {
  const HREF = 'live-services.html';
  document.querySelectorAll('a[href="'+HREF+'"]').forEach(a => {
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
  const nodes = Array.prototype.slice.call(nav.querySelectorAll('li,div,a,button,span'));
  const trigger = nodes.find(el => {
    const t = (el.textContent||'').trim().toLowerCase();
    return t==='services' || t==='services ▾' || t.indexOf('services')===0;
  });
  if (!trigger) return;
  let wrap = trigger.closest('li,div.dropdown,[class*="drop"]');
  if (!wrap || wrap===nav) {
    wrap = document.createElement('span');
    wrap.className = 'su-wrap';
    trigger.parentNode.insertBefore(wrap, trigger);
    wrap.appendChild(trigger);
  } else { wrap.classList.add('su-wrap'); }
  const mega = document.createElement('div');
  mega.className = 'su-mega'; mega.id = 'suMegaMenu';
  mega.innerHTML =
    '<div class="su-col"><h4>🔓 Unlock Services</h4>'+
      '<a class="hot" href="live-services.html">⚡ Live Catalog — Buy Now</a>'+
      '<a href="live-services.html#g=network">🌐 Network & Carrier Unlock</a>'+
      '<a href="live-services.html#g=frp">🧠 FRP / iCloud / Passcode</a>'+
      '<a href="live-services.html#g=checks">✅ IMEI & Info Checks</a>'+
      '<a href="live-services.html#g=tools">🧰 Tool Licenses</a>'+
    '</div>'+
    '<div class="su-col"><h4>📦 Order Tools</h4>'+
      '<a href="live-services.html">🛒 Place Order</a>'+
      '<a href="track.html">📍 Track My Order</a>'+
      '<a href="auth.html">📜 Order History</a>'+
      '<a href="services.html">📁 File Service</a>'+
      '<a href="reseller.html">🖥 Server Service</a>'+
    '</div>'+
    '<div class="su-col"><h4>👤 My Account</h4>'+
      '<a href="auth.html">🔐 Sign In / Create Account</a>'+
      '<a href="reseller.html">🤝 Become a Reseller</a>'+
      '<a href="payments.html">💳 Payments</a>'+
      '<a href="faq.html">❓ Help & FAQ</a>'+
      '<a href="policy.html">📋 Terms & Refund Policy</a>'+
    '</div>';
  wrap.appendChild(mega);
  trigger.addEventListener('click', function(e){
    if (window.innerWidth <= 900) { e.preventDefault(); wrap.classList.toggle('open'); }
  });
}

/* 09 • HAMBURGER MENU */
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
    if (a.closest('.su-mega')) return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
    toggle.textContent = '☰';
  }));
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove('open'); toggle.textContent = '☰';
    }
  });
}

/* 10 • ROTATOR ENGINE */
function initRotator() {
  const el = document.getElementById('rotatorText');
  if (!el) return;
  let i = 0;
  setInterval(() => {
    i = (i+1) % ROTATOR_PHRASES.length;
    el.classList.remove('swap'); void el.offsetWidth;
    el.textContent = ROTATOR_PHRASES[i];
    el.classList.add('swap');
  }, 2800);
}

/* 11 • YEAR + VERSION */
function initYearVersion() {
  const y = document.getElementById('year');
  const v = document.getElementById('siteVersion');
  if (y) y.textContent = new Date().getFullYear();
  if (v) v.textContent = SITE_VERSION;
}

/* 12 • ACTIVE NAV */
function initActiveNav() {
  const page = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

/* 13 • TOOLS MARQUEE */
function initToolsMarquee() {
  const anchor = document.querySelector('.legal-strip');
  if (!anchor || document.getElementById('toolsSection')) return;
  const section = document.createElement('section');
  section.className = 'tools-section'; section.id = 'toolsSection';
  section.innerHTML =
    '<div class="section-head">'+
      '<h2>Our Tools &amp; Services — Live in Motion</h2>'+
      '<div class="underline"></div>'+
      '<p>The full arsenal we work with daily. Hover to pause.</p>'+
    '</div>'+
    '<div class="marquee"><div class="marquee-track" id="toolsTrack"></div></div>';
  anchor.insertAdjacentElement('afterend', section);
  const track = section.querySelector('#toolsTrack');
  const buildCard = (t) => {
    const card = document.createElement('article');
    card.className = 'tool-card';
    const icon = document.createElement('div');
    icon.className = 'tool-icon';
    if (t.img) {
      const im = document.createElement('img');
      im.src = 'assets/images/tools/' + t.img; im.alt = t.name;
      im.onerror = () => { icon.textContent = t.icon; };
      icon.appendChild(im);
    } else { icon.textContent = t.icon; }
    const txt = document.createElement('div');
    txt.innerHTML = '<div class="tool-name"></div><div class="tool-tag"></div>';
    txt.querySelector('.tool-name').textContent = t.name;
    txt.querySelector('.tool-tag').textContent = t.tag;
    card.appendChild(icon); card.appendChild(txt);
    return card;
  };
  [...TOOLS, ...TOOLS].forEach(t => track.appendChild(buildCard(t)));
}

/* 14 • SCROLL REVEAL */
function initReveal() {
  const targets = document.querySelectorAll(
    '.card,.founder-card,.stat,.section-head,.badge,.tool-card,.philosophy-card,.timeline-item,.reveal'
  );
  if (!targets.length || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('reveal-in')); return;
  }
  targets.forEach((el,i) => {
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

/* 15 • SMART RETURN MODE */
(function () {
  if (sessionStorage.getItem('su_seen') === '1') {
    document.documentElement.classList.add('su-returning');
  } else { sessionStorage.setItem('su_seen','1'); }
})();

/* 16 • SIERRA ASSISTANT BOT */
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
      '#saWindow{position:absolute;bottom:80px;right:0;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(11,31,51,.25);display:none;flex-direction:column;overflow:hidden;animation:saWindowIn .25s ease}',
      '#saWindow.open{display:flex}',
      '@keyframes saWindowIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
      '#saHeader{background:linear-gradient(135deg,#1EB53A,#0072C6);color:#fff;padding:16px 18px;display:flex;justify-content:space-between;align-items:center}',
      '#saHeader .title{display:flex;align-items:center;gap:10px}',
      '#saHeader .avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px}',
      '#saHeader .name{font-weight:700;font-size:15px}',
      '#saHeader .status{font-size:11.5px;opacity:.9;display:flex;align-items:center;gap:6px}',
      '#saHeader .dot{width:8px;height:8px;border-radius:50%;background:#7dff9b}',
      '#saClose{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px}',
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
      '#saInput button{background:linear-gradient(135deg,#1EB53A,#0072C6);border:0;color:#fff;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer}',
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
    { keywords:['price','cost','how much','fee','charge'],
      response:'We add a flat <strong>$2 USD</strong> to every wholesale service.<br>Examples:<br>• Small check ($0.10) → <strong>$2.10</strong><br>• Standard unlock ($10) → <strong>$12.00</strong><br>• Premium service ($60) → <strong>$62.00</strong><br><br>👉 <a href="live-services.html">See all 248+ services →</a>' },
    { keywords:['order','buy','purchase','how to','get','start'],
      response:'Ordering is easy!<br><strong>1.</strong> Browse <a href="live-services.html">live catalog</a><br><strong>2.</strong> Click <strong>Order Now</strong><br><strong>3.</strong> Enter IMEI (*#06#) + WhatsApp<br><strong>4.</strong> Pay via Orange Money / Binance / Cash<br><strong>5.</strong> Track your order<br><br>👉 <a href="live-services.html">Start ordering →</a>' },
    { keywords:['payment','pay','orange money','binance','cash'],
      response:'We accept 3 payment methods:<br><br>🟠 <strong>Orange Money</strong><br>+232 75 908 206 (Alhassan)<br><br>🟡 <strong>Binance Pay</strong> (auto-detect)<br>ID: <strong>754378475</strong><br><br>💵 <strong>Cash</strong><br>Waterloo or Koidu hub<br><br>👉 <a href="payments.html">Full details →</a>' },
    { keywords:['track','status','where','progress','my order'],
      response:'Track your order live!<br>Enter your job ID (e.g. <strong>SU-1757...</strong>)<br><br>👉 <a href="track.html">Track my order →</a><br><br>Auto-refreshes every 10 seconds. Code appears the moment it is ready.' },
    { keywords:['refund','money back','return','cancel'],
      response:'<strong>Refund Policy:</strong><br>• Once paid, orders cannot be reversed (crypto/OM/cash are final)<br>• Refunds are founder-only after fraud review<br>• Service failure → contact within 24 hours<br><br>👉 <a href="https://wa.me/23275908206?text=' + encodeURIComponent('Hi, I need a refund review.') + '">Request on WhatsApp →</a>' },
    { keywords:['time','long','how long','wait','fast','instant'],
      response:'Most services:<br>• IMEI checks: <strong>instant</strong><br>• Simple unlocks: <strong>1-2 hours</strong><br>• Premium unlocks: <strong>1-7 days</strong><br><br>Check the <strong>⏱ Time</strong> field on each service card in the <a href="live-services.html">catalog</a>.' },
    { keywords:['imei','what is','find','where'],
      response:'<strong>IMEI</strong> = your phone\'s 15-digit ID.<br>📱 Dial <strong>*#06#</strong> on your keypad<br>📱 Or: Settings → About Phone → IMEI' },
    { keywords:['brand','iphone','samsung','xiaomi','huawei','tecno','infinix','motorola','nokia'],
      response:'We support <strong>all major brands</strong>:<br>🍎 iPhone • 📱 Samsung • 📱 Xiaomi<br>📱 Huawei • 📱 Tecno • 📱 Infinix<br>📱 Itel • 📱 Nokia • 📱 Motorola<br>📱 Oppo • 📱 Realme • 📱 LG<br><br>👉 <a href="live-services.html">Find your service →</a>' },
    { keywords:['safe','legal','legit','trust','scam','reliable'],
      response:'SIERRAUNLOCK is <strong>100% legal</strong>:<br>✅ CTIA compliant<br>✅ Sierra Leone law compliant<br>✅ Owner-verification required<br>✅ 20+ years experience<br>✅ Two physical hubs<br><br>We never touch blacklisted/stolen devices.' },
    { keywords:['reseller','wholesale','business','partner','bulk'],
      response:'Become a SIERRAUNLOCK reseller!<br>• Buy at wholesale prices<br>• Sell at your price<br>• Keep full margin<br>• Training included<br><br>👉 <a href="reseller.html">Apply →</a>' },
    { keywords:['contact','call','phone','email','reach','human','person','support','help','agent'],
      response:'Talk to our team:<br>📞 <a href="https://wa.me/23275908206">+232 75 908 206</a> (Alhassan)<br>📍 Waterloo: Tombo Park<br>📍 Koidu: Koidu City, Kono' },
    { keywords:['hello','hi','hey','good','morning','afternoon','evening','greetings'],
      response:'Hello! 👋 I\'m <strong>SIERRA</strong>, your AI assistant. I\'m here 24/7 to help with prices, ordering, payments, tracking, and more. What can I help you with?' }
  ];
  const root = document.createElement('div');
  root.id = 'sierraAssistant';
  root.innerHTML =
    '<button id="saBtn" aria-label="Chat"><span>💬</span><span id="saBadge">1</span></button>'+
    '<div id="saWindow" role="dialog">'+
      '<div id="saHeader">'+
        '<div class="title"><div class="avatar">🤖</div><div>'+
          '<div class="name">SIERRA Assistant</div>'+
          '<div class="status"><span class="dot"></span> Online</div>'+
        '</div></div>'+
        '<button id="saClose" aria-label="Close">✕</button>'+
      '</div>'+
      '<div id="saBody"></div>'+
      '<div id="saQuickReplies"></div>'+
      '<form id="saInput">'+
        '<input type="text" id="saText" placeholder="Type your question..." autocomplete="off">'+
        '<button type="submit" aria-label="Send">➤</button>'+
      '</form>'+
    '</div>';
  document.body.appendChild(root);
  const btn = document.getElementById('saBtn');
  const win = document.getElementById('saWindow');
  const body = document.getElementById('saBody');
  const qr = document.getElementById('saQuickReplies');
  const input = document.getElementById('saInput');
  const txt = document.getElementById('saText');
  const badge = document.getElementById('saBadge');
  const close = document.getElementById('saClose');
  const QUICK = [
    {label:'💰 Prices', q:'How much do your services cost?'},
    {label:'🛒 How to order', q:'How do I place an order?'},
    {label:'💳 Payment', q:'What payment methods do you accept?'},
    {label:'📍 Track order', q:'How do I track my order?'},
    {label:'👤 Talk to human', q:'I want to talk to a person'}
  ];
  function renderQuickReplies() {
    qr.innerHTML = QUICK.map(q => '<button type="button" class="sa-qr" data-q="'+escQ(q.q)+'">'+escQ(q.label)+'</button>').join('');
    qr.querySelectorAll('.sa-qr').forEach(b => {
      b.addEventListener('click', function(){ handleUserMessage(this.getAttribute('data-q')); });
    });
  }
  function escQ(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function addMsg(text, who) {
    const m = document.createElement('div');
    m.className = 'sa-msg '+who;
    m.innerHTML = text;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }
  function showTyping() {
    const m = document.createElement('div');
    m.className = 'sa-msg bot'; m.id = 'saTyping';
    m.innerHTML = '<div class="sa-typing"><span></span><span></span><span></span></div>';
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  }
  function removeTyping() {
    const t = document.getElementById('saTyping');
    if (t) t.remove();
  }
  function findResponse(text) {
    const lower = text.toLowerCase();
    for (let i=0; i<KB.length; i++) {
      const entry = KB[i];
      for (let j=0; j<entry.keywords.length; j++) {
        if (lower.indexOf(entry.keywords[j]) !== -1) return entry.response;
      }
    }
    return 'I\'m not sure about that, but our team can help!<br>👉 <a href="https://wa.me/23275908206?text=' + encodeURIComponent('Hi, I have a question: '+text) + '">Ask on WhatsApp →</a><br>• <a href="live-services.html">Browse services</a><br>• <a href="track.html">Track an order</a>';
  }
  function handleUserMessage(text) {
    if (!text || !text.trim()) return;
    addMsg(escQ(text), 'user');
    txt.value = '';
    showTyping();
    setTimeout(() => {
      removeTyping();
      addMsg(findResponse(text), 'bot');
    }, 700);
  }
  function toggle() {
    const open = win.classList.toggle('open');
    btn.classList.toggle('pulse', !open);
    badge.style.display = open ? 'none' : 'block';
    if (open) setTimeout(() => txt.focus(), 200);
  }
  btn.addEventListener('click', toggle);
  close.addEventListener('click', () => { win.classList.remove('open'); btn.classList.add('pulse'); });
  input.addEventListener('submit', (e) => { e.preventDefault(); handleUserMessage(txt.value); });
  if (!sessionStorage.getItem('sa_welcomed')) {
    setTimeout(() => {
      win.classList.add('open');
      btn.classList.remove('pulse');
      badge.style.display = 'none';
      addMsg('👋 <strong>Welcome to SIERRAUNLOCK!</strong><br>I\'m <strong>SIERRA</strong>, your AI assistant. I\'m here 24/7 to help with prices, ordering, payments, tracking, and more.<br>How can I help you today?', 'bot');
      renderQuickReplies();
      sessionStorage.setItem('sa_welcomed','1');
    }, 3000);
  } else { btn.classList.add('pulse'); }
  let qrLoaded = false;
  const observer = new MutationObserver(() => {
    if (win.classList.contains('open') && !qrLoaded && !body.children.length) {
      addMsg('👋 <strong>Welcome back!</strong> How can I help?', 'bot');
      renderQuickReplies();
      qrLoaded = true;
    }
  });
  observer.observe(win, { attributes: true, attributeFilter: ['class'] });
}

/* 17 • POLISH LAYER */
function initPolishLayer() {
  if (!document.getElementById('polishCss')) {
    const link = document.createElement('link');
    link.id = 'polishCss';
    link.rel = 'stylesheet';
    link.href = 'assets/css/polish.css';
    document.head.appendChild(link);
  }
  document.querySelectorAll(
    'section[class*="hero"] h1, section[class*="hero"] p, .section-head, .stat, .founder-card, .philosophy-card, .timeline-item'
  ).forEach((el, i) => {
    el.classList.add('polish-animate');
    el.style.transitionDelay = (i % 6) * 80 + 'ms';
  });
  document.querySelectorAll('.grid, .tools-track, .marquee-track').forEach(el => {
    el.classList.add('polish-stagger');
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.polish-animate, .polish-stagger').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.polish-animate, .polish-stagger').forEach(el => el.classList.add('in-view'));
  }
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 50) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    }, { passive: true });
  }
}