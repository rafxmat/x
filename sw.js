const CACHE = 'rafx-v1';
const ASSETS = [
  '/index.html',
  '/game.html',
  '/settings.html',
  '/css/style.css',
  '/js/audio.js',
  '/js/drag.js',
  '/js/game.js',
  '/js/puzzle.js',
  '/js/stats.js',
  '/js/storage.js',
  '/js/theme.js',
  '/icons/icon.svg',
  '/manifest.json',
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
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
