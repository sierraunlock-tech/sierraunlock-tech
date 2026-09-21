/* =====================================================================
   SIERRAUNLOCK • CUSTOMER ACCOUNTS + BACKEND API — auth.js (v3 • API CONNECTED)
   ---------------------------------------------------------------------
   WHAT IS THIS FILE?
   The customer account engine (auth.html ONLY). It connects directly to
   the SIERRAUNLOCK backend API (v3.32+) for secure, vault-backed accounts.
   
   • Create Account → Backend sends a 6-digit verification code via EmailJS.
   • Sign In → Backend verifies credentials securely → returns session token.
   
   SECURITY NOTES:
   • Passwords are hashed with bcrypt on the server (never stored in plain text).
   • Accounts are persisted in the GitHub Vault, surviving browser cache clears.
   • Session token stored securely in localStorage as 'su_token'.

   OWNER: SIERRAUNLOCK Engineering • Waterloo / Koidu, Sierra Leone
   ===================================================================== */
'use strict';
(function () {

  // Use relative path so it works on both localhost and production
  const API_BASE = ''; 
  
  const $ = (id) => document.getElementById(id);

  let pendingPhone = '';
  let verifyFails = 0;

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
        const name = $('rName').value.trim();
        const phone = $('rPhone').value.trim();
        const email = $('rEmail').value.trim().toLowerCase();
        const pass = $('rPass').value;

        if (!name || !phone || !email || !/^\S+@\S+\.\S+$/.test(email)) { 
          alert('Please fill in name, phone, and a valid email.'); return; 
        }
        if (pass.length < 6) { 
          alert('Password must be at least 6 characters.'); return; 
        }

        $('sendCodeBtn').disabled = true;
        $('sendCodeBtn').textContent = 'Sending...';

        try {
          const res = await fetch(API_BASE + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, password: pass })
          });
          const data = await res.json();

          if (res.ok) {
            pendingPhone = phone;
            verifyFails = 0;
            $('codeStep').hidden = false;
            alert('✔ Verification code sent to ' + email + ' — check your inbox (and Spam).');
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
        
        if (!code) { alert('Please enter the 6-digit code.'); return; }

        $('verifyBtn').disabled = true;
        $('verifyBtn').textContent = 'Verifying...';

        try {
          const res = await fetch(API_BASE + '/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: pendingPhone, code })
          });
          const data = await res.json();

          if (res.ok) {
            // Save token and profile securely
            localStorage.setItem('su_token', data.token);
            localStorage.setItem('su_profile', JSON.stringify(data.user));
            sessionStorage.setItem('su_user', data.user.email); // For main.js compatibility
            
            alert('✔ Welcome to SIERRAUNLOCK, ' + data.user.name + '! Your account is verified.');
            location.href = next;
          } else {
            verifyFails += 1;
            if (verifyFails >= 5) { 
              pendingPhone = ''; 
              $('codeStep').hidden = true; 
              alert('❌ Too many wrong codes. Request a new code to continue.'); 
            } else {
              alert('❌ Wrong code (' + verifyFails + '/5). Check the 6 digits and try again.');
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
          const data = await res.json();

          if (res.ok) {
            localStorage.setItem('su_token', data.token);
            localStorage.setItem('su_profile', JSON.stringify(data.user));
            sessionStorage.setItem('su_user', data.user.email);
            
            alert('✔ Welcome back, ' + data.user.name + '!');
            location.href = next;
          } else {
            alert('❌ ' + (data.error || 'Invalid email or password.'));
          }
        } catch (e) {
          alert('❌ Network error. Please check your connection.');
        } finally {
          $('signInBtn').disabled = false;
          $('signInBtn').textContent = 'Sign In';
        }
      });
    }
  });
})();