// ═══════════════════════════════════════════════════════════
//  STE FRÈRES GARBOUJ — Service Worker v9
//  Stratégie: NETWORK FIRST pour HTML, CACHE FIRST pour assets
//  Les fichiers HTML sont TOUJOURS rechargés depuis le réseau
// ═══════════════════════════════════════════════════════════
const CACHE = 'garbouj-v9';

// Assets statiques légers mis en cache (PAS les HTML)
const CACHE_ASSETS = [
  './manifest.json'
];

// Ces URLs vont TOUJOURS au réseau — Firebase + ses SDKs
const NETWORK_ONLY = [
  'firebasedatabase.app',
  'firebaseio.com',
  'googleapis.com',
  'gstatic.com',
  'firebaseapp.com',
  'sfgrh-71793'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CACHE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Suppression ancien cache:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. Firebase et APIs externes → TOUJOURS réseau, jamais cache
  const isNetworkOnly = NETWORK_ONLY.some(p => url.includes(p));
  if (isNetworkOnly) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 2. Fichiers HTML → NETWORK FIRST (toujours version fraîche)
  if (url.endsWith('.html') || url.endsWith('/') || !url.includes('.')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 3. Autres assets → CACHE FIRST
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
