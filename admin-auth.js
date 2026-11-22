const status = document.getElementById('login-status');
const login = document.getElementById('google-login');
const logout = document.getElementById('logout');
const admin = document.getElementById('admin');
if (window.dittoRuntime?.cloud) {
  document.getElementById('login').hidden = false;
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('로그인 설정을 불러오지 못했습니다.');
    const config = await response.json();
    const {initializeApp} = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js');
    const {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut,setPersistence,browserSessionPersistence} =
      await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js');
    const auth = getAuth(initializeApp(config));
    await setPersistence(auth,browserSessionPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    let revision = 0;
    let generation = 0;
    async function request(method, body) {
      const user = auth.currentUser;
      if (!user) throw new Error('로그인해 주세요.');
      const response = await fetch('/api/admin/menu', {
        method, cache:'no-store',
        headers:{Authorization:'Bearer ' + await user.getIdToken(),'Content-Type':'application/json'},
        body:body ? JSON.stringify(body) : undefined
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '저장하지 못했습니다.');
      return result;
    }
    window.dittoCloud = {
      async save(next) {
        const result = await request('PUT',{records:next,revision});
        revision = result.revision;
      }
    };
    login.disabled = false;
    login.onclick = async () => {
      login.disabled = true;
      try { await signInWithPopup(auth,provider); }
      catch { status.textContent = '로그인을 완료하지 못했습니다. 팝업 허용 여부를 확인하고 다시 시도해 주세요.'; }
      finally { login.disabled = false; }
    };
    logout.onclick = () => signOut(auth);
    onAuthStateChanged(auth,async user => {
      const current = ++generation;
      admin.hidden = true;
      logout.hidden = !user;
      if (!user) {
        records = [];
        form.reset();
        form.hidden = true;
        selected = null;
        renderAdmin();
        status.textContent = '허용된 Google 계정으로 로그인해 주세요.';
        return;
      }
      status.textContent = '접근 권한을 확인하고 있습니다.';
      try {
        const data = await request('GET');
        if (current !== generation) return;
        records = data.records;
        revision = data.revision;
        selected = null;
        form.hidden = true;
        renderAdmin();
        document.querySelector('.preview-note').textContent = '저장한 메뉴는 손님 화면에 반영됩니다.';
        status.textContent = user.email;
        admin.hidden = false;
      } catch(error) {
        if (current === generation) status.textContent = error.message;
      }
    });
  } catch(error) { status.textContent = error.message || '로그인을 준비하지 못했습니다. 새로고침해 주세요.'; }
}
