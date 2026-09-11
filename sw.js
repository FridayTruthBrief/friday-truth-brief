/**
 * Friday Truth Brief — service worker (relative URLs for GitHub project Pages)
 */
const CACHE_VERSION = "ftb-v11";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const BASE = self.registration.scope;

function u(path) {
  return new URL(path.replace(/^\//, ""), BASE).href;
}

const SHELL_PATHS = [
  "./", "./index.html", "./story.html", "./archive.html",
  "./css/styles.css", "./js/app.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_PATHS.map((p) => u(p)));
    const data = await caches.open(DATA_CACHE);
    // Precache the stable current endpoint for offline fallback; JSON remains network-first.
    for (const p of ["./data/ads.json", "./data/current.json"]) {
      try { await data.add(u(p)); } catch (_) {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("ftb-") && k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isEditionRequest(url) {
  return url.pathname.includes("/data/") && url.pathname.endsWith(".json");
}
function isShellRequest(url) {
  const p = url.pathname;
  return p.endsWith("/") || p.endsWith(".html") || p.includes("/css/") || p.includes("/js/") || p.includes("/icons/") || p.endsWith("manifest.webmanifest");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  if (isEditionRequest(url)) {
    event.respondWith((async () => {
      // current.json uses a changing query string; normalize its cache key for offline fallback.
      const cacheKey = url.pathname.endsWith("/data/current.json")
        ? u("./data/current.json")
        : req;
      try {
        const net = await fetch(req);
        if (net && net.ok) { (await caches.open(DATA_CACHE)).put(cacheKey, net.clone()); }
        return net;
      } catch (_) {
        const cached = await caches.match(cacheKey);
        if (cached) return cached;
        throw _;
      }
    })());
    return;
  }

  if (isShellRequest(url)) {
    // Network-first so shell updates reach installed PWAs (especially iOS home screen).
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        if (net && net.ok) { (await caches.open(SHELL_CACHE)).put(req, net.clone()); }
        return net;
      } catch (_) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw _;
      }
    })());
  }
});
