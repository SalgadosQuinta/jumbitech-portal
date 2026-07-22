/* JumbiTech Portal service worker.
 * Conventions: network-first shell with a 3.5s deadline falling back to cache;
 * versioned cache bumped in lockstep with APP_BUILD in the app bundle.
 * Data requests (Supabase) are NOT intercepted: auth and RLS responses must
 * never be served stale from a shared cache.
 */
const CACHE = 'jtp-cache-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];
const SHELL_DEADLINE_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, deadlineMs) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (!settled && cached) { settled = true; resolve(cached); }
    }, deadlineMs);

    fetch(request)
      .then(async (resp) => {
        clearTimeout(timer);
        if (resp && resp.ok && request.method === 'GET') {
          const copy = resp.clone();
          const cache = await caches.open(CACHE);
          cache.put(request, copy);
        }
        if (!settled) { settled = true; resolve(resp); }
      })
      .catch(async () => {
        clearTimeout(timer);
        const cached = await caches.match(request, { ignoreSearch: true });
        if (!settled) { settled = true; resolve(cached || Response.error()); }
      });
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never intercept cross-origin (Supabase) or non-GET requests.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  event.respondWith(networkFirst(event.request, SHELL_DEADLINE_MS));
});
