/**
 * SI PEMUDA - Backend (Google Apps Script + Google Sheets)
 * Deploy: Web app, Execute as "Me", Access "Anyone".
 * Script Properties wajib: CLIENT_ID (Google OAuth Web Client ID), ADMIN_EMAIL, HMAC_SECRET (acak)
 * Setelah deploy pertama jalankan: setupAwal()
 */
const TZ = 'Asia/Jakarta';
const SCHEMA_VERSION = 2;

const TABLES = {
  Users:        ['email','nama','role','aktif','member_id','created_at'],
  Members:      ['id','nama','tgl_lahir','email','hp','alamat','rayon','kolom','baptis','tgl_baptis','sidi','tgl_sidi','minat','aktif','created_at'],
  Roster:       ['id','tanggal','ibadah','posisi','member_id','nama','status','catatan','updated_at'],
  RosterSwaps:  ['id','roster_id','dari_member','ke_member','alasan','status','created_at'],
  Events:       ['id','nama','kategori','tanggal','waktu','lokasi','tema','pembicara','kuota','status','created_at'],
  EventReg:     ['id','event_id','member_id','nama','created_at'],
  Attendance:   ['id','event_id','member_id','nama','metode','timestamp'],
  Groups:       ['id','nama','mentor_id','mentor_nama','deskripsi'],
  GroupMembers: ['id','group_id','member_id','nama'],
  GroupNotes:   ['id','group_id','tanggal','judul','ringkasan','hadir','created_by'],
  Cash:         ['id','tanggal','jenis','kategori','nominal','keterangan','bukti_url','dibuat_oleh','created_at'],
  Warta:        ['id','judul','isi','lampiran_url','publik','tanggal','dibuat_oleh'],
  Counsel:      ['id','tipe','anonim','member_id','nama','pesan','status','tindak_lanjut','jadwal','created_at'],
  Notifs:       ['id','email','judul','isi','tipe','dibaca','created_at'],
  Settings:     ['key','value'],
  Log:          ['ts','email','aksi','detail']
};
const NUMERIC = ['nominal','kuota'];
const STAFF = ['bph','koordinator'];
// r = boleh baca, w = boleh tulis ('*' = semua user aktif)
const PERM = {
  Users:{r:['bph'],w:['bph']},
  Members:{r:['*'],w:['bph']},
  Roster:{r:['*'],w:STAFF}, RosterSwaps:{r:['*'],w:STAFF},
  Events:{r:['*'],w:STAFF}, EventReg:{r:STAFF,w:STAFF}, Attendance:{r:STAFF,w:STAFF},
  Groups:{r:['*'],w:STAFF}, GroupMembers:{r:['*'],w:STAFF}, GroupNotes:{r:['*'],w:STAFF},
  Cash:{r:['*'],w:['bph']},
  Warta:{r:['*'],w:['bph']},
  Counsel:{r:['bph'],w:['bph']},
  Settings:{r:['bph'],w:['bph']}
};
const PUBLIC_SETTINGS = ['app_name','church_name','logo_url','tagline','about','visi','alamat_gereja','kontak','jadwal_ibadah','instagram','youtube'];

/* ================= ENTRY ================= */
function doGet(e) {
  const a = (e && e.parameter && e.parameter.action) || 'ping';
  let out;
  try { out = a === 'public' ? { ok: true, data: publicInfo() } : { ok: true, data: 'SI PEMUDA API' }; }
  catch (err) { out = { ok: false, error: String(err.message || err) }; }
  return json(out);
}
function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    const user = authUser(req.token);
    out = { ok: true, data: route(req, user) };
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return json(out);
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function route(req, u) {
  switch (req.action) {
    case 'boot': return boot(u);
    case 'list': return listTable(req.table, u);
    case 'save': return saveRow(req.table, req.row, u);
    case 'del': return delRow(req.table, req.id, u);
    case 'saveProfile': return saveProfile(req.row, u);
    case 'setting': need(u, ['bph']); setSetting(req.key, req.value); return true;
    case 'rosterConfirm': return rosterConfirm(req.id, req.status, req.alasan, u);
    case 'eventRegister': return eventRegister(req.event_id, u);
    case 'qrToken': need(u, STAFF); return { token: presToken(req.event_id) };
    case 'attend': return attend(req, u);
    case 'counselSubmit': return counselSubmit(req, u);
    case 'myCounsel': return myCounsel(u);
    case 'upload': return uploadFile(req, u);
    case 'doc': return buildDoc(req.type, req.params || {}, u);
    case 'notifs': return readTable('Notifs').filter(n => n.email === u.email).reverse().slice(0, 50);
    case 'notifRead': return notifRead(u);
    case 'importMembers': need(u, ['bph']); return importMembers(req.rows);
    case 'migrate': need(u, ['bph']); return migrate();
    case 'runDaily': need(u, ['bph']); return dailyJob();
    default: throw new Error('Aksi tidak dikenal');
  }
}

