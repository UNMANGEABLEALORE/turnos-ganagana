/**
 * sw.js — Service worker: permite que la aplicación SIGA ABRIENDO aunque el equipo se quede sin internet.
 *  · Páginas y archivos de la app: red primero; si no hay red, se usa la última copia guardada.
 *  · /api y /socket.io NUNCA se guardan (los turnos siempre se piden al servidor en vivo).
 * Importante: sin internet NO se asignan turnos; la página solo muestra el aviso y espera la reconexión.
 */
const CACHE = 'gg-app-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(c => c !== CACHE).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  e.respondWith(
    fetch(req)
      .then(resp => {
        if (resp.ok) {
          const copia = resp.clone();
          // Las páginas (rutas de la app) comparten la misma copia de index.html
          const clave = req.mode === 'navigate' ? '/' : req;
          caches.open(CACHE).then(c => c.put(clave, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(async () => {
        const c = await caches.open(CACHE);
        return (await c.match(req.mode === 'navigate' ? '/' : req))
          || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      })
  );
});
