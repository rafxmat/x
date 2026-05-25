const CACHE = 'rafx-v12';
const ASSETS = [
  './index.html',
  './game.html',
  './settings.html',
  './profile.html',
  './achievements.html',
  './stats.html',
  './dist/style.min.css',
  './dist/game.bundle.min.js',
  './dist/core.bundle.min.js',
  './dist/settings.bundle.min.js',
  './icons/icon.svg',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Sadece GET isteklerini önbellekle
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Google Fonts: ağdan çek, önbelleğe kaydet (offline için)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            if (response.ok) cache.put(e.request, response.clone());
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
