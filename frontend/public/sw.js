const CACHE = 'jarvis-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Always network for API and cross-origin
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Navigation requests (HTML) — always fresh from network so index.html never goes stale
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Versioned assets (/assets/xxx-hash.js) — cache-first, safe because hash changes per deploy
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Everything else — network
  e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
});
