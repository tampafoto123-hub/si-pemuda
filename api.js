/* API client: 1 request = 1 POST text/plain (tanpa preflight CORS), cache stale-while-revalidate */
const Api = {
  token: null,
  inflight: {},
  async call(action, data = {}, retry = true) {
    let res;
    try {
      res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: Api.token, ...data }) });
    } catch (e) { throw new Error('Tidak ada koneksi. Coba lagi.'); }
    const j = await res.json();
    if (!j.ok) {
      if (j.error === 'AUTH_EXPIRED' && retry && (await Auth.refresh())) return Api.call(action, data, false);
      if (j.error === 'AUTH_EXPIRED') { Auth.logout(true); throw new Error('Sesi berakhir, silakan masuk lagi'); }
      throw new Error(j.error);
    }
    return j.data;
  },
  key: t => 'sp_c_' + t,
  cached(t) { try { return JSON.parse(localStorage.getItem(Api.key(t))); } catch (e) { return null; } },
  /** Panggil cb(data, fromCache) dua kali: segera dari cache (jika ada), lalu data segar. */
  async list(table, cb, force) {
    const c = !force && Api.cached(table);
    if (c) cb(c, true);
    try {
      const d = await (Api.inflight[table] = Api.inflight[table] || Api.call('list', { table }).finally(() => delete Api.inflight[table]));
      try { localStorage.setItem(Api.key(table), JSON.stringify(d)); } catch (e) {}
      cb(d, false); return d;
    } catch (e) { if (!c) throw e; toast('Menampilkan data tersimpan (offline)', true); }
  },
  async get(table) { let out; await Api.list(table, d => { out = d; }); return out; },
  drop(...t) { t.forEach(x => localStorage.removeItem(Api.key(x))); },
  clearCache() { Object.keys(localStorage).filter(k => k.startsWith('sp_c_')).forEach(k => localStorage.removeItem(k)); },
  async save(table, row) { const r = await Api.call('save', { table, row }); Api.drop(table); return r; },
  async del(table, id) { const r = await Api.call('del', { table, id }); Api.drop(table); return r; }
};

const Auth = {
  init(onLogin) {
    Auth.onLogin = onLogin;
    const saved = sessionStorage.getItem('sp_tok');
    if (saved && Auth.exp(saved) > Date.now() + 60000) { Api.token = saved; return onLogin(); }
    Auth.showLogin();
  },
  exp(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch (e) { return 0; } },
  gsi(cb) {
    if (window.google && google.accounts) return cb();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = cb; document.head.appendChild(s);
  },
  showLogin() {
    document.getElementById('login').classList.remove('hide'); document.getElementById('app').classList.add('hide');
    Auth.gsi(() => {
      google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: r => { Auth.setToken(r.credential); Auth.onLogin(); }, auto_select: true, cancel_on_tap_outside: false });
      google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', width: 280 });
    });
  },
  setToken(t) { Api.token = t; sessionStorage.setItem('sp_tok', t); },
  /** Minta token baru diam-diam (One Tap / auto select). */
  refresh() {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      Auth.gsi(() => {
        google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, auto_select: true, callback: r => { Auth.setToken(r.credential); fin(true); } });
        google.accounts.id.prompt(n => { if (n.isNotDisplayed() || n.isSkippedMoment()) fin(false); });
        setTimeout(() => fin(false), 8000);
      });
    });
  },
  logout(expired) {
    sessionStorage.removeItem('sp_tok'); Api.token = null; Api.clearCache();
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    location.hash = ''; if (expired) sessionStorage.setItem('sp_msg', 'Sesi berakhir, silakan masuk lagi.');
    location.reload();
  }
};
