// Service worker: aset statis cache-first (cepat), halaman network-first. Naikkan VER saat rilis baru.
const VER = 'sp-v1', ASSETS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/api.js', 'js/ui.js', 'js/views1.js', 'js/views2.js', 'js/main.js', 'manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) caches.open(VER).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;   // stale-while-revalidate
  }));
});
