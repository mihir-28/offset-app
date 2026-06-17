const CACHE_NAME = "offset-cache-v2";
const ASSETS_TO_CACHE = [
  "/favicon.ico",
  "/icon.png",
];

// Install Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Service Worker Cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Skip browser extension requests or firebase auth/firestore endpoints
  if (
    event.request.method !== "GET" ||
    url.origin.includes("firestore.googleapis.com") ||
    url.origin.includes("identitytoolkit.googleapis.com") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.includes("/_next/webpack-hmr")
  ) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response("Offset is offline. Please reconnect and refresh.", {
          headers: { "Content-Type": "text/plain" },
          status: 503,
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request)
        .then((response) => {
          // Cache newly fetched valid static assets
          if (
            response.status === 200 &&
            response.type === "basic" &&
            (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/images") || url.pathname.includes(".png") || url.pathname.includes(".svg"))
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match("/");
        });
    })
  );
});

// Push notification listener
self.addEventListener("push", (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: "/icon.png",
        badge: "/icon.png",
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: "2",
        },
      };
      event.waitUntil(
        self.registration.showNotification(data.title || "Offset Update", options)
      );
    } catch (e) {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification("Offset", {
          body: text,
          icon: "/icon.png",
        })
      );
    }
  }
});
