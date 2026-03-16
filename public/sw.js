// IMPORTANT:
// - We only cache the app shell and ALWAYS try network-first for navigations.
// - This prevents "zero changes" after deploy (stale cached index.html).
// - Bump CACHE_VERSION when changing caching strategy.
const CACHE_VERSION = 'v4';
const CACHE_NAME = `consultify-${CACHE_VERSION}`;
const API_CACHE_NAME = `consultify-api-${CACHE_VERSION}`;
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/my-work',
  '/manifest.json',
  '/favicon.png',
  '/favicon-16.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/logos/logo-light.png',
  '/assets/logos/logo-dark.png',
  '/assets/logos/logo-icon.png',
];

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
  const isApi = url.pathname.startsWith('/api/');

  // Network-first for navigations (index.html). Fall back to cached shell offline.
  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', res.clone());
          return res;
        } catch (err) {
          return (await caches.match('/index.html')) || (await caches.match('/')) || fetch(req);
        }
      })()
    );
    return;
  }

  // API calls: network-first with cache fallback for offline resilience
  if (isApi) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(req, res.clone());
          }
          return res;
        } catch (err) {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
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
      const activeCaches = new Set([CACHE_NAME, API_CACHE_NAME]);
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!activeCaches.has(cacheName) && cacheName.startsWith('consultify-')) {
            return caches.delete(cacheName);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});
