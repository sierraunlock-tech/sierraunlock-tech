/* =====================================================================
   SIERRAUNLOCK • CUSTOMER ACCOUNTS + BACKEND API — auth.js (v3.1 • 173 LINES CLEAN)

   WHAT IS THIS FILE?
   The customer account engine (auth.html ONLY). Connects to backend
   API v3.38+ for vault-backed accounts.

   SECURITY:
   • Passwords bcrypt hashed server-side
   • OTP 60s cooldown anti-spam
   • Phone normalized to 232 format
   • Token stored as su_token

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, SL
   Backend: https://sierraunlock-tech-1-4um3.onrender.com
   ===================================================================== */
'use strict';
(function () {

  const API_BASE = 'https://sierraunlock-tech-1-4um3.onrender.com';
  const $ = (id) => document.getElementById(id);

  let pendingPhone = '';
  let verifyFails = 0;
  let lastSendAt = 0;
  const SEND_COOLDOWN = 60000;

  const normalizePhone = (p) => String(p||'').replace(/\D/g,'').replace(/^0/,'232');
  const isEmail = (e) => /^\S+@\S+\.\S+$/.test(e);

  document.addEventListener('DOMContentLoaded', () => {
    const next = new URLSearchParams(location.search).get('next') || 'index.html';

    /* 01 • TAB SWITCHING */
    if ($('tabReg') && $('tabIn')) {
      $('tabReg').addEventListener('click', () => showTab(true));
      $('tabIn').addEventListener('click', () => showTab(false));
    }

    function showTab(reg) {
      if ($('tabReg')) $('tabReg').classList.toggle('active', reg);
      if ($('tabIn')) $('tabIn').classList.toggle('active', !reg);
      if ($('regPanel')) $('regPanel').hidden = !reg;
      if ($('inPanel')) $('inPanel').hidden = reg;
    }

    /* 02 • REGISTER — SEND OTP VIA BACKEND */
    if ($('sendCodeBtn')) {
      $('sendCodeBtn').addEventListener('click', async () => {
        const now = Date.now();
        if (now - lastSendAt < SEND_COOLDOWN) {
          alert('⏳ Wait ' + Math.ceil((SEND_COOLDOWN - (now - lastSendAt))/1000) + 's before resending.');
          return;
        }

        const name = $('rName').value.trim();
        const rawPhone = $('rPhone').value.trim();
        const email = $('rEmail').value.trim().toLowerCase();
        const pass = $('rPass').value;

        if (!name || !rawPhone || !isEmail(email)) {
          alert('Please fill in name, phone, and a valid email.'); return;
        }
        if (pass.length < 6) {
          alert('Password must be at least 6 characters.'); return;
        }

        const phone = normalizePhone(rawPhone);
        if (phone.length < 10) {
          alert('Invalid phone number.'); return;
        }

        $('sendCodeBtn').disabled = true;
        $('sendCodeBtn').textContent = 'Sending...';

        try {
          const res = await fetch(API_BASE + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, password: pass })
          });
          const data = await res.json().catch(() => ({}));

          if (res.ok) {
            pendingPhone = phone;
            verifyFails = 0;
            lastSendAt = Date.now();
            $('codeStep').hidden = false;
            alert('✔ Verification code sent to ' + email + ' — check inbox and Spam.');
          } else {
            alert('❌ ' + (data.error || 'Registration failed.'));
          }
        } catch (e) {
          alert('❌ Network error. Please check your connection.');
        } finally {
          $('sendCodeBtn').disabled = false;
          $('sendCodeBtn').textContent = 'Send Verification Code';
        }
      });
    }

    /* 03 • REGISTER — VERIFY OTP + CREATE ACCOUNT */
    if ($('verifyBtn')) {
      $('verifyBtn').addEventListener('click', async () => {
        if (!pendingPhone) { alert('Request a new code first.'); return; }
        const code = $('rCode').value.trim();
        if (!/^\d{4,6}$/.test(code)) { alert('Please enter 6-digit code.'); return; }

        $('verifyBtn').disabled = true;
        $('verifyBtn').textContent = 'Verifying...';

        try {
          const res = await fetch(API_BASE + '/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: pendingPhone, code })
          });
          const data = await res.json().catch(() => ({}));

          if (res.ok && data.token && data.user) {
            localStorage.setItem('su_token', data.token);
            localStorage.setItem('su_profile', JSON.stringify(data.user));
            sessionStorage.setItem('su_user', data.user.email);
            alert('✔ Welcome to SIERRAUNLOCK, ' + data.user.name + '! Your account is verified.');
            location.href = next;
          } else {
            verifyFails += 1;
            if (verifyFails >= 5) {
              pendingPhone = '';
              $('codeStep').hidden = true;
              alert('❌ Too many wrong codes. Request new code.');
            } else {
              alert('❌ Wrong code (' + verifyFails + '/5). Try again.');
            }
          }
        } catch (e) {
          alert('❌ Network error. Please try again.');
        } finally {
          $('verifyBtn').disabled = false;
          $('verifyBtn').textContent = 'Verify & Create Account';
        }
      });
    }

    /* 04 • SIGN IN — BACKEND API */
    if ($('signInBtn')) {
      $('signInBtn').addEventListener('click', async () => {
        const email = $('iEmail').value.trim().toLowerCase();
        const pass = $('iPass').value;
        if (!email || !pass) { alert('Please enter email and password.'); return; }

        $('signInBtn').disabled = true;
        $('signInBtn').textContent = 'Signing In...';

        try {
          const res = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrPhone: email, password: pass })
          });
          const data = await res.json().catch(() => ({}));

          if (res.ok && data.token && data.user) {
            localStorage.setItem('su_token', data.token);
            localStorage.setItem('su_profile', JSON.stringify(data.user));
            sessionStorage.setItem('su_user', data.user.email);
            alert('✔ Welcome back, ' + data.user.name + '!');
            location.href = next;
          } else {
            alert('❌ ' + (data.error || 'Invalid email or password.'));
          }
        } catch (e) {
          alert('❌ Network error. Please check connection.');
        } finally {
          $('signInBtn').disabled = false;
          $('signInBtn').textContent = 'Sign In';
        }
      });
    }
  });
})();