/* ================= AUTH & RBAC ================= */
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function authUser(idToken) {
  if (!idToken) throw new Error('AUTH_EXPIRED');
  const cache = CacheService.getScriptCache();
  const key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  let email = cache.get(key);
  if (!email) {
    const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('AUTH_EXPIRED');
    const p = JSON.parse(r.getContentText());
    if (p.aud !== prop('CLIENT_ID')) throw new Error('AUTH_INVALID');
    if (String(p.email_verified) !== 'true') throw new Error('AUTH_INVALID');
    email = String(p.email).toLowerCase();
    const ttl = Math.max(60, Math.min(3000, Number(p.exp) - Math.floor(Date.now() / 1000)));
    cache.put(key, email, ttl);
  }
  return resolveUser(email);
}
function resolveUser(email) {
  let users = readTable('Users');
  let u = users.find(x => String(x.email).toLowerCase() === email);
  if (!u) {
    const isAdmin = email === String(prop('ADMIN_EMAIL') || '').toLowerCase();
    const mem = readTable('Members').find(m => String(m.email).toLowerCase() === email);
    u = { email, nama: mem ? mem.nama : email.split('@')[0], role: isAdmin ? 'bph' : 'anggota',
          aktif: isAdmin ? 'ya' : 'pending', member_id: mem ? mem.id : '', created_at: now() };
    appendRow('Users', u);
  }
  if (u.aktif !== 'ya') throw new Error('PENDING');
  if (!u.member_id) {
    const mem = readTable('Members').find(m => String(m.email).toLowerCase() === email);
    if (mem) { u.member_id = mem.id; updateByKey('Users', 'email', email, { member_id: mem.id }); }
  }
  return u;
}
function need(u, roles) { if (roles.indexOf(u.role) < 0) throw new Error('Tidak punya akses'); }
function can(table, mode, u) { const p = PERM[table]; return p && (p[mode].indexOf('*') >= 0 || p[mode].indexOf(u.role) >= 0); }

/* ================= STORAGE HELPERS ================= */
const now = () => Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
const today = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
function sh(name) { const s = SpreadsheetApp.getActive().getSheetByName(name); if (!s) throw new Error('Sheet ' + name + ' belum ada. Jalankan setupAwal()'); return s; }
function readTable(name) {
  const cache = CacheService.getScriptCache(), ck = 't_' + name;
  const c = cache.get(ck); if (c) return JSON.parse(c);
  const v = sh(name).getDataRange().getValues(); const h = v.shift();
  const rows = v.filter(r => r[0] !== '').map(r => {
    const o = {};
    h.forEach((k, i) => {
      let x = r[i];
      if (x instanceof Date) x = Utilities.formatDate(x, TZ, /_at$|^timestamp$|^ts$/.test(k) ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
      if (NUMERIC.indexOf(k) >= 0) x = Number(x) || 0;
      o[k] = x;
    });
    return o;
  });
  try { cache.put(ck, JSON.stringify(rows), 300); } catch (e) {}
  return rows;
}
const bust = name => CacheService.getScriptCache().remove('t_' + name);
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function appendRow(name, obj) {
  withLock(() => { sh(name).appendRow(TABLES[name].map(k => obj[k] === undefined ? '' : obj[k])); bust(name); });
}
function updateByKey(name, keyCol, keyVal, patch) {
  return withLock(() => {
    const s = sh(name), cols = TABLES[name], ki = cols.indexOf(keyCol);
    const vals = s.getRange(1, 1, s.getLastRow(), cols.length).getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][ki]) === String(keyVal)) {
        cols.forEach((k, j) => { if (patch[k] !== undefined) vals[i][j] = patch[k]; });
        s.getRange(i + 1, 1, 1, cols.length).setValues([vals[i]]); bust(name); return true;
      }
    }
    return false;
  });
}
function deleteByKey(name, keyCol, keyVal) {
  return withLock(() => {
    const s = sh(name), ki = TABLES[name].indexOf(keyCol);
    const col = s.getRange(1, ki + 1, s.getLastRow(), 1).getValues();
    for (let i = col.length - 1; i >= 1; i--) if (String(col[i][0]) === String(keyVal)) { s.deleteRow(i + 1); bust(name); return true; }
    return false;
  });
}
function newId(table) {
  if (table === 'Members') { let id; const ex = readTable('Members').map(m => m.id); do { id = 'PMD-' + (1000 + Math.floor(Math.random() * 9000)); } while (ex.indexOf(id) >= 0); return id; }
  return table.slice(0, 2).toUpperCase() + '-' + Utilities.getUuid().slice(0, 8);
}
function log(email, aksi, detail) { try { sh('Log').appendRow([now(), email, aksi, String(detail || '').slice(0, 300)]); } catch (e) {} }

