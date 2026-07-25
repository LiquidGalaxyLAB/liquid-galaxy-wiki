// ═══════════════════════════════════════════════════════════════════════════
//  LG Wiki — Service Worker
//  Strategy:
//    • App Shell (HTML/CSS/JS/local assets) → Cache-First
//    • GitHub raw content (index.json, .md files) → Network-First with cache fallback
//    • Google Fonts / CDN assets  → Cache-First (stale-while-revalidate)
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'lg-wiki-v2';
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const CONTENT_CACHE = `${CACHE_VERSION}-content`;
const CDN_CACHE     = `${CACHE_VERSION}-cdn`;

// All local app-shell assets to pre-cache on install
const SHELL_ASSETS = [
  './',
  './index.html',
  './tokens.css',
  './token_dark.css',
  './syntax.css',
  './components.css',
  './layout.css',
  './styles.css',
  './app.js',
  './github.js',
  './theme.js',
  './markdown-setup.js',
  './manifest.json',
  './favicon.ico',
  './public/assets/wiki-logo.png',
  './public/assets/lg-logo.png',
  './public/assets/searchbar.svg',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
  './public/icons/favicon-16x16.png',
  './public/icons/favicon-32x32.png',
  './public/icons/apple-touch-icon.png',
];

// CDN origins to cache (fonts, highlight.js, material web)
const CDN_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com',
  'https://esm.run',
  'https://esm.sh',
];

// GitHub raw content origin
const GITHUB_RAW_ORIGIN = 'https://raw.githubusercontent.com';

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      // addAll() will fail silently for individual resources if we use
      // individual add() calls — use Promise.allSettled for resilience
      return Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Failed to cache: ${url}`, err)
          )
        )
      );
    }).then(() => self.skipWaiting()) // Activate immediately
  );
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const allowedCaches = [SHELL_CACHE, CONTENT_CACHE, CDN_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !allowedCaches.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim()) // Take control of all open tabs
  );
});

// ── Fetch: route requests to the right strategy ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // 1. GitHub raw content → Network-First (fresh content, fallback to cache)
  if (url.origin === GITHUB_RAW_ORIGIN) {
    event.respondWith(networkFirst(request, CONTENT_CACHE));
    return;
  }

  // 2. CDN resources (fonts, highlight.js, material web) → Cache-First
  if (CDN_ORIGINS.some((origin) => url.origin === origin || url.href.startsWith(origin))) {
    event.respondWith(cacheFirst(request, CDN_CACHE));
    return;
  }

  // 3. Same-origin app shell → Cache-First with network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
});

// ── Strategy: Cache-First ────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Offline and not cached — return the offline shell for navigation requests
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline — resource not available.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// ── Strategy: Network-First ──────────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed → fall back to cache
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response('Offline — content not available.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
