// Service Worker for caching assets and API responses
const CACHE_VERSION = 'pdscan-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const BLOB_CACHE = `${CACHE_VERSION}-blobs`;

// Static assets to precache
const PRECACHE_ASSETS = [
  '/',
  '/firehose',
  '/jetstream',
  '/car',
];

// API endpoints and their cache TTLs (in seconds)
const API_CACHE_RULES = {
  // PLC directory - DIDs rarely change
  'plc.directory': 3600, // 1 hour
  // Public API - moderate caching
  'public.api.bsky.app': 300, // 5 minutes
  // PDS endpoints - short cache for records
  'xrpc/com.atproto.repo.describeRepo': 300,
  'xrpc/com.atproto.repo.listRecords': 60,
  'xrpc/com.atproto.repo.getRecord': 60,
  // Blobs are immutable - cache forever
  'xrpc/com.atproto.sync.getBlob': 31536000, // 1 year
};

// Install event - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Ignore precache failures (dev mode, etc.)
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('pdscan-') && name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache-first for static, stale-while-revalidate for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip WebSocket connections
  if (url.protocol === 'wss:' || url.protocol === 'ws:') return;

  // Handle blob requests (immutable, cache forever)
  if (url.pathname.includes('getBlob')) {
    event.respondWith(cacheFirst(event.request, BLOB_CACHE, 31536000));
    return;
  }

  // Handle API requests
  if (isApiRequest(url)) {
    const cacheTtl = getApiCacheTtl(url);
    if (cacheTtl > 0) {
      event.respondWith(staleWhileRevalidate(event.request, API_CACHE, cacheTtl));
    }
    return;
  }

  // Handle static assets
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE, 86400));
    return;
  }

  // Handle navigation requests - network first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, STATIC_CACHE));
    return;
  }
});

// Cache strategies
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached && !isExpired(cached, maxAge)) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      cache.put(request, addTimestamp(clone));
    }
    return response;
  } catch {
    if (cached) return cached;
    throw new Error('Network unavailable and no cache');
  }
}

async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Start revalidation in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, addTimestamp(response.clone()));
    }
    return response;
  }).catch(() => null);

  // Return cached if available and not too stale
  if (cached && !isExpired(cached, maxAge * 2)) {
    return cached;
  }

  // Wait for network
  const response = await fetchPromise;
  if (response) return response;
  if (cached) return cached;

  throw new Error('Network unavailable and no cache');
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Network unavailable and no cache');
  }
}

// Helper functions
function isApiRequest(url) {
  return url.pathname.includes('/xrpc/') ||
         url.hostname.includes('bsky.') ||
         url.hostname.includes('plc.directory');
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|png|jpg|jpeg|svg|ico)$/i.test(url.pathname);
}

function getApiCacheTtl(url) {
  const urlStr = url.toString();
  for (const [pattern, ttl] of Object.entries(API_CACHE_RULES)) {
    if (urlStr.includes(pattern)) return ttl;
  }
  return 0;
}

function addTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isExpired(response, maxAge) {
  const cachedAt = response.headers.get('sw-cached-at');
  if (!cachedAt) return false;
  const age = (Date.now() - parseInt(cachedAt)) / 1000;
  return age > maxAge;
}