/* ================= GENERIC CRUD ================= */
function redactMembers(rows, u) {
  if (STAFF.indexOf(u.role) >= 0) return rows;
  return rows.map(m => m.id === u.member_id ? m : Object.assign({}, m, { hp: '', alamat: '', email: '', tgl_lahir: '' }));
}
function listTable(table, u) {
  if (table === 'Counsel') throw new Error('Gunakan myCounsel');
  if (!TABLES[table]) throw new Error('Tabel tidak valid');
  if (!can(table, 'r', u)) throw new Error('Tidak punya akses');
  let rows = readTable(table);
  if (table === 'Members') rows = redactMembers(rows, u);
  if (table === 'Events') {   // tambahkan jumlah terdaftar & status pribadi tanpa membuka tabel EventReg
    const regs = readTable('EventReg'), att = readTable('Attendance');
    rows = rows.map(e => Object.assign({}, e, {
      terdaftar: regs.filter(r => r.event_id === e.id).length,
      sudah: regs.some(r => r.event_id === e.id && r.member_id === u.member_id),
      hadir: att.some(a => a.event_id === e.id && a.member_id === u.member_id),
      jml_hadir: STAFF.indexOf(u.role) >= 0 ? att.filter(a => a.event_id === e.id).length : undefined }));
  }
  return rows;
}
function saveRow(table, row, u) {
  if (!TABLES[table] || !can(table, 'w', u)) throw new Error('Tidak punya akses');
  if (table === 'Users' && row.email === u.email && row.role !== u.role) throw new Error('Tidak boleh mengubah role sendiri');
  row = Object.assign({}, row);
  const key = table === 'Users' ? 'email' : (table === 'Settings' ? 'key' : 'id');
  if (table === 'Users') row.email = String(row.email).toLowerCase();
  const exists = row[key] && readTable(table).some(r => String(r[key]) === String(row[key]));
  if (exists) { if (table === 'Roster') row.updated_at = now(); updateByKey(table, key, row[key], row); }
  else {
    if (key === 'id') row.id = row.id || newId(table);
    if (TABLES[table].indexOf('created_at') >= 0) row.created_at = now();
    if (table === 'Roster') row.updated_at = now();
    if (table === 'Cash') row.dibuat_oleh = u.email;
    if (table === 'Warta') { row.dibuat_oleh = u.email; row.tanggal = row.tanggal || today(); }
    if (table === 'GroupNotes') row.created_by = u.email;
    appendRow(table, row);
    afterCreate(table, row, u);
  }
  log(u.email, 'save:' + table, row[key]);
  return row;
}
function afterCreate(table, row, u) {
  if (table === 'Roster' && row.member_id) {
    const m = readTable('Members').find(x => x.id === row.member_id);
    if (m && m.email) notify(m.email, 'Jadwal pelayanan baru', row.posisi + ' - ' + row.tanggal + ' (' + (row.ibadah || '') + ')', 'roster', true);
  }
  if (table === 'Warta') readTable('Users').filter(x => x.aktif === 'ya').forEach(x => notify(x.email, 'Warta baru', row.judul, 'warta', false));
}
function delRow(table, id, u) {
  if (!TABLES[table] || !can(table, 'w', u)) throw new Error('Tidak punya akses');
  const key = table === 'Users' ? 'email' : (table === 'Settings' ? 'key' : 'id');
  if (table === 'Users' && id === u.email) throw new Error('Tidak bisa menghapus akun sendiri');
  log(u.email, 'del:' + table, id);
  return deleteByKey(table, key, id);
}
function saveProfile(row, u) {
  const id = u.member_id; if (!id) throw new Error('Akun belum terhubung ke data anggota');
  const allow = ['hp', 'alamat', 'minat', 'tgl_lahir'], patch = {};
  allow.forEach(k => { if (row[k] !== undefined) patch[k] = row[k]; });
  updateByKey('Members', 'id', id, patch); return true;
}

