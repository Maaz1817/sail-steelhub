// Minimal offline shell for the Arivu web app.
// Bump this whenever the app shell changes so installed phones get the newest design.
const CACHE = "arivu-v1";
const ASSETS = ["/icon-192.png", "/icon-512.png", "/favicon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const pathname = new URL(request.url).pathname;
  if (!/\.(png|jpg|jpeg|svg|webp|ico|css|js|webmanifest)$/.test(pathname)) return;

  // Styles and scripts must be network-first. A cache-first CSS file can make an
  // installed app keep an old design after a new version is published.
  if (/\.(css|js)$/.test(pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return response;
        }),
    ),
  );
});
