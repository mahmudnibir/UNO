
const CACHE_NAME = 'uno-master-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/icon.svg',
  '/manifest.json',
  '/utils/gameLogic.ts',
  '/utils/sound.ts',
  '/utils/multiplayer.ts',
  '/types.ts',
  '/components/CardView.tsx',
  '/components/GameTable.tsx',
  '/components/PlayerHand.tsx',
  '/components/ColorPicker.tsx',
  '/App.tsx'
];

// Install Event: Cache core local files immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event: Clean up old caches
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

// Fetch Event: Network First for API/Peers, Cache First for Assets/Libs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignore PeerJS signaling server traffic (real-time multiplayer)
  // We MUST allow the 'peerjs' library script from esm.sh to be cached, 
  // so we only exclude calls to the peerjs.com domain (the signaling server).
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
          // C. Offline Fallback
          // If both cache and network fail, we can't do much for dynamic calls.
          // However, the main app shell (index.html) is pre-cached on install.
        });
    })
  );
});