/* ================= BOOT / DASHBOARD ================= */
function boot(u) {
  const members = readTable('Members').filter(m => m.aktif !== 'tidak');
  const cash = readTable('Cash');
  const saldo = cash.reduce((s, c) => s + (c.jenis === 'masuk' ? c.nominal : -c.nominal), 0);
  const events = readTable('Events').sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  const att = readTable('Attendance');
  const last = events.find(e => att.some(a => a.event_id === e.id));
  const lastCount = last ? att.filter(a => a.event_id === last.id).length : 0;
  const t = today();
  const myRoster = readTable('Roster').filter(r => r.member_id === u.member_id && r.tanggal >= t).sort((a, b) => a.tanggal.localeCompare(b.tanggal)).slice(0, 5);
  const upcoming = events.filter(e => e.tanggal >= t).reverse().slice(0, 5);
  const bday = members.filter(m => m.tgl_lahir && String(m.tgl_lahir).slice(5) === t.slice(5)).map(m => ({ id: m.id, nama: m.nama }));
  const settings = {}; readTable('Settings').forEach(s => { settings[s.key] = s.value; });
  const unread = readTable('Notifs').filter(n => n.email === u.email && n.dibaca !== 'ya').length;
  const openCounsel = STAFF.indexOf(u.role) >= 0 && u.role === 'bph' ? readTable('Counsel').filter(c => c.status !== 'selesai').length : 0;
  return { me: { email: u.email, nama: u.nama, role: u.role, member_id: u.member_id }, settings,
    stats: { totalPemuda: members.length, presensiTerakhir: lastCount, presensiEvent: last ? last.nama : '', saldo },
    myRoster, upcoming, bday, unread, openCounsel };
}

/* ================= ROSTER ================= */
function rosterConfirm(id, status, alasan, u) {
  if (['Hadir', 'Bisa', 'Tukar Jadwal'].indexOf(status) < 0) throw new Error('Status tidak valid');
  const r = readTable('Roster').find(x => x.id === id);
  if (!r) throw new Error('Jadwal tidak ditemukan');
  if (r.member_id !== u.member_id && STAFF.indexOf(u.role) < 0) throw new Error('Bukan jadwal Anda');
  updateByKey('Roster', 'id', id, { status, updated_at: now() });
  if (status === 'Tukar Jadwal') {
    appendRow('RosterSwaps', { id: newId('RosterSwaps'), roster_id: id, dari_member: r.member_id, ke_member: '', alasan: alasan || '', status: 'menunggu', created_at: now() });
    readTable('Users').filter(x => STAFF.indexOf(x.role) >= 0 && x.aktif === 'ya').forEach(x =>
      notify(x.email, 'Permintaan tukar jadwal', r.nama + ' - ' + r.posisi + ' (' + r.tanggal + ')', 'swap', true));
  }
  return true;
}

