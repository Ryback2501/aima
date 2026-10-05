// The service worker: a small helper the browser runs next to the app.
// Phones need it to treat aima as an installable app. It also keeps a copy of the app's own
// files, so the app still opens when the internet is slow or gone for a moment.
// It never keeps Google's answers (sign-in or sheet data): those always come fresh from Google.

// The build writes the app version here. A new version gets a new copy and the old one is deleted.
const CACHE = 'aima-__VERSION__';

self.addEventListener('install', () => {
  // Use the new version straight away instead of waiting for every app window to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only the app's own files. Google requests go straight to Google.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Ask the internet first, so people always get the newest version when they are online.
  // Keep a copy, and use the copy only when the internet does not answer.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        const copy = await cache.match(request);
        if (copy) return copy;
        throw error;
      }
    })(),
  );
});
