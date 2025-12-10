const CACHE_NAME = 'lumicheck-offline-v2';
const DYNAMIC_CACHE = 'lumicheck-dynamic-v2';

// Files to cache immediately for the App Shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/types.ts',
  '/App.tsx',
  '/services/geminiService.ts', // Now contains the offline logic
  '/components/CameraView.tsx',
  '/components/ScanResult.tsx',
  'https://unpkg.com/tesseract.js@v2.1.0/dist/tesseract.min.js', // Cache the OCR engine
  'https://unpkg.com/tesseract.js@v2.1.0/dist/worker.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('Erro ao cachear arquivos iniciais:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Offline-first strategy
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
            return networkResponse;
          }

          // Dynamic caching for Tesseract language data (.traineddata)
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
           // Fallback logic could go here
        });
    })
  );
});