/* ================= EVENT & PRESENSI ================= */
function eventRegister(eventId, u) {
  if (!u.member_id) throw new Error('Akun belum terhubung ke data anggota');
  return withLock(() => {
    const ev = readTable('Events').find(e => e.id === eventId); if (!ev) throw new Error('Event tidak ditemukan');
    if (ev.status === 'tutup') throw new Error('Pendaftaran ditutup');
    const regs = readTable('EventReg').filter(r => r.event_id === eventId);
    if (regs.some(r => r.member_id === u.member_id)) throw new Error('Sudah terdaftar');
    if (ev.kuota > 0 && regs.length >= ev.kuota) throw new Error('Kuota penuh');
    const m = readTable('Members').find(x => x.id === u.member_id);
    sh('EventReg').appendRow([newId('EventReg'), eventId, u.member_id, m ? m.nama : u.nama, now()]); bust('EventReg');
    return true;
  });
}
function presToken(eventId) {
  const ev = readTable('Events').find(e => e.id === eventId); if (!ev) throw new Error('Event tidak ditemukan');
  const sig = Utilities.computeHmacSha256Signature(eventId + '|' + ev.tanggal, prop('HMAC_SECRET') || 'dev');
  return Utilities.base64EncodeWebSafe(sig).slice(0, 12);
}
function attend(req, u) {
  const ev = readTable('Events').find(e => e.id === req.event_id); if (!ev) throw new Error('Event tidak ditemukan');
  let memberId, metode;
  if (req.token) {                       // anggota scan QR event
    if (req.token !== presToken(req.event_id)) throw new Error('QR tidak valid');
    if (ev.tanggal !== today()) throw new Error('Presensi hanya dibuka pada hari kegiatan');
    memberId = u.member_id; metode = 'qr'; if (!memberId) throw new Error('Akun belum terhubung ke data anggota');
  } else {                               // pengurus: scan kartu anggota / daftar cepat
    need(u, STAFF); memberId = req.member_id; metode = req.metode || 'manual';
  }
  return withLock(() => {
    if (readTable('Attendance').some(a => a.event_id === req.event_id && a.member_id === memberId)) throw new Error('Sudah tercatat hadir');
    const m = readTable('Members').find(x => x.id === memberId); if (!m) throw new Error('Anggota tidak ditemukan');
    sh('Attendance').appendRow([newId('Attendance'), req.event_id, memberId, m.nama, metode, now()]); bust('Attendance');
    return { nama: m.nama };
  });
}

/* ================= KONSELING ================= */
function counselSubmit(req, u) {
  const anon = req.anonim === true || req.anonim === 'ya';
  const m = readTable('Members').find(x => x.id === u.member_id);
  appendRow('Counsel', { id: newId('Counsel'), tipe: req.tipe === 'konseling' ? 'konseling' : 'doa', anonim: anon ? 'ya' : 'tidak',
    member_id: anon ? '' : u.member_id, nama: anon ? 'Anonim' : (m ? m.nama : u.nama), pesan: String(req.pesan || '').slice(0, 2000),
    status: 'baru', tindak_lanjut: '', jadwal: '', created_at: now() });
  readTable('Users').filter(x => x.role === 'bph' && x.aktif === 'ya').forEach(x => notify(x.email, 'Permohonan ' + req.tipe + ' baru', anon ? 'Dari anggota (anonim)' : 'Dari ' + (m ? m.nama : u.nama), 'counsel', true));
  return true;
}
function myCounsel(u) {
  if (u.role === 'bph') return readTable('Counsel').slice().reverse();
  return readTable('Counsel').filter(c => c.member_id && c.member_id === u.member_id).reverse()
    .map(c => ({ id: c.id, tipe: c.tipe, pesan: c.pesan, status: c.status, jadwal: c.jadwal, created_at: c.created_at }));
}

/* ================= UPLOAD ================= */
function uploadFile(req, u) {
  need(u, ['bph']);
  if (!req.b64 || req.b64.length > 7000000) throw new Error('File terlalu besar (maks ~5MB)');
  let id = prop('FOLDER_ID'), folder;
  if (id) folder = DriveApp.getFolderById(id);
  else { folder = DriveApp.createFolder('SI-PEMUDA-UPLOAD'); PropertiesService.getScriptProperties().setProperty('FOLDER_ID', folder.getId()); }
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.b64), req.mime || 'application/octet-stream', req.name || 'file'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: f.getId(), url: f.getUrl(), thumb: 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w400' };
}

