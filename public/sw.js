// Service Worker: App-Shell offline verfügbar halten.
// ponytail: kein Precache-Manifest — Vite-Assets haben Content-Hashes im Namen,
// also reicht cache-first zur Laufzeit. index.html bleibt network-first, damit
// ein neuer Build sofort die neuen Asset-Namen bekommt.
const CACHE = "dream-buddy-v1";
const INDEX = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(INDEX)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(INDEX, res.clone()));
          return res;
        })
        .catch(() => caches.match(INDEX)),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        }),
    ),
  );
});
