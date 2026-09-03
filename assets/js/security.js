/* =====================================================================
   SIERRAUNLOCK • SECURITY HARDENING LAYER
   File : assets/js/security.js
   Ext  : EXT-12
   Load : FIRST on every page (before main.js) — see PATCH C below
   ===================================================================== */
   'use strict';
   (function () {
   
     /* 1 • FRAME-BUSTING — nobody can embed our site in a fake page */
     if (window.top !== window.self) {
       try { window.top.location.replace(window.self.location.href); } catch (e) { /* blocked by hostile frame; stay put */ }
     }
   
     /* 2 • SELF-XSS SCAM WARNING — protects customers who paste "codes" */
     console.log('%cSTOP!', 'font-size:3rem;font-weight:900;color:#B00020');
     console.log('%cThis browser area is for developers. If anyone told you to copy-paste something here — it is a SCAM trying to steal your account or device. SIERRAUNLOCK staff will NEVER ask you to do this.', 'font-size:.95rem;color:#0072C6');
   
     /* 3 • SANITIZE AS THEY TYPE — strips HTML injection characters */
     document.addEventListener('input', function (e) {
       const t = e.target;
       if (t.matches && t.matches('input[type="text"], input[type="search"], input[type="tel"], input:not([type]), textarea')) {
         if (/[<>]/.test(t.value)) t.value = t.value.replace(/[<>]/g, '');
       }
     }, true);
   
     /* 4 • FORM RATE LIMIT — max 3 submissions per 5 minutes per form */
     document.addEventListener('submit', function (e) {
       const f = e.target;
       if (!f || !f.id) return;
       const key = 'su_rl_' + f.id;
       const now = Date.now();
       let arr = [];
       try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (err) { arr = []; }
       arr = arr.filter(ts => now - ts < 300000);
       if (arr.length >= 3) {
         e.preventDefault();
         e.stopImmediatePropagation();
         alert('⚠️ Too many submissions in a short time. Please wait a minute and try again.');
         return;
       }
       arr.push(now);
       localStorage.setItem(key, JSON.stringify(arr));
     }, true);
   
     document.addEventListener('DOMContentLoaded', function () {
   
       /* 5 • REPAIR noopener ON ALL EXTERNAL LINKS (anti tab-nabbing) */
       document.querySelectorAll('a[target="_blank"]').forEach(a => {
         const rel = a.getAttribute('rel') || '';
         if (!rel.includes('noopener')) a.setAttribute('rel', (rel + ' noopener noreferrer').trim());
       });
   
       /* 6 • ADMIN PIN LOCKOUT — 5 wrong tries = 60 s freeze */
       const err = document.getElementById('loginErr');
       const btn = document.getElementById('loginBtn');
       const pin = document.getElementById('pinInput');
       if (err && btn && pin) {
         let fails = 0, locked = false;
         new MutationObserver(function () {
           if (!err.textContent.trim() || locked) return;
           fails++;
           if (fails >= 5) {
             locked = true;
             let s = 60;
             btn.disabled = true; pin.disabled = true;
             const t = setInterval(function () {
               err.textContent = '🔒 Too many attempts. Locked for ' + s + 's.';
               s--;
               if (s < 0) {
                 clearInterval(t); locked = false; fails = 0;
                 btn.disabled = false; pin.disabled = false; err.textContent = '';
               }
             }, 1000);
           }
         }).observe(err, { childList: true, characterData: true, subtree: true });
       }
     });
   
     /* 7 • HOOK FOR THE FUTURE BACKEND (EXT-13) */
     window.SU_SEC = { layer: 'frontend-v1', ready: true };
   })();