/* ================= SETTINGS / PUBLIC ================= */
function settingsMap() { const m = {}; readTable('Settings').forEach(s => { m[s.key] = s.value; }); return m; }
function setSetting(k, v) {
  if (readTable('Settings').some(s => s.key === k)) updateByKey('Settings', 'key', k, { value: v }); else appendRow('Settings', { key: k, value: v });
}
function publicInfo() {
  const s = settingsMap(), out = {};
  PUBLIC_SETTINGS.forEach(k => { out[k] = s[k] || ''; });
  const t = today();
  out.events = readTable('Events').filter(e => e.tanggal >= t && e.status !== 'privat').sort((a, b) => a.tanggal.localeCompare(b.tanggal)).slice(0, 6)
    .map(e => ({ nama: e.nama, kategori: e.kategori, tanggal: e.tanggal, waktu: e.waktu, lokasi: e.lokasi, tema: e.tema }));
  out.warta = readTable('Warta').filter(w => w.publik === 'ya').slice(-3).reverse().map(w => ({ judul: w.judul, isi: String(w.isi).slice(0, 220), tanggal: w.tanggal }));
  return out;
}

/* ================= NOTIFIKASI ================= */
function notify(email, judul, isi, tipe, sendMail) {
  if (!email) return;
  appendRow('Notifs', { id: newId('Notifs'), email: String(email).toLowerCase(), judul, isi, tipe: tipe || 'info', dibaca: 'tidak', created_at: now() });
  if (sendMail) {
    try {
      const app = settingsMap().app_name || 'SI PEMUDA';
      MailApp.sendEmail({ to: email, subject: '[' + app + '] ' + judul, htmlBody: '<div style="font-family:Arial;max-width:480px"><h3 style="color:#3b1a5e">' + esc(judul) + '</h3><p>' + esc(isi) + '</p><hr><small>' + esc(app) + '</small></div>' });
    } catch (e) { log('system', 'mail-gagal', e.message); }
  }
}
function notifRead(u) {
  const s = sh('Notifs'); const v = s.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][1]).toLowerCase() === u.email && v[i][5] !== 'ya') s.getRange(i + 1, 6).setValue('ya');
  bust('Notifs'); return true;
}
/** Dijalankan trigger harian (jam 06.00): ulang tahun + pengingat jadwal H-2 & hari-H */
function dailyJob() {
  const t = today(), md = t.slice(5);
  const members = readTable('Members').filter(m => m.aktif !== 'tidak');
  const pengurus = readTable('Users').filter(u => u.role === 'bph' && u.aktif === 'ya');
  let n = 0;
  members.filter(m => m.tgl_lahir && String(m.tgl_lahir).slice(5) === md).forEach(m => {
    if (m.email) notify(m.email, 'Selamat ulang tahun, ' + m.nama + '!', 'Tuhan Yesus memberkati di usia barumu.', 'ultah', true);
    pengurus.forEach(p => notify(p.email, 'Ulang tahun hari ini', m.nama, 'ultah', false)); n++;
  });
  const d2 = Utilities.formatDate(new Date(Date.now() + 2 * 86400000), TZ, 'yyyy-MM-dd');
  readTable('Roster').filter(r => (r.tanggal === d2 || r.tanggal === t) && r.member_id).forEach(r => {
    const m = members.find(x => x.id === r.member_id);
    if (m && m.email) { notify(m.email, 'Pengingat pelayanan', r.posisi + ' - ' + r.tanggal + (r.tanggal === t ? ' (HARI INI)' : ''), 'roster', true); n++; }
  });
  return { dikirim: n };
}
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyJob').timeBased().atHour(6).everyDays(1).inTimezone(TZ).create();
}

