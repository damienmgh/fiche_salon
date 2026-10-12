// Cache hors ligne de l'application. Incrémenter VERSION à chaque mise à jour des fichiers de l'application.
// Le moteur de lecture de carte (dossier ocr/) a son propre cache, conservé entre les versions.
const VERSION = 'mgh-fiche-salon-v7';
const OCR_CACHE = 'mgh-fiche-salon-ocr-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './logo.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== OCR_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Moteur de lecture de carte : cache d'abord (fichiers lourds, stables)
  if (url.origin === location.origin && url.pathname.includes('/ocr/')) {
    e.respondWith(
      caches.open(OCR_CACHE).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok) c.put(e.request, r.clone());
        return r;
      })))
    );
    return;
  }

  // Application : réseau d'abord quand il répond vite (mises à jour), cache sinon (salon sans wifi).
  e.respondWith(
    Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))])
      .then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
