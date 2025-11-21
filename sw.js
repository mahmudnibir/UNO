
const CACHE_NAME = 'uno-master-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './index.tsx',
  './icon.svg',
  './manifest.json',
  './utils/gameLogic.ts',
  './utils/sound.ts',
  './utils/multiplayer.ts',
  './types.ts',
  './components/CardView.tsx',
  './components/GameTable.tsx',
  './components/PlayerHand.tsx',
  './components/ColorPicker.tsx',
  './App.tsx'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignore PeerJS signaling server traffic (real-time multiplayer)
  if (url.hostname.endsWith('peerjs.com')) {
    return; 
  }

  // 2. Cache Strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // A. Cache Hit: Return immediately
      if (cachedResponse) {
        return cachedResponse;
      }

      // B. Cache Miss: Fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          // Check if valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }

          // Clone and Cache the valid response (Runtime Caching for CDNs like React/Tailwind)
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // C. Offline Fallback for Main Page
           if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
           }
        });
    })
  );
});