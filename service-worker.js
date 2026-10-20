const CACHE_NAME = "hearth-shell-v7";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./apk-updater.js",
  "./accounting.js",
  "./query-results.js",
  "./household-permissions.js",
  "./ui-preferences.js",
  "./voice.js",
  "./pwa.js",
  "./styles.css",
  "./calendar-feature/calendar.js",
  "./calendar-feature/calendar.css",
  "./manifest.webmanifest",
  "./icons/hearth-logo.png",
  "./icons/hearth-mark.png",
  "./icons/hearth-192.png",
  "./icons/hearth-512.png",
  "./icons/hearth-maskable-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("hearth-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.includes("/rest/") || url.pathname.includes("/auth/") || url.pathname.includes("/storage/")) return;
  const allowed = new Set(SHELL_FILES.map(path => new URL(path, self.registration.scope).pathname));
  if (!allowed.has(url.pathname)) return;

  // Use network-first for app code to ensure fresh updates are delivered immediately
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
