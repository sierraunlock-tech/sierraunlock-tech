/* =====================================================================
   SIERRAUNLOCK • CUSTOMER ACCOUNTS + EMAIL OTP — auth.js (v2 • DOCUMENTED + HARDENED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The customer account engine (auth.html ONLY). It handles:
   • Create Account → sends a 6-digit verification code by REAL EMAIL
     (EmailJS) → user types it → account created & signed in.
   • Sign In → email + password check → session started.
   A verified account is required to buy, sell or list (account gate).

   SECTION MAP:
   01  EmailJS live keys
   02  Helpers + anti-abuse rate limits
   03  Tab switching (Create Account / Sign In)
   04  Register — send OTP by email (30 s cooldown, max 3 per 10 min)
   05  Register — verify OTP (10-min expiry, 5 tries) + create account
   06  Sign In — with 5-try / 60 s brute-force lockout

   SECURITY NOTES:
   • Passwords stored base64 (light obfuscation) — real server-side
     hashing arrives with the EXT-16 backend integration.
   • OTP codes expire after 10 minutes.
   • Limits stored in localStorage so refreshing does not bypass them.

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   RULE: ONE single copy of this engine — never two.
   ===================================================================== */
'use strict';
(function () {

  /* 01 • EMAILJS LIVE KEYS — do not change unless reconnecting service */
  const EMAILJS_SERVICE_ID = 'service_qk6e74y';
  const EMAILJS_TEMPLATE_ID = 'template_t0fd8f6';
  const EMAILJS_PUBLIC_KEY = '-9Rd7fpC-MGr8EWra';

  /* 02 • HELPERS + ANTI-ABUSE RATE LIMITS */
  const $ = (id) => document.getElementById(id);
  const getUsers = () => { try { return JSON.parse(localStorage.getItem('su_users') || '[]'); } catch (e) { return []; } };
  const saveUsers = (a) => localStorage.setItem('su_users', JSON.stringify(a));
  const rlGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const rlSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  let pendingCode = null, pendingUser = null, pendingTs = 0, verifyFails = 0;

  const OTP_TTL = 10 * 60 * 1000;              /* code lives 10 minutes */
  const OTP_COOLDOWN = 30 * 1000;              /* 30 s between requests */
  const OTP_MAX = 3;                           /* max 3 codes per 10 min */

  function otpRateCheck() {
    const s = rlGet('su_otp_rl', { count: 0, windowStart: Date.now(), last: 0 });
    const now = Date.now();
    if (now - s.windowStart > 10 * 60 * 1000) { s.count = 0; s.windowStart = now; }
    if (now - s.last < OTP_COOLDOWN) return { ok: false, msg: '⏳ Please wait ' + Math.ceil((OTP_COOLDOWN - (now - s.last)) / 1000) + ' s before requesting another code.' };
    if (s.count >= OTP_MAX) return { ok: false, msg: '⏳ Too many code requests. Please try again in a few minutes.' };
    s.count += 1; s.last = now; rlSet('su_otp_rl', s);
    return { ok: true };
  }
  function loginLockRem() { return Math.max(0, rlGet('su_login_lock', { fails: 0, until: 0 }).until - Date.now()); }
  function loginFail() {
    const s = rlGet('su_login_lock', { fails: 0, until: 0 });
    s.fails += 1;
    if (s.fails >= 5) { s.until = Date.now() + 60000; s.fails = 0; }
    rlSet('su_login_lock', s);
  }
  const loginReset = () => rlSet('su_login_lock', { fails: 0, until: 0 });

  document.addEventListener('DOMContentLoaded', () => {
    const next = new URLSearchParams(location.search).get('next') || 'index.html';

    /* 03 • TAB SWITCHING */
    $('tabReg').addEventListener('click', () => showTab(true));
    $('tabIn').addEventListener('click', () => showTab(false));
    function showTab(reg) {
      $('tabReg').classList.toggle('active', reg);
      $('tabIn').classList.toggle('active', !reg);
      $('regPanel').hidden = !reg;
      $('inPanel').hidden = reg;
    }

    /* 04 • REGISTER — SEND OTP BY REAL EMAIL (rate-limited) */
    $('sendCodeBtn').addEventListener('click', () => {
      const rate = otpRateCheck();
      if (!rate.ok) { alert(rate.msg); return; }
      const name = $('rName').value.trim(), phone = $('rPhone').value.trim(),
            email = $('rEmail').value.trim().toLowerCase(), pass = $('rPass').value;
      if (!name || !phone || !email || !/^\S+@\S+\.\S+$/.test(email)) { alert('Fill name, phone and a valid email.'); return; }
      if (pass.length < 4) { alert('Password must be at least 4 characters.'); return; }
      if (getUsers().some(u => u.email === email)) { alert('This email is already registered — sign in instead.'); showTab(false); return; }
      pendingCode = String(Math.floor(100000 + Math.random() * 900000));
      pendingTs = Date.now();
      verifyFails = 0;
      pendingUser = { name, phone, email, pass: btoa(pass), verified: true, ts: Date.now() };
      if (window.emailjs) {
        emailjs.init(EMAILJS_PUBLIC_KEY);
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
          { to_email: email, to_name: name, code: pendingCode, message: 'Your SIERRAUNLOCK verification code is ' + pendingCode })
          .then(() => { $('demoBox').hidden = true; alert('✔ Verification code sent to ' + email + ' — check your inbox (and Spam).'); })
          .catch(() => { $('demoCode').textContent = pendingCode; $('demoBox').hidden = false; });
      } else {
        $('demoCode').textContent = pendingCode;
        $('demoBox').hidden = false;
      }
      $('codeStep').hidden = false;
    });

    /* 05 • REGISTER — VERIFY OTP + CREATE ACCOUNT (expiry + try limit) */
    $('verifyBtn').addEventListener('click', () => {
      if (!pendingCode) { alert('Request a new code first.'); return; }
      if (Date.now() - pendingTs > OTP_TTL) { pendingCode = null; alert('⌛ Code expired (10 minutes). Request a new one.'); return; }
      if (!$('rCode').value.trim() || $('rCode').value.trim() !== pendingCode) {
        verifyFails += 1;
        if (verifyFails >= 5) { pendingCode = null; $('codeStep').hidden = true; alert('❌ Too many wrong codes. Request a new code to continue.'); return; }
        alert('❌ Wrong code (' + verifyFails + '/5). Check the 6 digits and try again.');
        return;
      }
      const users = getUsers(); users.unshift(pendingUser); saveUsers(users);
      localStorage.setItem('su_profile', JSON.stringify({ name: pendingUser.name, phone: pendingUser.phone, email: pendingUser.email }));
      sessionStorage.setItem('su_user', pendingUser.email);
      alert('✔ Welcome to SIERRAUNLOCK, ' + pendingUser.name + '! Your account is verified.');
      location.href = next;
    });

    /* 06 • SIGN IN — brute-force protected */
    $('signInBtn').addEventListener('click', () => {
      const rem = loginLockRem();
      if (rem > 0) { alert('🔒 Too many wrong tries. Locked for ' + Math.ceil(rem / 1000) + ' s.'); return; }
      const email = $('iEmail').value.trim().toLowerCase(), pass = $('iPass').value;
      const u = getUsers().find(x => x.email === email && x.pass === btoa(pass));
      if (!u) { loginFail(); alert('❌ Email or password incorrect.'); return; }
      loginReset();
      localStorage.setItem('su_profile', JSON.stringify({ name: u.name, phone: u.phone, email: u.email }));
      sessionStorage.setItem('su_user', u.email);
      alert('✔ Welcome back, ' + u.name + '!');
      location.href = next;
    });
  });
})();