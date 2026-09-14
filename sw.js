// Service Worker بسيط للتخزين المؤقت الأساسي
const CACHE_NAME = 'yemen-obs-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/news/news.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
