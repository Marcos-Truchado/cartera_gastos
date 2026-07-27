// Service worker: guarda la app en caché para que funcione sin conexión
const CACHE = "gastos-v5";
const ARCHIVOS = ["./", "./index.html", "./icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // se guarda archivo por archivo: si falta uno (el icono, por ejemplo) no se cae todo el guardado
      Promise.all(ARCHIVOS.map((a) => c.add(a).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estrategia: responder desde caché al instante y actualizar en segundo plano
// (la foto de fondo no se cachea aquí: se guarda directamente en el móvil, dentro de la app)
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((enCache) => {
      const desdeRed = fetch(e.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copia));
          }
          return resp;
        })
        .catch(() => enCache || caches.match("./index.html")); // sin red y sin caché exacta: al menos abre la app
      return enCache || desdeRed;
    })
  );
});
