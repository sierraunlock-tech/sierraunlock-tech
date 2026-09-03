/* =====================================================================
   SIERRAUNLOCK • CUSTOMER ACCOUNTS + EMAIL VERIFICATION (OTP) — LIVE
   File : assets/js/auth.js (load ONLY on auth.html)
   EmailJS connected: service_qk6e74y • template_t0fd8f6
   RULE: ONE single copy of the engine — never two.
   ===================================================================== */
'use strict';
(function () {
  /* ---- EmailJS keys (LIVE) ---- */
  const EMAILJS_SERVICE_ID = 'service_qk6e74y';
  const EMAILJS_TEMPLATE_ID = 'template_t0fd8f6';
  const EMAILJS_PUBLIC_KEY = '-9Rd7fpC-MGr8EWra';

  const $ = (id) => document.getElementById(id);
  const getUsers = () => { try { return JSON.parse(localStorage.getItem('su_users') || '[]'); } catch (e) { return []; } };
  const saveUsers = (a) => localStorage.setItem('su_users', JSON.stringify(a));
  let pendingCode = null, pendingUser = null;

  document.addEventListener('DOMContentLoaded', () => {
    const next = new URLSearchParams(location.search).get('next') || 'index.html';

    /* tabs */
    $('tabReg').addEventListener('click', () => showTab(true));
    $('tabIn').addEventListener('click', () => showTab(false));
    function showTab(reg) {
      $('tabReg').classList.toggle('active', reg);
      $('tabIn').classList.toggle('active', !reg);
      $('regPanel').hidden = !reg;
      $('inPanel').hidden = reg;
    }

    /* ---- REGISTER: send code by REAL EMAIL ---- */
    $('sendCodeBtn').addEventListener('click', () => {
      const name = $('rName').value.trim(), phone = $('rPhone').value.trim(),
            email = $('rEmail').value.trim().toLowerCase(), pass = $('rPass').value;
      if (!name || !phone || !email || !/^\S+@\S+\.\S+$/.test(email)) { alert('Fill name, phone and a valid email.'); return; }
      if (pass.length < 4) { alert('Password must be at least 4 characters.'); return; }
      if (getUsers().some(u => u.email === email)) { alert('This email is already registered — sign in instead.'); showTab(false); return; }
      pendingCode = String(Math.floor(100000 + Math.random() * 900000));
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

    /* ---- REGISTER: verify + create account ---- */
    $('verifyBtn').addEventListener('click', () => {
      if (!$('rCode').value.trim() || $('rCode').value.trim() !== pendingCode) { alert('❌ Wrong code. Check the 6 digits and try again.'); return; }
      const users = getUsers(); users.unshift(pendingUser); saveUsers(users);
      localStorage.setItem('su_profile', JSON.stringify({ name: pendingUser.name, phone: pendingUser.phone, email: pendingUser.email }));
      sessionStorage.setItem('su_user', pendingUser.email);
      alert('✔ Welcome to SIERRAUNLOCK, ' + pendingUser.name + '! Your account is verified.');
      location.href = next;
    });

    /* ---- SIGN IN ---- */
    $('signInBtn').addEventListener('click', () => {
      const email = $('iEmail').value.trim().toLowerCase(), pass = $('iPass').value;
      const u = getUsers().find(x => x.email === email && x.pass === btoa(pass));
      if (!u) { alert('❌ Email or password incorrect.'); return; }
      localStorage.setItem('su_profile', JSON.stringify({ name: u.name, phone: u.phone, email: u.email }));
      sessionStorage.setItem('su_user', u.email);
      alert('✔ Welcome back, ' + u.name + '!');
      location.href = next;
    });
  });
})();