// Coach App Service Worker — network-first, offline fallback
const CACHE_NAME = "coach-app-v3";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  // Don't pre-cache app routes — they require auth and can fail,
  // which would abort the entire SW installation.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET navigation requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests (Firebase, Firestore, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first: try the network, fall back to offline page for navigation
  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === "navigate") {
        return caches.match(OFFLINE_URL) ?? Response.error();
      }
      return Response.error();
    })
  );
});
