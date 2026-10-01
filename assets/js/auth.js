/* =====================================================================
   SIERRAUNLOCK • auth.js v3.44.12 FINAL CLEAN
   - NO email verification (backend doesn't have it)
   - Direct register -> instant login
   - Forgot uses /api/auth/forgot + /api/auth/reset-password
   - Redirects to account.html (matches your actual file)
   - Saves token to BOTH localStorage and sessionStorage
   ===================================================================== */
'use strict';
(function () {
  const API_BASE = 'https://sierraunlock-tech-1-4um3.onrender.com';
  const $ = (id) => document.getElementById(id);
  const normalizePhone = (p) => String(p||'').replace(/\D/g,'').replace(/^0/,'232');
  const isEmail = (e) => /^\S+@\S+\.\S+$/.test(e);

  function showError(msg){
    const box = $('authError') || $('inError') || $('regError') || $('errorBox') || $('li_msg') || $('rg_msg') || $('rs_msg');
    if(box){ box.textContent = msg; box.style.display='block'; box.className='msg err'; }
  }
  function showOk(msg){
    const box = $('authError') || $('inError') || $('regError') || $('errorBox') || $('li_msg') || $('rg_msg') || $('rs_msg');
    if(box){ box.textContent = msg; box.style.display='block'; box.className='msg ok'; }
  }
  function clearError(){
    const boxes = document.querySelectorAll('.msg');
    boxes.forEach(b=>{ b.style.display='none'; b.textContent=''; });
  }

  async function apiFetch(path, body){
    try{
      return await fetch(API_BASE+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    }catch(e){
      await new Promise(r=>setTimeout(r,5000));
      return await fetch(API_BASE+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    
    // 1. LOGIN
    const signInBtn = $('signInBtn') || $('loginBtn') || $('btnLogin') || $('btnSignIn');
    if(signInBtn){
      signInBtn.addEventListener('click', async (e)=>{
        e.preventDefault();
        const emailInput = $('iEmail') || $('email') || $('loginEmail') || $('li_emailOrPhone');
        const passInput = $('iPass') || $('password') || $('loginPassword') || $('li_password');
        const raw = (emailInput?.value||'').trim();
        const pass = passInput?.value||'';
        if(!raw||!pass){ showError('Fill email and password'); return; }
        const emailOrPhone = isEmail(raw)?raw.toLowerCase():normalizePhone(raw);
        signInBtn.disabled=true; signInBtn.textContent='Signing In...'; clearError();
        try{
          const res = await apiFetch('/api/auth/login',{emailOrPhone,password:pass});
          const data = await res.json();
          if(res.ok && data.token){
            localStorage.setItem('su_token',data.token);
            sessionStorage.setItem('su_token',data.token); // ✅ FIX: Added for account.html compatibility
            localStorage.setItem('su_profile',JSON.stringify(data.user));
            showOk('Welcome back '+data.user.name+'! Redirecting...');
            setTimeout(()=>{ location.href='account.html'; },800);
          }else{ showError(data.error||'Login failed'); }
        }catch(err){ showError('Network error — Render is waking up, wait 30s and try again'); }
        finally{ signInBtn.disabled=false; signInBtn.textContent='Sign In'; }
      });
    }

    // 2. REGISTER - INSTANT (NO VERIFICATION CODE)
    const sendCodeBtn = $('sendCodeBtn') || $('btnRegister') || $('btnReg');
    if(sendCodeBtn){
      sendCodeBtn.addEventListener('click', async ()=>{
        const actualName = $('rg_name')?.value.trim() || $('rName')?.value.trim() || '';
        const actualPhone = $('rg_phone')?.value.trim() || $('rPhone')?.value.trim() || '';
        const actualEmail = $('rg_email')?.value.trim() || $('rEmail')?.value.trim() || '';
        const actualPass = $('rg_password')?.value || $('rPass')?.value || '';

        if(!actualName||!actualPhone||!actualPass){ showError('Fill name, phone, password'); return; }
        if(actualPass.length<6){ showError('Password min 6 chars'); return; }
        const phone = normalizePhone(actualPhone);
        sendCodeBtn.disabled=true; sendCodeBtn.textContent='Creating...'; clearError();
        try{
          const res = await apiFetch('/api/auth/register',{name:actualName,phone,email:actualEmail,password:actualPass});
          const data = await res.json();
          if(res.ok && data.token){
            localStorage.setItem('su_token',data.token);
            sessionStorage.setItem('su_token',data.token); // ✅ FIX: Added for account.html compatibility
            localStorage.setItem('su_profile',JSON.stringify(data.user));
            showOk('Account created! Redirecting...');
            setTimeout(()=>{ location.href='account.html'; },800);
          }else{ showError(data.error||'Register failed'); }
        }catch(e){ showError('Network error — wait 30s and try again'); }
        finally{ sendCodeBtn.disabled=false; sendCodeBtn.textContent='Create Account'; }
      });
    }

    // 3. FORGOT PASSWORD - USES /api/auth/forgot
    const forgotBtn = $('btnForgot') || $('forgotBtn');
    if(forgotBtn){
      forgotBtn.addEventListener('click', async ()=>{
        const raw = $('rs_emailOrPhone')?.value.trim() || $('fg_input')?.value.trim() || '';
        if(!raw){ showError('Enter email or phone'); return; }
        const emailOrPhone = isEmail(raw)?raw.toLowerCase():normalizePhone(raw);
        forgotBtn.disabled=true; forgotBtn.textContent='Sending...'; clearError();
        try{
          const res = await apiFetch('/api/auth/forgot',{emailOrPhone});
          const data = await res.json();
          if(res.ok){
            showOk('Code: '+data.message+' | Phone: '+data.phone+' | Check Render logs!');
            const resetBox = $('resetSection') || $('resetBox');
            if(resetBox) resetBox.style.display='block';
            const disp = $('rs_phone_display') || $('rs_phone');
            if(disp) disp.value=data.phone||'';
          }else{ showError(data.error||'Failed'); }
        }catch(e){ showError('Network error'); }
        finally{ forgotBtn.disabled=false; forgotBtn.textContent='Send Reset Code'; }
      });
    }

    // 4. RESET PASSWORD - USES /api/auth/reset-password
    const resetBtn = $('btnReset');
    if(resetBtn){
      resetBtn.addEventListener('click', async ()=>{
        const phone = ($('rs_phone_display')?.value || $('rs_phone')?.value || '').trim();
        const code = $('rs_code')?.value.trim() || '';
        const newPassword = $('rs_newpass')?.value || $('rs_new')?.value || '';
        if(!phone||!code||!newPassword){ showError('Fill all reset fields'); return; }
        resetBtn.disabled=true; resetBtn.textContent='Saving...';
        try{
          const res = await apiFetch('/api/auth/reset-password',{phone,code,newPassword});
          const data = await res.json();
          if(res.ok){ showOk('Password reset! Login now'); setTimeout(()=>{ location.href='auth.html'; },1500); }
          else{ showError(data.error||'Reset failed'); }
        }catch(e){ showError('Network error'); }
        finally{ resetBtn.disabled=false; resetBtn.textContent='Set New Password'; }
      });
    }

  });
})();