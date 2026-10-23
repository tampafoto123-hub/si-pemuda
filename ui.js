const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tgl = d => { if (!d) return '-'; const p = String(d).slice(0, 10).split('-'); return p.length === 3 ? `${+p[2]} ${BLN[+p[1] - 1]} ${p[0]}` : d; };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const IC = {
  dash: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.5 2.6 3.5 5.5"/>',
  cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8.5 15l2.5 2.5 4.5-5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
  group: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M10 10l-3.5 4M14 10l3.5 4"/>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5"/>',
  heart: '<path d="M12 20s-7-4.5-9-9.2C1.8 7 4.2 4 7.3 4 9.2 4 11 5 12 6.6 13 5 14.800 4 16.700 4 19.800 4 22.200 7 21 10.800c-2 4.700-9 9.200-9 9.200z"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sync: '<path d="M21 12a9 9 0 0 0-15-6.700L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.700L21 16M21 21v-5h-5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.300 21a2 2 0 0 0 3.400 0"/>',
  church: '<path d="M12 2v5M10 4.500h4M12 7l-6 4v10h12V11zM9 21v-5h6v5M3 21h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"/>'
};
const ico = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

function toast(msg, err) {
  const w = $('#toast'), d = document.createElement('div'); d.textContent = msg; if (err) d.className = 'e'; w.appendChild(d); setTimeout(() => d.remove(), 3800);
}
function skeleton(n = 4) { return '<div class="card">' + '<div class="skel"></div>'.repeat(n) + '</div>'; }

/** Modal generik. body = HTML string. Mengembalikan elemen overlay. */
function modal(title, body, opts = {}) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${body}</div>`;
  ov.addEventListener('mousedown', e => { if (e.target === ov && !opts.sticky) close(); });
  const close = () => { ov.remove(); if (opts.onClose) opts.onClose(); };
  ov.close = close; document.body.appendChild(ov); return ov;
}
function fieldHTML(f, v) {
  const val = v ?? f.def ?? '', id = 'f_' + f.k, req = f.req ? ' required' : '';
  let inp;
  if (f.type === 'select') inp = `<select id="${id}"${req}>${(f.opts || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}"${String(ov) === String(val) ? ' selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  else if (f.type === 'textarea') inp = `<textarea id="${id}" rows="${f.rows || 4}"${req}>${esc(val)}</textarea>`;
  else if (f.type === 'file') inp = `<input id="${id}" type="file" accept="${f.accept || '*'}">`;
  else inp = `<input id="${id}" type="${f.type || 'text'}" value="${esc(val)}"${req}${f.type === 'number' ? ' inputmode="numeric"' : ''}>`;
  return `<div class="${f.full ? 'full' : ''}"><label for="${id}">${esc(f.label)}</label>${inp}</div>`;
}
/** Form modal: fields [{k,label,type,opts,req,full,def}], values, onSubmit(obj) -> Promise */
function formModal(title, fields, values, onSubmit, submitLabel = 'Simpan') {
  values = values || {};
  const ov = modal(title, `<form><div class="fg">${fields.map(f => fieldHTML(f, values[f.k])).join('')}</div><div class="act"><button type="button" class="btn sec2" data-x>Batal</button><button class="btn">${esc(submitLabel)}</button></div></form>`);
  $('[data-x]', ov).onclick = ov.close;
  $('form', ov).onsubmit = async e => {
    e.preventDefault();
    const o = {}; fields.forEach(f => { const el = $('#f_' + f.k, ov); o[f.k] = f.type === 'file' ? el.files[0] : el.value; });
    const b = $('.btn:not(.sec2)', ov); b.disabled = true;
    try { await onSubmit(o); ov.close(); } catch (err) { toast(err.message, true); b.disabled = false; }
  };
  return ov;
}
function confirmBox(msg) {
  return new Promise(res => {
    const ov = modal('Konfirmasi', `<p>${esc(msg)}</p><div class="act"><button class="btn sec2" data-n>Batal</button><button class="btn danger" data-y>Ya, lanjut</button></div>`, { onClose: () => res(false) });
    $('[data-n]', ov).onclick = ov.close; $('[data-y]', ov).onclick = () => { res(true); ov.remove(); };
  });
}
function readFileB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
}
/** Muat script eksternal sekali (lazy) */
const _loaded = {};
function loadScript(src) { return _loaded[src] || (_loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); })); }
function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/** Cetak dokumen dari Doc Engine: buka jendela cetak (A4) atau unduh PDF */
async function printDoc(type, params, pdf) {
  toast('Menyiapkan dokumen...');
  const r = await Api.call('doc', { type, params: { ...params, format: pdf ? 'pdf' : 'html' } });
  if (pdf && r.pdf) {
    const bin = atob(r.pdf), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })); a.download = type + '-' + todayStr() + '.pdf'; a.click();
  } else {
    const w = window.open('', '_blank'); if (!w) return toast('Izinkan pop-up untuk mencetak', true);
    w.document.write(r.html.replace('</style>', '@page{size:A4;margin:14mm}</style>')); w.document.close(); setTimeout(() => w.print(), 400);
  }
}