/* ================= MIGRASI DATABASE ================= */
/** Idempotent: buat sheet/kolom yang belum ada, lalu jalankan migrasi bernomor. Aman dijalankan berulang. */
function migrate() {
  const ss = SpreadsheetApp.getActive(), report = [];
  Object.keys(TABLES).forEach(name => {
    let s = ss.getSheetByName(name);
    const cols = TABLES[name];
    if (!s) { s = ss.insertSheet(name); s.getRange(1, 1, 1, cols.length).setValues([cols]); report.push('buat ' + name); }
    else {
      const head = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getValues()[0];
      cols.forEach(c => { if (head.indexOf(c) < 0) { s.getRange(1, s.getLastColumn() + 1).setValue(c); report.push('kolom ' + name + '.' + c); } });
    }
    s.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#3b1a5e').setFontColor('#fff');
    s.setFrozenRows(1);
    // format teks agar tanggal tidak diubah Sheets jadi Date
    s.getRange(2, 1, Math.max(s.getMaxRows() - 1, 1), cols.length).setNumberFormat('@');
  });
  const del = ss.getSheetByName('Sheet1'); if (del && ss.getSheets().length > 1 && del.getLastRow() === 0) ss.deleteSheet(del);
  const cur = Number(settingsMap().schema_version || 0);
  const steps = {
    1: () => { setSetting('app_name', 'SI PEMUDA'); setSetting('church_name', 'Pemuda Gereja'); },
    2: () => { readTable('Members').forEach(m => { if (!m.aktif) updateByKey('Members', 'id', m.id, { aktif: 'ya' }); }); }
  };
  for (let v = cur + 1; v <= SCHEMA_VERSION; v++) { if (steps[v]) steps[v](); report.push('migrasi v' + v); }
  setSetting('schema_version', String(SCHEMA_VERSION));
  Object.keys(TABLES).forEach(bust);
  return { versi: SCHEMA_VERSION, laporan: report };
}
function importMembers(rows) {
  let ok = 0, skip = 0; const ex = readTable('Members');
  (rows || []).slice(0, 500).forEach(r => {
    if (!r.nama) { skip++; return; }
    if (ex.some(m => m.nama === r.nama && m.tgl_lahir === r.tgl_lahir)) { skip++; return; }
    const o = {}; TABLES.Members.forEach(k => { o[k] = r[k] || ''; });
    o.id = newId('Members'); o.aktif = o.aktif || 'ya'; o.created_at = now(); appendRow('Members', o); ok++;
  });
  return { ok, skip };
}
function setupAwal() { const r = migrate(); installTriggers(); Logger.log(JSON.stringify(r)); return r; }

