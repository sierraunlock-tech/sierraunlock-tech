/* =====================================================================
   SIERRAUNLOCK • CUSTOMER ACCOUNTS + BACKEND API — auth.js (v3.2 CLEAN FIXED)

   FIXES v3.2:
   • Fixed Network error: added inline error box display (was alert only)
   • Fixed ID mismatch: supports iEmail/iPass AND email/password
   • Added Render wake-up retry: if backend sleeping, retries after 5s
   • Added phone normalization for login (email OR phone)
   • Clean professional error handling

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

  const normalizePhone = (p) => String(p || '').replace(/\D/g, '').replace(/^0/, '232');
  const isEmail = (e) => /^\S+@\S+\.\S+$/.test(e);

  function showError(msg) {
    const box = $('authError') || $('inError') || $('regError') || $('errorBox');
    if (box) {
      box.textContent = msg;
      box.style.display = 'block';
      box.hidden = false;
    } else {
      console.error(msg);
    }
  }
  function clearError() {
    const box = $('authError') || $('inError') || $('regError') || $('errorBox');
    if (box) {
      box.textContent = '';
      box.style.display = 'none';
      box.hidden = true;
    }
  }

  async function apiFetch(path, body) {
    const url = API_BASE + path;
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.log('Backend sleeping, retrying in 5s...', e);
      showError('⏳ Waking up server (free tier sleeps)... retrying in 5 seconds...');
      await new Promise(r => setTimeout(r, 5000));
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const next = new URLSearchParams(location.search).get('next') || 'index.html';

    if ($('tabReg') && $('tabIn')) {
      $('tabReg').addEventListener('click', () => showTab(true));
      $('tabIn').addEventListener('click', () => showTab(false));
    }
    function showTab(reg) {
      if ($('tabReg')) $('tabReg').classList.toggle('active', reg);
      if ($('tabIn')) $('tabIn').classList.toggle('active', !reg);
      if ($('regPanel')) $('regPanel').hidden = !reg;
      if ($('inPanel')) $('inPanel').hidden = reg;
      clearError();
    }

    if ($('sendCodeBtn')) {
      $('sendCodeBtn').addEventListener('click', async () => {
        const now = Date.now();
        if (now - lastSendAt < SEND_COOLDOWN) {
          showError('⏳ Wait ' + Math.ceil((SEND_COOLDOWN - (now - lastSendAt)) / 1000) + 's before resending.');
          return;
        }
        const name = ($('rName')?.value || '').trim();
        const rawPhone = ($('rPhone')?.value || '').trim();
        const email = ($('rEmail')?.value || '').trim().toLowerCase();
        const pass = $('rPass')?.value || '';
        if (!name || !rawPhone || !isEmail(email)) { showError('Please fill in name, phone, and a valid email.'); return; }
        if (pass.length < 6) { showError('Password must be at least 6 characters.'); return; }
        const phone = normalizePhone(rawPhone);
        if (phone.length < 10) { showError('Invalid phone number. Use 23275xxxxxxx format.'); return; }

        $('sendCodeBtn').disabled = true;
        $('sendCodeBtn').textContent = 'Sending...';
        clearError();
        try {
          const res = await apiFetch('/api/auth/register', { name, phone, email, password: pass });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            pendingPhone = phone; verifyFails = 0; lastSendAt = Date.now();
            if ($('codeStep')) $('codeStep').hidden = false;
            alert('✔ Verification code sent to ' + email + ' — check inbox and Spam.');
          } else { showError('❌ ' + (data.error || 'Registration failed.')); }
        } catch (e) { showError('❌ Network error. Backend is waking up — please wait 30s and try again.'); }
        finally { $('sendCodeBtn').disabled = false; $('sendCodeBtn').textContent = 'Send Verification Code'; }
      });
    }

    if ($('verifyBtn')) {
      $('verifyBtn').addEventListener('click', async () => {
        if (!pendingPhone) { showError('Request a new code first.'); return; }
        const code = ($('rCode')?.value || '').trim();
        if (!/^\d{4,6}$/.test(code)) { showError('Please enter 6-digit code.'); return; }
        $('verifyBtn').disabled = true; $('verifyBtn').textContent = 'Verifying...'; clearError();
        try {
          const res = await apiFetch('/api/auth/verify', { phone: pendingPhone, code });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.token && data.user) {
            localStorage.setItem('su_token', data.token);
            localStorage.setItem('su_profile', JSON.stringify(data.user));
            sessionStorage.setItem('su_user', data.user.email);
            alert('✔ Welcome to SIERRAUNLOCK, ' + data.user.name + '!'); location.href = next;
          } else {
            verifyFails += 1;
            if (verifyFails >= 5) { pendingPhone = ''; if ($('codeStep')) $('codeStep').hidden = true; showError('❌ Too many wrong codes. Request new code.'); }
            else { showError('❌ Wrong code (' + verifyFails + '/5). Try again.'); }
          }
        } catch (e) { showError('❌ Network error. Please try again.'); }
        finally { $('verifyBtn').disabled = false; $('verifyBtn').textContent = 'Verify & Create Account'; }
      });
    }

    const signInBtn = $('signInBtn') || $('loginBtn') || $('btnSignIn');
    if (signInBtn) {
      signInBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const emailInput = $('iEmail') || $('email') || $('loginEmail');
        const passInput = $('iPass') || $('password') || $('loginPassword');
        const emailRaw = (emailInput?.value || '').trim();
        const pass = passInput?.value || '';
        if (!emailRaw || !pass) { showError('Please enter email and password.'); return; }
        const emailOrPhone = isEmail(emailRaw) ? emailRaw.toLowerCase() : normalizePhone(emailRaw);

        signInBtn.disabled = true;
        const oldText = signInBtn.textContent;
        signInBtn.textContent = 'Signing In...';
        clearError();
        try {
          const res = await apiFetch('/api/auth/login', { emailOrPhone: emailOrPhone, password: pass });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.token && data.user) {
            localStorage.setItem('su_token', data.token);
            localStorage.setItem('su_profile', JSON.stringify(data.user));
            sessionStorage.setItem('su_user', data.user.email);
            clearError();
            alert('✔ Welcome back, ' + data.user.name + '!');
            location.href = next;
          } else { showError('❌ ' + (data.error || 'Invalid email or password.')); }
        } catch (err) {
          showError('❌ Network error. Server is waking up (Render free sleeps 30s). Please wait 30 seconds and click Sign In again.');
          console.error('Login network error:', err);
        } finally { signInBtn.disabled = false; signInBtn.textContent = oldText || 'Sign In'; }
      });
    }
  });
})();