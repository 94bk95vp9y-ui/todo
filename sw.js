// Tagwerk – Service Worker: macht die App offline nutzbar.
// Strategie: sofort aus dem Cache antworten, im Hintergrund aktualisieren.
const CACHE = 'tagwerk-v1';
const ASSETS = [
  './', 'index.html', 'css/app.css', 'js/app.js', 'js/store.js', 'js/sky.js',
  'fonts/fraunces.woff2', 'fonts/fraunces-italic.woff2', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
      return cached || fresh;
    }),
  );
});
