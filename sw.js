// sw.js - minimal service worker skeleton (drop in site root if you want basic offline cache)
const CACHE_NAME = 'devdetective-v1';
const OFFLINE_FILES = ['/', '/index.html', '/style.css', '/script.js'];

self.addEventListener('install', (evt) => {
    evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_FILES)));
    self.skipWaiting();
});

self.addEventListener('fetch', (evt) => {
    evt.respondWith(caches.match(evt.request).then(res => res || fetch(evt.request)));
});
