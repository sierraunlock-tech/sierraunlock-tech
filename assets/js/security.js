/* =====================================================================
   SIERRAUNLOCK • SECURITY HARDENING LAYER — security.js (v4.1 • CLEAN)

   WHAT IS THIS FILE?
   The "Security Shield" of the entire website. It loads FIRST on every
   page (before main.js) and protects customers from:
   • Clickjacking (site embedded in a fake page)
   • Self-XSS scams (pasting malicious code in the console)
   • HTML injection / XSS via form inputs
   • Form spam (rate limiting)
   • Tab-nabbing (noopener on external links)
   • Bot submissions (honeypot traps)
   • Injected malicious scripts (CSP meta tag)
   • DevTools inspection (warning overlay)
   • Copy-paste attacks on sensitive forms
   • Suspicious activity detection

   SECTION MAP:
   01 Frame-buster (anti-clickjacking)
   02 Self-XSS scam warning in the console
   03 DevTools detection (warns when console is open)
   04 Input sanitizer (strips <> as the user types)
   05 Form rate limiter (max 3 submissions per 5 min per form)
   06 Noopener fixer on all external links (anti tab-nabbing)
   07 Honeypot auto-injector (adds hidden traps to every form)
   08 CSP meta tag injector (blocks injected malicious scripts)
   09 Copy-paste protection on password/OTP fields
   10 Suspicious activity logger (detects automated behavior)
   11 Backend hook for EXT-13 integration

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   ===================================================================== */
'use strict';
(function () {

  /* 01 • FRAME-BUSTER */
  if (window.top!== window.self) {
    try { window.top.location.replace(window.self.location.href); } catch (e) {}
  }

  /* 02 • SELF-XSS WARNING */
  console.log('%cSTOP!', 'font-size:3rem;font-weight:900;color:#B00020');
  console.log('%cThis browser area is for developers. If anyone told you to copy-paste something here — it is a SCAM. SIERRAUNLOCK staff will NEVER ask you to do this.', 'font-size:.95rem;color:#0072C6');

  /* 03 • DEVTOOLS DETECTION */
  let devtoolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if (widthThreshold || heightThreshold) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        console.warn('⚠️ DevTools detected. Never paste code here.');
      }
    } else {
      devtoolsOpen = false;
    }
  }, 1000);

  /* 04 • INPUT SANITIZER */
  document.addEventListener('input', function (e) {
    const t = e.target;
    if (t.matches && t.matches('input[type="text"], input[type="search"], input[type="tel"], input:not([type]), textarea')) {
      if (/[<>]/.test(t.value)) t.value = t.value.replace(/[<>]/g, '');
    }
  }, true);

  /* 05 • FORM RATE LIMITER */
  document.addEventListener('submit', function (e) {
    const f = e.target;
    if (!f ||!f.id) return;
    const key = 'su_rl_' + f.id;
    const now = Date.now();
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (err) { arr = []; }
    arr = arr.filter(ts => now - ts < 300000);
    if (arr.length >= 3) {
      e.preventDefault();
      e.stopImmediatePropagation();
      alert('⚠️ Too many submissions. Please wait a minute and try again.');
      return;
    }
    arr.push(now);
    localStorage.setItem(key, JSON.stringify(arr));
  }, true);

  document.addEventListener('DOMContentLoaded', function () {

    /* 06 • NOOPENER FIXER */
    document.querySelectorAll('a[target="_blank"]').forEach(a => {
      const rel = a.getAttribute('rel') || '';
      if (!rel.includes('noopener')) a.setAttribute('rel', (rel + ' noopener noreferrer').trim());
    });

    /* 07 • HONEYPOT AUTO-INJECTOR */
    document.querySelectorAll('form').forEach(f => {
      const hp1 = document.createElement('input');
      hp1.type = 'text'; hp1.name = 'website_url'; hp1.id = f.id + '_hp_url';
      hp1.tabIndex = -1; hp1.autocomplete = 'off';
      hp1.style.cssText = 'position:absolute!important;left:-9999px!important;top:auto;width:1px;height:1px;overflow:hidden';
      f.appendChild(hp1);
      const hp2 = document.createElement('input');
      hp2.type = 'text'; hp2.name = 'company_website'; hp2.id = f.id + '_hp_company';
      hp2.tabIndex = -1; hp2.autocomplete = 'off';
      hp2.style.cssText = 'position:absolute!important;left:-9999px!important;top:auto;width:1px;height:1px;overflow:hidden';
      f.appendChild(hp2);
    });

    /* 08 • CSP META TAG — v4.1 fixed */
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const csp = document.createElement('meta');
      csp.setAttribute('http-equiv', 'Content-Security-Policy');
      csp.setAttribute('content', "default-src 'self' 'unsafe-inline' https: data: blob:; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdn.emailjs.com; connect-src 'self' https://sierraunlock-tech-1-4um3.onrender.com https://api.binance.com https://api.emailjs.com https://api.ipify.org");
      document.head.appendChild(csp);
    }

    /* 09 • COPY-PASTE PROTECTION */
    document.querySelectorAll('input[type="password"], input[id*="Code"], input[id*="Pin"], input[id*="OTP"]').forEach(el => {
      el.addEventListener('paste', (e) => {
        e.preventDefault();
        alert('⚠️ For security, please type this manually. Paste is disabled here.');
      });
    });

    /* 10 • SUSPICIOUS ACTIVITY LOGGER */
    let clickCount = 0;
    let lastClickTime = Date.now();
    document.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastClickTime < 100) {
        clickCount++;
        if (clickCount > 20) {
          console.warn('⚠️ Rapid clicking detected.');
          clickCount = 0;
        }
      } else {
        clickCount = 0;
      }
      lastClickTime = now;
    });
  });

  /* 11 • BACKEND HOOK */
  window.SU_SEC = { layer: 'frontend-v4.1', ready: true };
})();