/* ================= DOC ENGINE (cetak) ================= */
function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
function tgl(d) { if (!d) return ''; const p = String(d).slice(0, 10).split('-'); const b = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']; return p.length === 3 ? Number(p[2]) + ' ' + b[Number(p[1]) - 1] + ' ' + p[0] : d; }
function docShell(title, sub, body, sign) {
  const s = settingsMap();
  return '<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111}h1{font-size:16px;margin:0;color:#3b1a5e}h2{font-size:12px;margin:2px 0 10px;font-weight:normal;color:#444}' +
    'table{border-collapse:collapse;width:100%}th{background:#3b1a5e;color:#fff;text-align:left;padding:5px;font-size:10px}td{border-bottom:1px solid #ccc;padding:4px 5px}.r{text-align:right}.tot td{font-weight:bold;border-top:2px solid #333}' +
    '.sign{margin-top:40px;width:100%}.sign td{border:0;text-align:center;height:90px;vertical-align:bottom}.hd{border-bottom:3px solid #3b1a5e;padding-bottom:6px;margin-bottom:10px}</style></head><body>' +
    '<div class="hd"><h1>' + esc(s.church_name || 'Pemuda Gereja') + ' - ' + esc(s.app_name || 'SI PEMUDA') + '</h1><h2>' + esc(title) + (sub ? ' | ' + esc(sub) : '') + '</h2></div>' + body +
    (sign ? '<table class="sign"><tr><td>Ketua Pemuda<br><br><br>(................................)</td><td>Bendahara / Sekretaris<br><br><br>(................................)</td></tr></table>' : '') +
    '<p style="color:#888;font-size:9px;margin-top:20px">Dicetak ' + tgl(today()) + '</p></body></html>';
}
function buildDoc(type, p, u) {
  need(u, STAFF);
  let html;
  if (type === 'roster') {
    const rows = readTable('Roster').filter(r => (!p.from || r.tanggal >= p.from) && (!p.to || r.tanggal <= p.to)).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    html = docShell('Jadwal Pelayan Ibadah', tgl(p.from) + ' s/d ' + tgl(p.to),
      '<table><tr><th>Tanggal</th><th>Ibadah</th><th>Posisi</th><th>Pelayan</th><th>Status</th></tr>' +
      rows.map(r => '<tr><td>' + tgl(r.tanggal) + '</td><td>' + esc(r.ibadah) + '</td><td>' + esc(r.posisi) + '</td><td>' + esc(r.nama) + '</td><td>' + esc(r.status) + '</td></tr>').join('') + '</table>', false);
  } else if (type === 'kas') {
    need(u, ['bph']);
    const all = readTable('Cash').sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const awal = all.filter(c => p.from && c.tanggal < p.from).reduce((s, c) => s + (c.jenis === 'masuk' ? c.nominal : -c.nominal), 0);
    const rows = all.filter(c => (!p.from || c.tanggal >= p.from) && (!p.to || c.tanggal <= p.to));
    let masuk = 0, keluar = 0;
    rows.forEach(c => { if (c.jenis === 'masuk') masuk += c.nominal; else keluar += c.nominal; });
    html = docShell('Laporan Keuangan Kas Pemuda', tgl(p.from) + ' s/d ' + tgl(p.to),
      '<table><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="r">Masuk</th><th class="r">Keluar</th></tr>' +
      '<tr><td colspan="3"><i>Saldo awal</i></td><td class="r" colspan="2">' + rp(awal) + '</td></tr>' +
      rows.map(c => '<tr><td>' + tgl(c.tanggal) + '</td><td>' + esc(c.kategori) + '</td><td>' + esc(c.keterangan) + '</td><td class="r">' + (c.jenis === 'masuk' ? rp(c.nominal) : '') + '</td><td class="r">' + (c.jenis === 'keluar' ? rp(c.nominal) : '') + '</td></tr>').join('') +
      '<tr class="tot"><td colspan="3">Total</td><td class="r">' + rp(masuk) + '</td><td class="r">' + rp(keluar) + '</td></tr>' +
      '<tr class="tot"><td colspan="3">Saldo akhir</td><td class="r" colspan="2">' + rp(awal + masuk - keluar) + '</td></tr></table>', true);
  } else if (type === 'presensi') {
    const ev = readTable('Events').find(e => e.id === p.event_id); if (!ev) throw new Error('Event tidak ditemukan');
    const att = readTable('Attendance').filter(a => a.event_id === ev.id);
    const list = p.kosong ? readTable('EventReg').filter(r => r.event_id === ev.id) : att;
    html = docShell(p.kosong ? 'Daftar Hadir (Form Manual)' : 'Rekap Kehadiran', ev.nama + ' | ' + tgl(ev.tanggal) + ' | ' + (ev.lokasi || ''),
      '<table><tr><th>No</th><th>ID</th><th>Nama</th><th>' + (p.kosong ? 'Tanda Tangan' : 'Waktu / Metode') + '</th></tr>' +
      list.map((a, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(a.member_id) + '</td><td>' + esc(a.nama) + '</td><td>' + (p.kosong ? '<br><br>' : esc(String(a.timestamp || '').replace('T', ' ')) + ' / ' + esc(a.metode || '')) + '</td></tr>').join('') +
      '</table><p>Total: <b>' + list.length + '</b></p>', false);
  } else if (type === 'anggota') {
    const rows = readTable('Members').filter(m => m.aktif !== 'tidak').sort((a, b) => a.nama.localeCompare(b.nama));
    html = docShell('Rekap Data Anggota Pemuda', 'Total ' + rows.length,
      '<table><tr><th>ID</th><th>Nama</th><th>Lahir</th><th>Rayon / Kolom</th><th>Baptis</th><th>Sidi</th><th>Minat</th></tr>' +
      rows.map(m => '<tr><td>' + esc(m.id) + '</td><td>' + esc(m.nama) + '</td><td>' + tgl(m.tgl_lahir) + '</td><td>' + esc(m.rayon) + ' / ' + esc(m.kolom) + '</td><td>' + esc(m.baptis) + '</td><td>' + esc(m.sidi) + '</td><td>' + esc(m.minat) + '</td></tr>').join('') + '</table>', false);
  } else throw new Error('Jenis dokumen tidak dikenal');
  const out = { html };
  if (p.format === 'pdf') out.pdf = Utilities.base64Encode(Utilities.newBlob(html, 'text/html', 'doc.html').getAs('application/pdf').getBytes());
  log(u.email, 'doc:' + type, JSON.stringify(p));
  return out;
}
