const MENU = [
  ['dashboard', 'Dashboard', 'dash'], ['anggota', 'Data Anggota', 'users'], ['roster', 'Jadwal Roster', 'cal'], ['presensi', 'Presensi', 'qr'],
  ['sel', 'Kelompok Sel', 'group'], ['kas', 'Kas Pemuda', 'wallet'], ['warta', 'Warta & Konseling', 'news'], ['profil', 'Profil & Kartu QR', 'heart'], ['pengaturan', 'Pengaturan', 'cog', 'bph']
];
const ROLE_LBL = { bph: 'BPH', koordinator: 'Koordinator', anggota: 'Anggota' };
let curView = null;

function applyBrand() {
  const n = S.settings.app_name || 'SI PEMUDA', l = S.settings.logo_url;
  $('#brand').innerHTML = (l ? `<img src="${esc(l)}" alt="">` : ico('church')) + `<span>${esc(n)}</span>`;
  document.title = n;
  if (l) { let f = $('link[rel=icon]'); if (!f) { f = document.createElement('link'); f.rel = 'icon'; document.head.appendChild(f); } f.href = l; }
}
function buildNav() {
  const items = MENU.filter(m => !m[3] || m[3] === S.me.role);
  $('#nav').innerHTML = items.map(([id, l, i]) => `<a data-v="${id}" href="#${id}">${ico(i)}<span>${l}</span></a>`).join('');
  const bn = ['dashboard', 'roster', 'presensi', 'kas'].map(id => items.find(m => m[0] === id));
  $('#bn').innerHTML = bn.map(([id, l, i]) => `<a data-v="${id}" href="#${id}">${ico(i)}<span>${l.split(' ').pop()}</span></a>`).join('') + `<a id="bmenu">${ico('menu')}<span>Menu</span></a>`;
  $('#bmenu').onclick = () => toggleDrawer(true);
}
function toggleDrawer(open) {
  $('aside').classList.toggle('open', open); let s = $('.scrim');
  if (open && !s) { s = document.createElement('div'); s.className = 'scrim'; s.onclick = () => toggleDrawer(false); document.body.appendChild(s); } else if (!open && s) s.remove();
}
async function render(force) {
  const id = (location.hash.slice(1) || 'dashboard').split('?')[0];
  const item = MENU.find(m => m[0] === id && (!m[3] || m[3] === S.me.role)) || MENU[0];
  curView = item[0]; $('#title').textContent = item[1];
  document.querySelectorAll('[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === curView));
  toggleDrawer(false);
  const el = $('#view'); el.onclick = null; el.innerHTML = skeleton();
  window.scrollTo(0, 0);
  try { if (force || curView === 'dashboard') await refreshBoot(); await Views[curView](el); } catch (e) { el.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
}
async function refreshBoot() { S.boot = await Api.call('boot'); S.me = S.boot.me; S.settings = S.boot.settings; applyBrand(); setBell(S.boot.unread); }
function setBell(n) { $('#bellc').innerHTML = n ? `<span class="dot">${n > 9 ? '9+' : n}</span>` : ''; }

async function start() {
  $('#login').classList.add('hide'); $('#boot').classList.remove('hide');
  try { await refreshBoot(); }
  catch (e) {
    $('#boot').classList.add('hide'); $('#login').classList.remove('hide');
    $('#lmsg').textContent = e.message === 'PENDING' ? 'Akun Anda sudah terdaftar dan menunggu persetujuan pengurus. Silakan coba lagi nanti.' : e.message;
    sessionStorage.removeItem('sp_tok'); Api.token = null; return;
  }
  $('#boot').classList.add('hide'); $('#app').classList.remove('hide');
  $('#me').innerHTML = `<div><b>Role: ${ROLE_LBL[S.me.role] || S.me.role}</b><span>${esc(S.me.email)}</span></div><button id="lo" title="Keluar" aria-label="Keluar">${ico('out')}</button>`;
  $('#lo').onclick = () => Auth.logout();
  buildNav(); window.addEventListener('hashchange', () => render()); render();
}

document.addEventListener('DOMContentLoaded', () => {
  $('#ham').innerHTML = ico('menu'); $('#ham').onclick = () => toggleDrawer(true);
  $('#sync').innerHTML = ico('sync'); $('#bell').insertAdjacentHTML('afterbegin', ico('bell'));
  $('#sync').onclick = () => { Api.clearCache(); render(true); toast('Data diperbarui'); };
  $('#bell').onclick = async e => {
    e.stopPropagation(); let p = $('.notifp'); if (p) return p.remove();
    p = document.createElement('div'); p.className = 'notifp'; p.innerHTML = '<div class="sub">Memuat...</div>'; $('#bellw').appendChild(p);
    try { const n = await Api.call('notifs'); p.innerHTML = n.length ? n.map(x => `<div class="${x.dibaca !== 'ya' ? 'un' : ''}"><b>${esc(x.judul)}</b><div class="sub">${esc(x.isi)}</div></div>`).join('') : '<div class="sub">Belum ada notifikasi</div>'; if (n.some(x => x.dibaca !== 'ya')) { Api.call('notifRead'); setBell(0); } } catch (er) { p.innerHTML = esc(er.message); }
  };
  document.addEventListener('click', e => { const p = $('.notifp'); if (p && !e.target.closest('#bellw')) p.remove(); });
  const tick = () => { const d = new Date(); $('#clk').innerHTML = `<b>${d.toLocaleTimeString('id-ID').replace(/:/g, '.')}</b>${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`; };
  tick(); setInterval(tick, 1000);
  const m = sessionStorage.getItem('sp_msg'); if (m) { $('#lmsg').textContent = m; sessionStorage.removeItem('sp_msg'); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  Auth.init(start);
});
