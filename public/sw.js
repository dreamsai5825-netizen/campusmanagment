/* Minimal service worker for PWA installability */
const CACHE_NAME = 'campus-connect-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  /* Pass through - no caching required for install prompt */
});
