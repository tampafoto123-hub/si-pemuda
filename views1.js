const Views = {};
const S = { me: null, settings: {}, boot: null };
const isBph = () => S.me.role === 'bph';
const isStaff = () => S.me.role === 'bph' || S.me.role === 'koordinator';
const tableHTML = (cols, rows, empty) => rows.length
  ? `<div class="tw"><table><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  : `<div class="card empty">${empty || 'Belum ada data'}</div>`;
const sacTag = (lbl, v, cls) => `<span class="tag ${cls}">${lbl}: ${v === 'Sudah' ? 'Sudah' : 'Belum'}</span>`;
const stTag = s => ({ Hadir: 't-ok', Bisa: 't-b', 'Tukar Jadwal': 't-w' }[s] ? `<span class="tag ${({ Hadir: 't-ok', Bisa: 't-b', 'Tukar Jadwal': 't-w' })[s]}">${s}</span>` : '<span class="tag t-n">Belum konfirmasi</span>');
const MEMBER_FIELDS = () => [
  { k: 'nama', label: 'Nama lengkap', req: 1, full: 1 }, { k: 'tgl_lahir', label: 'Tanggal lahir', type: 'date' }, { k: 'hp', label: 'No. HP / WA', type: 'tel' },
  { k: 'email', label: 'Email Google', type: 'email' }, { k: 'aktif', label: 'Status keaktifan', type: 'select', opts: ['ya', 'tidak'], def: 'ya' },
  { k: 'alamat', label: 'Alamat', full: 1 }, { k: 'rayon', label: 'Rayon / wilayah' },
  { k: 'kolom', label: 'Kolom', type: 'select', opts: Array.from({ length: CFG.KOLOM_MAX }, (_, i) => String(i + 1)) },
  { k: 'baptis', label: 'Baptis', type: 'select', opts: ['Belum', 'Sudah'] }, { k: 'tgl_baptis', label: 'Tgl baptis', type: 'date' },
  { k: 'sidi', label: 'Sidi', type: 'select', opts: ['Belum', 'Sudah'] }, { k: 'tgl_sidi', label: 'Tgl sidi', type: 'date' },
  { k: 'minat', label: 'Minat & bakat pelayanan (pisahkan koma: musik, multimedia, dekorasi, mengajar)', full: 1 }
];

/* ---------- Dashboard ---------- */
Views.dashboard = async el => {
  const b = S.boot, st = b.stats;
  el.innerHTML = `<div class="grid g3">
    <div class="card stat"><span>Total Pemuda</span><b>${st.totalPemuda}</b></div>
    <div class="card stat"><span>Presensi Terakhir${st.presensiEvent ? ' · ' + esc(st.presensiEvent) : ''}</span><b>${st.presensiTerakhir}</b></div>
    <div class="card stat dark"><span>Saldo Kas Terkini</span><b>${rp(st.saldo)}</b></div></div>
  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3>Jadwal pelayanan saya</h3><div class="list">${b.myRoster.length ? b.myRoster.map(r => `<div><div><b>${esc(r.posisi)}</b><div class="sub">${tgl(r.tanggal)} · ${esc(r.ibadah || '')}</div></div>${stTag(r.status)}</div>`).join('') : '<div class="sub">Belum ada jadwal mendatang.</div>'}</div></div>
    <div class="card"><h3>Kegiatan mendatang</h3><div class="list">${b.upcoming.length ? b.upcoming.map(e => `<div><div><b>${esc(e.nama)}</b><div class="sub">${tgl(e.tanggal)} ${esc(e.waktu || '')} · ${esc(e.lokasi || '')}</div></div><span class="tag t-s">${esc(e.kategori || '')}</span></div>`).join('') : '<div class="sub">Belum ada kegiatan.</div>'}</div></div>
    ${b.bday.length ? `<div class="card"><h3>🎂 Ulang tahun hari ini</h3><div class="list">${b.bday.map(x => `<div><b>${esc(x.nama)}</b></div>`).join('')}</div></div>` : ''}
    ${b.openCounsel ? `<div class="card"><h3>Permohonan doa/konseling</h3><p class="sub">${b.openCounsel} permohonan menunggu tindak lanjut.</p><br><a class="btn sm" href="#warta">Buka</a></div>` : ''}
  </div>`;
};

/* ---------- Data Anggota ---------- */
Views.anggota = async el => {
  const q = { s: '', aktif: 'ya', rayon: '' }; let rows = [];
  el.innerHTML = `<div class="sec"><h2>Data Anggota</h2><div class="tools" style="margin:0">
    ${isBph() ? `<button class="btn" data-a="add">${ico('plus')} Tambah</button><button class="btn sec2" data-a="imp">Impor CSV</button>` : ''}
    ${isStaff() ? `<button class="btn sec2" data-a="print">${ico('print')} Cetak</button>` : ''}</div></div>
    <div class="tools"><input id="qs" placeholder="Cari nama / ID..." type="search"><select id="qa"><option value="ya">Aktif</option><option value="tidak">Non-aktif</option><option value="">Semua</option></select><select id="qr"><option value="">Semua rayon</option></select></div><div id="tb">${skeleton()}</div>`;
  const draw = () => {
    const rs = [...new Set(rows.map(r => r.rayon).filter(Boolean))].sort(); const sel = $('#qr', el);
    if (sel.options.length - 1 !== rs.length) sel.innerHTML = '<option value="">Semua rayon</option>' + rs.map(r => `<option${r === q.rayon ? ' selected' : ''}>${esc(r)}</option>`).join('');
    const f = rows.filter(r => (!q.aktif || (r.aktif || 'ya') === q.aktif) && (!q.rayon || r.rayon === q.rayon) && (!q.s || (r.nama + r.id).toLowerCase().includes(q.s)));
    $('#tb', el).innerHTML = tableHTML([
      { h: 'ID', f: r => `<span class="mono">${esc(r.id)}</span>` },
      { h: 'Nama Lengkap', f: r => `<b>${esc(r.nama)}</b>${r.hp ? `<div class="sub">☎ ${esc(r.hp)}</div>` : ''}${r.minat ? `<div class="sub">${esc(r.minat)}</div>` : ''}` },
      { h: 'Rayon & Kolom', f: r => `${esc(r.rayon || '-')}<div class="pl">${r.kolom ? 'Kolom ' + esc(r.kolom) : ''}</div>` },
      { h: 'Status Sakramen', f: r => sacTag('Baptis', r.baptis, 't-b') + '<br>' + sacTag('Sidi', r.sidi, 't-s') },
      ...(isBph() ? [{ h: '', f: r => `<button class="btn sm sec2" data-e="${esc(r.id)}">Ubah</button> <button class="btn sm danger" data-d="${esc(r.id)}">Hapus</button>` }] : [])
    ], f, 'Tidak ada anggota yang cocok');
  };
  Api.list('Members', d => { rows = d; draw(); }).catch(e => { $('#tb', el).innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
  $('#qs', el).oninput = debounce(e => { q.s = e.target.value.toLowerCase(); draw(); }, 120);
  $('#qa', el).onchange = e => { q.aktif = e.target.value; draw(); }; $('#qr', el).onchange = e => { q.rayon = e.target.value; draw(); };
  const reload = async () => { Api.drop('Members'); await Api.list('Members', d => { rows = d; draw(); }, true); };
  el.onclick = async e => {
    const t = e.target.closest('[data-a],[data-e],[data-d]'); if (!t) return;
    if (t.dataset.a === 'add') formModal('Tambah anggota', MEMBER_FIELDS(), {}, async o => { await Api.save('Members', o); toast('Tersimpan'); reload(); });
    if (t.dataset.e) formModal('Ubah anggota', MEMBER_FIELDS(), rows.find(r => r.id === t.dataset.e), async o => { await Api.save('Members', { ...o, id: t.dataset.e }); toast('Tersimpan'); reload(); });
    if (t.dataset.d && await confirmBox('Hapus anggota ini? Sebaiknya ubah status menjadi non-aktif.')) { await Api.del('Members', t.dataset.d); reload(); }
    if (t.dataset.a === 'print') printDoc('anggota', {}, false).catch(er => toast(er.message, true));
    if (t.dataset.a === 'imp') formModal('Impor anggota dari CSV', [{ k: 'file', label: 'File CSV (kolom: nama,tgl_lahir,email,hp,alamat,rayon,kolom,baptis,sidi,minat)', type: 'file', accept: '.csv', full: 1 }], {}, async o => {
      if (!o.file) throw new Error('Pilih file'); const r = await Api.call('importMembers', { rows: parseCSV(await o.file.text()) }); toast(`Masuk ${r.ok}, dilewati ${r.skip}`); reload();
    }, 'Impor');
  };
};
function parseCSV(txt) {
  const lines = txt.replace(/\r/g, '').split('\n').filter(l => l.trim()); if (lines.length < 2) return [];
  const sp = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o.map(x => x.trim()); };
  const h = sp(lines[0]).map(x => x.toLowerCase()); return lines.slice(1).map(l => { const v = sp(l), o = {}; h.forEach((k, i) => o[k] = v[i] || ''); return o; });
}

/* ---------- Profil + Kartu QR ---------- */
Views.profil = async el => {
  const all = await Api.get('Members'); const m = all.find(x => x.id === S.me.member_id);
  if (!m) { el.innerHTML = '<div class="card empty">Akun Anda belum terhubung ke data anggota. Hubungi pengurus agar email ini dicantumkan pada data anggota Anda.</div>'; return; }
  el.innerHTML = `<div class="grid g2"><div class="card"><h3>${esc(m.nama)}</h3><p class="sub mono">${esc(m.id)}</p><br>
    <p>${sacTag('Baptis', m.baptis, 't-b')}${sacTag('Sidi', m.sidi, 't-s')}</p><br><p class="sub">Rayon ${esc(m.rayon || '-')} · Kolom ${esc(m.kolom || '-')}</p>
    <p class="sub">HP: ${esc(m.hp || '-')}<br>Lahir: ${tgl(m.tgl_lahir)}<br>Alamat: ${esc(m.alamat || '-')}<br>Minat: ${esc(m.minat || '-')}</p><br><button class="btn" id="ed">Ubah profil</button></div>
    <div class="card"><h3>Kartu QR saya</h3><p class="sub">Tunjukkan ke pengurus untuk presensi cepat.</p><div class="qrbox" id="qr"></div></div></div>`;
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js').then(() => new QRCode($('#qr', el), { text: 'MBR|' + m.id, width: 200, height: 200 }));
  $('#ed', el).onclick = () => formModal('Ubah profil', [{ k: 'tgl_lahir', label: 'Tanggal lahir', type: 'date' }, { k: 'hp', label: 'No. HP / WA', type: 'tel' }, { k: 'alamat', label: 'Alamat', full: 1 }, { k: 'minat', label: 'Minat & bakat pelayanan', full: 1 }], m,
    async o => { await Api.call('saveProfile', { row: o }); Api.drop('Members'); toast('Profil diperbarui'); Views.profil(el); });
};

/* ---------- Roster ---------- */
Views.roster = async el => {
  let rows = [], members = [], swaps = []; const q = { from: todayStr(), to: '' };
  el.innerHTML = `<div class="sec"><h2>Jadwal Roster</h2><div class="tools" style="margin:0">${isStaff() ? `<button class="btn" data-a="add">${ico('plus')} Tambah</button><button class="btn sec2" data-a="print">${ico('print')} Cetak</button>` : ''}</div></div>
    <div id="mine"></div><div class="tools"><input type="date" id="qf" value="${q.from}" title="Dari"><input type="date" id="qt" title="Sampai"></div><div id="tb">${skeleton()}</div><div id="sw"></div>`;
  const myId = S.me.member_id;
  const acts = r => (r.member_id === myId || isStaff()) ? ['Hadir', 'Bisa', 'Tukar Jadwal'].map(s => `<button class="btn sm ${r.status === s ? '' : 'sec2'}" data-c="${r.id}|${s}">${s}</button>`).join(' ') : '';
  const draw = () => {
    const f = rows.filter(r => (!q.from || r.tanggal >= q.from) && (!q.to || r.tanggal <= q.to)).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.posisi.localeCompare(b.posisi));
    const mine = rows.filter(r => r.member_id === myId && r.tanggal >= todayStr()).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    $('#mine', el).innerHTML = mine.length ? `<div class="card" style="margin-bottom:16px"><h3>Jadwal saya</h3><div class="list">${mine.map(r => `<div style="flex-wrap:wrap"><div><b>${esc(r.posisi)}</b><div class="sub">${tgl(r.tanggal)} · ${esc(r.ibadah || '')}</div></div><div>${acts(r)}</div></div>`).join('')}</div></div>` : '';
    $('#tb', el).innerHTML = tableHTML([
      { h: 'Tanggal', f: r => tgl(r.tanggal) }, { h: 'Ibadah', f: r => esc(r.ibadah || '') }, { h: 'Posisi', f: r => `<b>${esc(r.posisi)}</b>` },
      { h: 'Pelayan', f: r => esc(r.nama || '-') }, { h: 'Konfirmasi', f: r => stTag(r.status) },
      ...(isStaff() ? [{ h: '', f: r => `<button class="btn sm sec2" data-e="${r.id}">Ubah</button> <button class="btn sm danger" data-d="${r.id}">Hapus</button>` }] : [])
    ], f, 'Belum ada jadwal pada rentang ini');
    $('#sw', el).innerHTML = swaps.length && isStaff() ? `<br><div class="card"><h3>Riwayat penukaran jadwal</h3><div class="list">${swaps.slice().reverse().map(s => { const r = rows.find(x => x.id === s.roster_id) || {}; return `<div><div><b>${esc(r.nama || s.dari_member)}</b> · ${esc(r.posisi || '')} ${tgl(r.tanggal)}<div class="sub">${esc(s.alasan || '-')}</div></div>${s.status === 'menunggu' ? `<button class="btn sm" data-s="${s.id}">Tandai selesai</button>` : '<span class="tag t-ok">selesai</span>'}</div>`; }).join('')}</div></div>` : '';
  };
  const load = force => Api.list('Roster', d => { rows = d; draw(); }, force);
  load().catch(e => { $('#tb', el).innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
  if (isStaff()) { Api.get('Members').then(m => members = m.filter(x => x.aktif !== 'tidak')); Api.list('RosterSwaps', d => { swaps = d; draw(); }); }
  $('#qf', el).onchange = e => { q.from = e.target.value; draw(); }; $('#qt', el).onchange = e => { q.to = e.target.value; draw(); };
  const fields = () => [{ k: 'tanggal', label: 'Tanggal ibadah', type: 'date', req: 1 }, { k: 'ibadah', label: 'Ibadah', def: 'Ibadah Pemuda' }, { k: 'posisi', label: 'Posisi', type: 'select', opts: CFG.POSISI },
    { k: 'member_id', label: 'Pelayan', type: 'select', opts: [['', '- pilih -'], ...members.map(m => [m.id, m.nama])] }, { k: 'catatan', label: 'Catatan', full: 1 }];
  const save = (id) => async o => { const m = members.find(x => x.id === o.member_id); await Api.save('Roster', { ...o, id, nama: m ? m.nama : '' }); toast('Tersimpan'); load(true); };
  el.onclick = async e => {
    const t = e.target.closest('[data-a],[data-e],[data-d],[data-c],[data-s]'); if (!t) return;
    if (t.dataset.a === 'add') formModal('Tambah jadwal', fields(), {}, save());
    if (t.dataset.e) formModal('Ubah jadwal', fields(), rows.find(r => r.id === t.dataset.e), save(t.dataset.e));
    if (t.dataset.d && await confirmBox('Hapus jadwal ini?')) { await Api.del('Roster', t.dataset.d); load(true); }
    if (t.dataset.a === 'print') printDoc('roster', { from: q.from, to: q.to }, false).catch(er => toast(er.message, true));
    if (t.dataset.s) { const s = swaps.find(x => x.id === t.dataset.s); await Api.save('RosterSwaps', { ...s, status: 'selesai' }); Api.list('RosterSwaps', d => { swaps = d; draw(); }, true); }
    if (t.dataset.c) {
      const [id, status] = t.dataset.c.split('|'); const go = async alasan => { await Api.call('rosterConfirm', { id, status, alasan }); toast('Konfirmasi tersimpan'); load(true); };
      if (status === 'Tukar Jadwal') formModal('Minta tukar jadwal', [{ k: 'alasan', label: 'Alasan', type: 'textarea', full: 1, req: 1 }], {}, o => go(o.alasan), 'Kirim'); else go();
    }
  };
};
