/**
 * Friday Truth Brief — service worker
 * Cache shell (HTML/CSS/JS/icons/manifest) + latest edition JSON for offline read.
 * Network-first for edition JSON when online; cache-first for shell assets.
 */
const CACHE_VERSION = "ftb-v6";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_URLS = [
  "/",
  "/index.html",
  "/story.html",
  "/archive.html",
  "/css/styles.css",
  "/js/app.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

const LATEST_EDITION = "/data/edition-2026-09-05.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_URLS);
      const data = await caches.open(DATA_CACHE);
      try {
        await data.add(LATEST_EDITION);
      } catch (_) {
        /* edition may fail if path differs; fetch later */
      }
      try {
        await data.add("/data/ads.json");
      } catch (_) {
        /* optional ads feed */
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("ftb-") && k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isEditionRequest(url) {
  return url.pathname.startsWith("/data/") && url.pathname.endsWith(".json");
}

function isShellRequest(url) {
  const p = url.pathname;
  if (p === "/" || p.endsWith(".html")) return true;
  if (p.startsWith("/css/") || p.startsWith("/js/")) return true;
  if (p.startsWith("/icons/")) return true;
  if (p.endsWith("manifest.webmanifest")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Network-first for edition JSON (fresh when online; fall back to cache)
  if (isEditionRequest(url)) {
    event.respondWith(networkFirstData(req));
    return;
  }

  // Cache-first for shell assets
  if (isShellRequest(url)) {
    event.respondWith(cacheFirstShell(req));
    return;
  }
});

async function networkFirstData(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // try latest edition as last resort
    const fallback = await cache.match(LATEST_EDITION);
    if (fallback) return fallback;
    return new Response(JSON.stringify({ error: "offline", stories: [] }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirstShell(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (_) {
    // Navigate requests: serve index.html offline
    if (req.mode === "navigate") {
      const index = await cache.match("/index.html") || await cache.match("/");
      if (index) return index;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}
