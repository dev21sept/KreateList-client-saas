const CACHE_NAME = "elister-cache-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Never intercept non-GET requests, API requests, or cross-origin requests
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/") ||
    event.request.url.includes("api.elister.ai")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
    })
  );
});
