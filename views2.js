/* ---------- Presensi & Event ---------- */
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
const SCAN_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
Views.presensi = async el => {
  let rows = [];
  el.innerHTML = `<div class="sec"><h2>Presensi & Kegiatan</h2><div class="tools" style="margin:0">
    <button class="btn" data-a="scan">${ico('qr')} Scan QR Presensi</button>${isStaff() ? `<button class="btn sec2" data-a="add">${ico('plus')} Kegiatan</button>` : ''}</div></div><div id="tb">${skeleton()}</div>`;
  const draw = () => {
    const t = todayStr(), up = rows.filter(e => e.tanggal >= t).sort((a, b) => a.tanggal.localeCompare(b.tanggal)), past = rows.filter(e => e.tanggal < t).sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 12);
    const card = e => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(e.nama)}</h3><span class="tag t-s">${esc(e.kategori || '')}</span></div>
      <p class="sub">${tgl(e.tanggal)} ${esc(e.waktu || '')} · ${esc(e.lokasi || '-')}</p>${e.tema ? `<p>Tema: ${esc(e.tema)}</p>` : ''}${e.pembicara ? `<p class="sub">Pembicara: ${esc(e.pembicara)}</p>` : ''}
      <p class="sub">Terdaftar ${e.terdaftar}${e.kuota ? ' / ' + e.kuota : ''}${e.jml_hadir !== undefined ? ' · Hadir ' + e.jml_hadir : ''}</p><div class="tools" style="margin:12px 0 0">
      ${e.hadir ? '<span class="tag t-ok">✓ Anda hadir</span>' : e.sudah ? '<span class="tag t-b">Terdaftar</span>' : (e.tanggal >= t && e.status !== 'tutup' && !(e.kuota && e.terdaftar >= e.kuota) ? `<button class="btn sm" data-r="${e.id}">Daftar</button>` : e.kuota && e.terdaftar >= e.kuota && e.tanggal >= t ? '<span class="tag t-e">Kuota penuh</span>' : '')}
      ${isStaff() ? `<button class="btn sm sec2" data-q="${e.id}">QR Event</button><button class="btn sm sec2" data-l="${e.id}">Daftar hadir</button><button class="btn sm sec2" data-p="${e.id}">Cetak</button><button class="btn sm sec2" data-e="${e.id}">Ubah</button><button class="btn sm danger" data-d="${e.id}">Hapus</button>` : ''}</div></div>`;
    $('#tb', el).innerHTML = `<h3 style="margin-bottom:10px">Mendatang</h3><div class="grid g2">${up.map(card).join('') || '<div class="card empty">Belum ada kegiatan mendatang</div>'}</div>${past.length ? `<h3 style="margin:22px 0 10px">Sebelumnya</h3><div class="grid g2">${past.map(card).join('')}</div>` : ''}`;
  };
  const load = f => Api.list('Events', d => { rows = d; draw(); }, f).catch(e => { $('#tb', el).innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
  load();
  const fields = [{ k: 'nama', label: 'Nama kegiatan', req: 1, full: 1 }, { k: 'kategori', label: 'Kategori', type: 'select', opts: CFG.KATEGORI_EVENT }, { k: 'tanggal', label: 'Tanggal', type: 'date', req: 1 },
    { k: 'waktu', label: 'Waktu', type: 'time' }, { k: 'lokasi', label: 'Lokasi' }, { k: 'tema', label: 'Tema' }, { k: 'pembicara', label: 'Pembicara' }, { k: 'kuota', label: 'Kuota (0 = tanpa batas)', type: 'number', def: 0 },
    { k: 'status', label: 'Pendaftaran', type: 'select', opts: [['buka', 'Dibuka'], ['tutup', 'Ditutup'], ['privat', 'Tidak tampil di landing page']] }];
  el.onclick = async e => {
    const t = e.target.closest('[data-a],[data-r],[data-q],[data-l],[data-p],[data-e],[data-d]'); if (!t) return; const D = t.dataset;
    try {
      if (D.a === 'add') formModal('Tambah kegiatan', fields, { status: 'buka' }, async o => { await Api.save('Events', o); toast('Tersimpan'); load(true); });
      if (D.e) formModal('Ubah kegiatan', fields, rows.find(r => r.id === D.e), async o => { await Api.save('Events', { ...o, id: D.e }); load(true); });
      if (D.d && await confirmBox('Hapus kegiatan ini?')) { await Api.del('Events', D.d); load(true); }
      if (D.r) { t.disabled = true; await Api.call('eventRegister', { event_id: D.r }); toast('Berhasil mendaftar'); load(true); }
      if (D.p) { const k = await confirmBox('Cetak FORM KOSONG untuk tanda tangan manual? (Batal = cetak rekap kehadiran digital)'); printDoc('presensi', { event_id: D.p, kosong: k }, false); }
      if (D.q) showEventQR(rows.find(r => r.id === D.q));
      if (D.l) quickAttend(rows.find(r => r.id === D.l), () => load(true));
      if (D.a === 'scan') scanner(isStaff() ? rows.filter(r => r.tanggal === todayStr()) : null, () => load(true));
    } catch (err) { toast(err.message, true); t.disabled = false; }
  };
};
async function showEventQR(ev) {
  const [{ token }] = await Promise.all([Api.call('qrToken', { event_id: ev.id }), loadScript(QR_LIB)]);
  const ov = modal('QR Presensi · ' + ev.nama, `<div class="qrbox" id="qrx"></div><p class="sub" style="text-align:center">Tampilkan di layar/proyektor. Anggota memindai lewat menu Presensi. Hanya berlaku pada ${tgl(ev.tanggal)}.</p><div class="act"><button class="btn" data-x>Tutup</button></div>`);
  new QRCode($('#qrx', ov), { text: `PRES|${ev.id}|${token}`, width: 260, height: 260 }); $('[data-x]', ov).onclick = ov.close;
}
async function scanner(staffEvents, done) {
  await loadScript(SCAN_LIB);
  const opts = staffEvents ? (staffEvents.length ? `<label>Kegiatan hari ini</label><select id="se">${staffEvents.map(e => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select><p class="sub">Arahkan kamera ke QR event (untuk diri sendiri) atau kartu QR anggota.</p>` : '<p class="sub">Tidak ada kegiatan hari ini. Anda tetap bisa memindai QR event untuk diri sendiri.</p>') : '<p class="sub">Arahkan kamera ke QR yang ditampilkan pengurus.</p>';
  let sc, busy = false;
  const ov = modal('Scan QR', `${opts}<div id="reader"></div><div class="act"><button class="btn sec2" data-x>Tutup</button></div>`, { onClose: () => { try { sc && sc.stop().then(() => sc.clear()); } catch (e) {} } });
  $('[data-x]', ov).onclick = ov.close;
  sc = new Html5Qrcode('reader');
  sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, async txt => {
    if (busy) return; busy = true;
    try {
      const p = txt.split('|'); let r;
      if (p[0] === 'PRES') r = await Api.call('attend', { event_id: p[1], token: p[2] });
      else if (p[0] === 'MBR') { const se = $('#se', ov); if (!se) throw new Error('Pilih kegiatan terlebih dahulu'); r = await Api.call('attend', { event_id: se.value, member_id: p[1], metode: 'qr-kartu' }); }
      else throw new Error('QR tidak dikenali');
      toast('✓ Hadir: ' + r.nama); done && done();
    } catch (err) { toast(err.message, true); }
    setTimeout(() => busy = false, 1800);
  }).catch(() => toast('Kamera tidak bisa diakses. Izinkan akses kamera.', true));
}
async function quickAttend(ev, done) {
  const [mem, att] = await Promise.all([Api.get('Members'), Api.call('list', { table: 'Attendance' })]);
  const hadir = new Set(att.filter(a => a.event_id === ev.id).map(a => a.member_id)); let q = '';
  const ov = modal('Daftar Hadir Cepat · ' + ev.nama, `<input id="qs" placeholder="Cari nama..." type="search"><div class="list" id="ls" style="margin-top:10px;max-height:55vh;overflow:auto"></div><div class="act"><button class="btn" data-x>Selesai</button></div>`, { onClose: done });
  const draw = () => { $('#ls', ov).innerHTML = mem.filter(m => m.aktif !== 'tidak' && m.nama.toLowerCase().includes(q)).map(m => `<div><span>${esc(m.nama)}<span class="sub"> ${esc(m.id)}</span></span>${hadir.has(m.id) ? '<span class="tag t-ok">✓</span>' : `<button class="btn sm" data-h="${m.id}">Hadir</button>`}</div>`).join('') || '<div class="sub">Tidak ada</div>'; };
  draw(); $('#qs', ov).oninput = debounce(e => { q = e.target.value.toLowerCase(); draw(); }, 100); $('[data-x]', ov).onclick = ov.close;
  $('#ls', ov).onclick = async e => { const b = e.target.closest('[data-h]'); if (!b) return; b.disabled = true; try { await Api.call('attend', { event_id: ev.id, member_id: b.dataset.h, metode: 'manual' }); hadir.add(b.dataset.h); draw(); } catch (er) { toast(er.message, true); b.disabled = false; } };
}

/* ---------- Kelompok Sel ---------- */
Views.sel = async el => {
  el.innerHTML = `<div class="sec"><h2>Kelompok Sel</h2>${isStaff() ? `<button class="btn" data-a="add">${ico('plus')} Kelompok</button>` : ''}</div><div id="tb">${skeleton()}</div>`;
  let groups = [], gm = [], mem = [];
  const draw = () => { $('#tb', el).innerHTML = groups.length ? `<div class="grid g3">${groups.map(g => `<div class="card"><h3>${esc(g.nama)}</h3><p class="sub">Mentor: ${esc(g.mentor_nama || '-')}</p><p class="sub">${gm.filter(x => x.group_id === g.id).length} anggota</p><p>${esc(g.deskripsi || '')}</p><br><button class="btn sm" data-o="${g.id}">Buka</button></div>`).join('')}</div>` : '<div class="card empty">Belum ada kelompok</div>'; };
  const load = async f => { await Promise.all([Api.list('Groups', d => groups = d, f), Api.list('GroupMembers', d => gm = d, f)]); draw(); };
  load().catch(e => { $('#tb', el).innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
  Api.get('Members').then(m => mem = m.filter(x => x.aktif !== 'tidak'));
  const gfields = () => [{ k: 'nama', label: 'Nama kelompok', req: 1, full: 1 }, { k: 'mentor_id', label: 'Ketua / mentor', type: 'select', opts: [['', '-'], ...mem.map(m => [m.id, m.nama])] }, { k: 'deskripsi', label: 'Deskripsi', type: 'textarea', full: 1, rows: 3 }];
  const saveG = id => async o => { const m = mem.find(x => x.id === o.mentor_id); await Api.save('Groups', { ...o, id, mentor_nama: m ? m.nama : '' }); load(true); };
  async function open(g) {
    const notes = await Api.call('list', { table: 'GroupNotes' }); const ms = () => gm.filter(x => x.group_id === g.id);
    const ov = modal(g.nama, '<div id="gd"></div>', { onClose: () => load(true) });
    const draw2 = () => {
      const n = notes.filter(x => x.group_id === g.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      $('#gd', ov).innerHTML = `<p class="sub">Mentor: ${esc(g.mentor_nama || '-')}</p><h4 style="margin:12px 0 4px">Anggota (${ms().length})</h4><div class="list">${ms().map(x => `<div><span>${esc(x.nama)}</span>${isStaff() ? `<button class="btn sm danger" data-rm="${x.id}">Keluarkan</button>` : ''}</div>`).join('') || '<div class="sub">Belum ada anggota</div>'}</div>
        ${isStaff() ? '<div class="tools" style="margin-top:10px"><select id="am"><option value="">+ Tambah anggota...</option>' + mem.filter(m => !ms().some(x => x.member_id === m.id)).map(m => `<option value="${m.id}">${esc(m.nama)}</option>`).join('') + '</select><button class="btn sm" data-add>Tambah</button></div>' : ''}
        <h4 style="margin:16px 0 4px">Catatan kumpul mingguan</h4>${isStaff() ? '<button class="btn sm" data-n>+ Catatan</button>' : ''}<div class="list">${n.map(x => `<div style="align-items:flex-start"><div><b>${esc(x.judul)}</b> <span class="sub">${tgl(x.tanggal)}</span><div>${esc(x.ringkasan)}</div><div class="sub">Hadir: ${x.hadir ? x.hadir.split(',').filter(Boolean).length : 0} dari ${ms().length}</div></div></div>`).join('') || '<div class="sub">Belum ada catatan</div>'}</div>
        <div class="act">${isStaff() ? '<button class="btn sm sec2" data-ed>Ubah kelompok</button><button class="btn sm danger" data-del>Hapus</button>' : ''}<button class="btn" data-x>Tutup</button></div>`;
    };
    draw2();
    ov.onclick = async e => {
      const t = e.target.closest('button'); if (!t) return; const D = t.dataset;
      try {
        if ('x' in D) ov.close();
        if ('rm' in D) { await Api.del('GroupMembers', D.rm); gm = gm.filter(x => x.id !== D.rm); draw2(); }
        if ('add' in D) { const id = $('#am', ov).value; if (!id) return; const m = mem.find(x => x.id === id); const r = await Api.save('GroupMembers', { group_id: g.id, member_id: id, nama: m.nama }); gm.push(r); draw2(); }
        if ('ed' in D) { ov.close(); formModal('Ubah kelompok', gfields(), g, saveG(g.id)); }
        if ('del' in D && await confirmBox('Hapus kelompok ini?')) { await Api.del('Groups', g.id); ov.close(); }
        if ('n' in D) {
          const o2 = modal('Catatan kumpul', `<form><div class="fg"><div><label>Tanggal</label><input id="nt" type="date" value="${todayStr()}"></div><div><label>Judul / renungan</label><input id="nj"></div><div class="full"><label>Ringkasan materi</label><textarea id="nr" rows="4"></textarea></div><div class="full"><label>Kehadiran</label>${ms().map(x => `<label style="display:flex;gap:8px;font-weight:400;color:inherit"><input type="checkbox" style="width:auto" value="${x.member_id}" checked>${esc(x.nama)}</label>`).join('')}</div></div><div class="act"><button type="button" class="btn sec2" data-c>Batal</button><button class="btn">Simpan</button></div></form>`);
          $('[data-c]', o2).onclick = o2.close;
          $('form', o2).onsubmit = async ev => { ev.preventDefault(); const hadir = [...o2.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value).join(','); const r = await Api.save('GroupNotes', { group_id: g.id, tanggal: $('#nt', o2).value, judul: $('#nj', o2).value, ringkasan: $('#nr', o2).value, hadir }); notes.push(r); o2.close(); draw2(); };
        }
      } catch (er) { toast(er.message, true); }
    };
  }
  el.onclick = e => { const t = e.target.closest('[data-a],[data-o]'); if (!t) return; if (t.dataset.a === 'add') formModal('Kelompok baru', gfields(), {}, saveG()); if (t.dataset.o) open(groups.find(g => g.id === t.dataset.o)); };
};

/* ---------- Kas Pemuda ---------- */
Views.kas = async el => {
  let rows = []; const q = { bulan: '', jenis: '' };
  el.innerHTML = `<div class="sec"><h2>Kas Pemuda</h2><div class="tools" style="margin:0">${isBph() ? `<button class="btn" data-a="add">${ico('plus')} Transaksi</button><button class="btn sec2" data-a="print">${ico('print')} Laporan</button>` : ''}</div></div>
    <div class="tools"><input type="month" id="qb"><select id="qj"><option value="">Semua</option><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option></select></div><div id="sm"></div><div id="tb">${skeleton()}</div>`;
  const draw = () => {
    const f = rows.filter(r => (!q.bulan || r.tanggal.slice(0, 7) === q.bulan) && (!q.jenis || r.jenis === q.jenis)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const m = f.filter(r => r.jenis === 'masuk').reduce((s, r) => s + r.nominal, 0), k = f.filter(r => r.jenis === 'keluar').reduce((s, r) => s + r.nominal, 0), all = rows.reduce((s, r) => s + (r.jenis === 'masuk' ? r.nominal : -r.nominal), 0);
    $('#sm', el).innerHTML = `<div class="grid g3" style="margin-bottom:16px"><div class="card stat"><span>Pemasukan</span><b style="color:var(--ok)">${rp(m)}</b></div><div class="card stat"><span>Pengeluaran</span><b style="color:var(--err)">${rp(k)}</b></div><div class="card stat dark"><span>Saldo kas terkini</span><b>${rp(all)}</b></div></div>`;
    $('#tb', el).innerHTML = tableHTML([{ h: 'Tanggal', f: r => tgl(r.tanggal) }, { h: 'Kategori', f: r => esc(r.kategori || '') }, { h: 'Keterangan', f: r => esc(r.keterangan || '') + (r.bukti_url ? ` <a href="${esc(r.bukti_url)}" target="_blank" rel="noopener">📎 bukti</a>` : '') },
      { h: 'Jumlah', f: r => `<b style="color:var(${r.jenis === 'masuk' ? '--ok' : '--err'})">${r.jenis === 'masuk' ? '+' : '-'} ${rp(r.nominal)}</b>` },
      ...(isBph() ? [{ h: '', f: r => `<button class="btn sm sec2" data-e="${r.id}">Ubah</button> <button class="btn sm danger" data-d="${r.id}">Hapus</button>` }] : [])], f, 'Belum ada transaksi');
  };
  const load = f => Api.list('Cash', d => { rows = d; draw(); }, f).catch(e => { $('#tb', el).innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
  load();
  $('#qb', el).onchange = e => { q.bulan = e.target.value; draw(); }; $('#qj', el).onchange = e => { q.jenis = e.target.value; draw(); };
  const fields = [{ k: 'tanggal', label: 'Tanggal', type: 'date', req: 1, def: todayStr() }, { k: 'jenis', label: 'Jenis', type: 'select', opts: [['masuk', 'Pemasukan'], ['keluar', 'Pengeluaran']] }, { k: 'kategori', label: 'Kategori', type: 'select', opts: CFG.KATEGORI_KAS },
    { k: 'nominal', label: 'Nominal (Rp)', type: 'number', req: 1 }, { k: 'keterangan', label: 'Keterangan (kolekte, iuran, donasi event...)', full: 1 }, { k: 'bukti', label: 'Bukti / nota (foto atau PDF)', type: 'file', accept: 'image/*,.pdf', full: 1 }];
  const save = (id, old) => async o => {
    let bukti_url = old ? old.bukti_url : '';
    if (o.bukti) { toast('Mengunggah bukti...'); const b64 = await readFileB64(o.bukti); bukti_url = (await Api.call('upload', { name: o.bukti.name, mime: o.bukti.type, b64 })).url; }
    delete o.bukti; await Api.save('Cash', { ...o, id, nominal: Number(o.nominal), bukti_url }); toast('Tersimpan'); load(true);
  };
  el.onclick = async e => {
    const t = e.target.closest('[data-a],[data-e],[data-d]'); if (!t) return;
    if (t.dataset.a === 'add') formModal('Tambah transaksi', fields, {}, save());
    if (t.dataset.e) { const r = rows.find(x => x.id === t.dataset.e); formModal('Ubah transaksi', fields, r, save(r.id, r)); }
    if (t.dataset.d && await confirmBox('Hapus transaksi ini?')) { await Api.del('Cash', t.dataset.d); load(true); }
    if (t.dataset.a === 'print') { const from = q.bulan ? q.bulan + '-01' : '', to = q.bulan ? q.bulan + '-31' : ''; printDoc('kas', { from, to }, false).catch(er => toast(er.message, true)); }
  };
};

/* ---------- Warta & Konseling ---------- */
Views.warta = async el => {
  let tab = 'warta'; el.innerHTML = `<div class="sec"><h2>Warta & Konseling</h2></div><div class="tools"><button class="btn" data-t="warta">Warta</button><button class="btn sec2" data-t="doa">Doa & Konseling</button></div><div id="tb"></div>`;
  const setTab = t => { tab = t; el.querySelectorAll('[data-t]').forEach(b => b.className = 'btn' + (b.dataset.t === t ? '' : ' sec2')); (t === 'warta' ? wartaTab : doaTab)($('#tb', el)); };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => setTab(b.dataset.t)); setTab('warta');
};
function wartaTab(box) {
  let rows = []; box.innerHTML = (isBph() ? `<button class="btn" data-a="add" style="margin-bottom:14px">${ico('plus')} Warta baru</button>` : '') + '<div id="wl">' + skeleton() + '</div>';
  const draw = () => { $('#wl', box).innerHTML = rows.length ? `<div class="grid g2">${rows.slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map(w => `<div class="card"><h3>${esc(w.judul)}</h3><p class="sub">${tgl(w.tanggal)}${w.publik === 'ya' ? ' · <span class="tag t-ok">tampil di landing</span>' : ''}</p><p style="white-space:pre-wrap;margin-top:8px">${esc(w.isi)}</p>${w.lampiran_url ? `<p><a href="${esc(w.lampiran_url)}" target="_blank" rel="noopener">📎 Lampiran</a></p>` : ''}${isBph() ? `<div class="tools" style="margin:10px 0 0"><button class="btn sm sec2" data-e="${w.id}">Ubah</button><button class="btn sm danger" data-d="${w.id}">Hapus</button></div>` : ''}</div>`).join('')}</div>` : '<div class="card empty">Belum ada warta</div>'; };
  const load = f => Api.list('Warta', d => { rows = d; draw(); }, f).catch(e => { $('#wl', box).innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }); load();
  const fields = [{ k: 'judul', label: 'Judul', req: 1, full: 1 }, { k: 'isi', label: 'Isi warta', type: 'textarea', rows: 6, full: 1 }, { k: 'lampiran', label: 'Lampiran PDF (opsional)', type: 'file', accept: '.pdf', full: 1 }, { k: 'publik', label: 'Tampilkan ringkasan di landing page?', type: 'select', opts: [['tidak', 'Tidak'], ['ya', 'Ya']] }];
  const save = (id, old) => async o => { let lampiran_url = old ? old.lampiran_url : ''; if (o.lampiran) { toast('Mengunggah...'); lampiran_url = (await Api.call('upload', { name: o.lampiran.name, mime: o.lampiran.type, b64: await readFileB64(o.lampiran) })).url; } delete o.lampiran; await Api.save('Warta', { ...o, id, lampiran_url }); toast('Tersimpan'); load(true); };
  box.onclick = async e => { const t = e.target.closest('[data-a],[data-e],[data-d]'); if (!t) return; if (t.dataset.a) formModal('Warta baru', fields, {}, save()); if (t.dataset.e) { const r = rows.find(x => x.id === t.dataset.e); formModal('Ubah warta', fields, r, save(r.id, r)); } if (t.dataset.d && await confirmBox('Hapus warta ini?')) { await Api.del('Warta', t.dataset.d); load(true); } };
}
async function doaTab(box) {
  box.innerHTML = `<div class="grid g2"><div class="card"><h3>Kirim permohonan</h3><form id="cf"><label>Jenis</label><select id="ct"><option value="doa">Permohonan doa</option><option value="konseling">Konseling dengan pembina</option></select><br><br><label>Pesan</label><textarea id="cm" rows="5" required placeholder="Tuliskan pokok doa / hal yang ingin dikonselingkan"></textarea><br><label style="display:flex;gap:8px;align-items:center;font-weight:400;color:inherit"><input type="checkbox" id="ca" style="width:auto"> Kirim sebagai anonim (nama tidak disimpan, status tidak dapat dilacak)</label><div class="act"><button class="btn">Kirim</button></div></form></div><div class="card"><h3>${isBph() ? 'Permohonan masuk' : 'Permohonan saya'}</h3><div class="list" id="cl">${skeleton(3)}</div></div></div>`;
  $('#cf', box).onsubmit = async e => { e.preventDefault(); const b = $('button', e.target); b.disabled = true; try { await Api.call('counselSubmit', { tipe: $('#ct', box).value, pesan: $('#cm', box).value, anonim: $('#ca', box).checked }); toast('Terkirim. Tuhan memberkati.'); $('#cm', box).value = ''; loadC(); } catch (er) { toast(er.message, true); } b.disabled = false; };
  let rows = [];
  const draw = () => { $('#cl', box).innerHTML = rows.map(c => `<div style="align-items:flex-start"><div><b>${esc(c.nama || (c.tipe === 'doa' ? 'Doa' : 'Konseling'))}</b> <span class="tag t-s">${esc(c.tipe)}</span><div class="sub">${esc(String(c.created_at).slice(0, 10))}</div><div style="white-space:pre-wrap">${esc(c.pesan)}</div>${c.tindak_lanjut ? `<div class="sub">Tindak lanjut: ${esc(c.tindak_lanjut)}</div>` : ''}${c.jadwal ? `<div class="sub">Jadwal: ${tgl(c.jadwal)}</div>` : ''}</div><div style="text-align:right"><span class="tag ${c.status === 'selesai' ? 't-ok' : c.status === 'diproses' ? 't-w' : 't-n'}">${esc(c.status)}</span>${isBph() ? `<br><button class="btn sm sec2" data-u="${c.id}">Tindak lanjut</button>` : ''}</div></div>`).join('') || '<div class="sub">Belum ada.</div>'; };
  const loadC = async () => { try { rows = await Api.call('myCounsel'); draw(); } catch (er) { $('#cl', box).innerHTML = esc(er.message); } }; loadC();
  box.onclick = e => { const t = e.target.closest('[data-u]'); if (!t) return; const c = rows.find(x => x.id === t.dataset.u);
    formModal('Tindak lanjut', [{ k: 'status', label: 'Status', type: 'select', opts: ['baru', 'diproses', 'selesai'] }, { k: 'jadwal', label: 'Jadwal konseling', type: 'date' }, { k: 'tindak_lanjut', label: 'Catatan tindak lanjut tim penggembalaan', type: 'textarea', full: 1 }], c, async o => { await Api.call('save', { table: 'Counsel', row: { ...c, ...o } }); loadC(); }); };
}

/* ---------- Pengaturan (BPH) ---------- */
Views.pengaturan = async el => {
  if (!isBph()) { el.innerHTML = '<div class="card empty">Hanya untuk pengurus (BPH)</div>'; return; }
  el.innerHTML = `<div class="sec"><h2>Pengaturan</h2></div><div class="tools"><button class="btn" data-t="u">Pengguna & Role</button><button class="btn sec2" data-t="t">Tampilan & Landing</button><button class="btn sec2" data-t="s">Sistem</button></div><div id="tb"></div>`;
  const tabs = { u: usersTab, t: themeTab, s: sysTab }; const go = t => { el.querySelectorAll('[data-t]').forEach(b => b.className = 'btn' + (b.dataset.t === t ? '' : ' sec2')); tabs[t]($('#tb', el)); };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => go(b.dataset.t)); go('u');
};
async function usersTab(box) {
  box.innerHTML = skeleton(); let rows = await Api.call('list', { table: 'Users' });
  const draw = () => { box.innerHTML = `<button class="btn" data-a style="margin-bottom:12px">${ico('plus')} Beri akses login</button>` + tableHTML([{ h: 'Email', f: r => `<b>${esc(r.email)}</b><div class="sub">${esc(r.nama || '')}</div>` },
    { h: 'Role', f: r => `<select data-r="${esc(r.email)}" style="min-width:150px">${[['bph', 'BPH (akses penuh)'], ['koordinator', 'Koordinator'], ['anggota', 'Anggota']].map(([v, l]) => `<option value="${v}"${r.role === v ? ' selected' : ''}>${l}</option>`).join('')}</select>` },
    { h: 'Akses login', f: r => `<select data-k="${esc(r.email)}">${[['ya', 'Aktif'], ['pending', 'Menunggu persetujuan'], ['tidak', 'Diblokir']].map(([v, l]) => `<option value="${v}"${r.aktif === v ? ' selected' : ''}>${l}</option>`).join('')}</select>` },
    { h: '', f: r => `<button class="btn sm danger" data-d="${esc(r.email)}">Hapus</button>` }], rows.sort((a, b) => (a.aktif === 'pending' ? -1 : 1) - (b.aktif === 'pending' ? -1 : 1))); };
  draw();
  box.onchange = async e => { const s = e.target; const em = s.dataset.r || s.dataset.k; if (!em) return; const r = rows.find(x => x.email === em); try { Object.assign(r, s.dataset.r ? { role: s.value } : { aktif: s.value }); await Api.call('save', { table: 'Users', row: r }); toast('Disimpan'); } catch (er) { toast(er.message, true); } };
  box.onclick = async e => { const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.d && await confirmBox('Hapus pengguna ini?')) { try { await Api.call('del', { table: 'Users', id: t.dataset.d }); rows = rows.filter(x => x.email !== t.dataset.d); draw(); } catch (er) { toast(er.message, true); } }
    if ('a' in t.dataset) formModal('Beri akses login', [{ k: 'email', label: 'Email Google', type: 'email', req: 1, full: 1 }, { k: 'role', label: 'Role', type: 'select', opts: [['anggota', 'Anggota'], ['koordinator', 'Koordinator'], ['bph', 'BPH']] }], {}, async o => { const r = await Api.call('save', { table: 'Users', row: { ...o, aktif: 'ya' } }); rows.push(r); draw(); }); };
}
async function themeTab(box) {
  const s = S.settings; const F = [['app_name', 'Nama aplikasi'], ['church_name', 'Nama gereja / pemuda'], ['tagline', 'Tagline'], ['about', 'Profil singkat (landing page)', 'textarea'], ['visi', 'Visi & misi', 'textarea'], ['jadwal_ibadah', 'Jadwal ibadah (mis. Sabtu 18.00)'], ['alamat_gereja', 'Alamat gereja'], ['kontak', 'Kontak (WA/email)'], ['instagram', 'Instagram (URL)'], ['youtube', 'YouTube (URL)']];
  box.innerHTML = `<div class="card"><form id="sf"><div class="fg"><div class="full"><label>Logo / ikon web (PNG/JPG, maks 2 MB)</label><div style="display:flex;gap:12px;align-items:center">${s.logo_url ? `<img src="${esc(s.logo_url)}" width="48" height="48" style="border-radius:10px;object-fit:cover" alt="logo">` : ''}<input type="file" id="lg" accept="image/*"></div></div>
    ${F.map(([k, l, t]) => fieldHTML({ k, label: l, type: t || 'text', full: t ? 1 : 0, rows: 3 }, s[k])).join('')}</div><div class="act"><button class="btn">Simpan pengaturan</button></div></form></div>`;
  $('#sf', box).onsubmit = async e => { e.preventDefault(); const b = $('.btn', e.target); b.disabled = true;
    try { const f = $('#lg', box).files[0]; if (f) { if (f.size > 2e6) throw new Error('Logo terlalu besar'); const r = await Api.call('upload', { name: 'logo-' + f.name, mime: f.type, b64: await readFileB64(f) }); await Api.call('setting', { key: 'logo_url', value: r.thumb }); s.logo_url = r.thumb; }
      for (const [k] of F) { const v = $('#f_' + k, box).value; if (v !== (s[k] || '')) { await Api.call('setting', { key: k, value: v }); s[k] = v; } } applyBrand(); toast('Pengaturan tersimpan'); } catch (er) { toast(er.message, true); } b.disabled = false; };
}
function sysTab(box) {
  box.innerHTML = `<div class="grid g2"><div class="card"><h3>Migrasi database</h3><p class="sub">Membuat sheet/kolom yang belum ada & menjalankan migrasi versi. Aman diulang.</p><br><button class="btn" data-m>Jalankan migrasi</button></div><div class="card"><h3>Notifikasi</h3><p class="sub">Ulang tahun & pengingat jadwal otomatis jalan tiap pukul 06.00. Jalankan manual untuk uji.</p><br><button class="btn" data-n>Kirim sekarang</button></div></div><pre id="out" class="card sub" style="margin-top:16px;white-space:pre-wrap"></pre>`;
  box.onclick = async e => { const t = e.target.closest('button'); if (!t) return; t.disabled = true; try { const r = await Api.call(t.dataset.m !== undefined ? 'migrate' : 'runDaily'); $('#out', box).textContent = JSON.stringify(r, null, 2); Api.clearCache(); } catch (er) { toast(er.message, true); } t.disabled = false; };
}
