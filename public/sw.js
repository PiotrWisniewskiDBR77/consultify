// IMPORTANT:
// - We only cache the app shell and ALWAYS try network-first for navigations.
// - This prevents "zero changes" after deploy (stale cached index.html).
// - Bump CACHE_VERSION when changing caching strategy.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `consultinity-${CACHE_VERSION}`;
const APP_SHELL_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppShell = APP_SHELL_URLS.includes(url.pathname);
  const isNavigation =
    req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  // Network-first for navigations (index.html). Fall back to cached shell offline.
  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          // Keep the cached app shell fresh.
          cache.put('/index.html', res.clone());
          return res;
        } catch (err) {
          return (await caches.match('/index.html')) || (await caches.match('/')) || fetch(req);
        }
      })()
    );
    return;
  }

  // Cache-first only for a small app shell set.
  if (isAppShell) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
        return res;
      })()
    );
    return;
  }

  // Everything else: pass-through.
  event.respondWith(fetch(req));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('consultinity-')) {
            return caches.delete(cacheName);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});
