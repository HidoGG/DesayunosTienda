// Service Worker · Las Santiagueñas
// Estrategia: Network First — siempre intenta la red, el caché es solo fallback offline.
const CACHE = 'santiaguenas-v1';

// Activa inmediatamente sin esperar a que se cierren otras pestañas
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  // Borra cachés viejos de versiones anteriores
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Solo interceptar GET de nuestro propio origen; dejar pasar Supabase y CDNs
  if (e.request.method !== 'GET') return;
  if (!url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Guarda copia fresca en caché y devuelve la respuesta de red (siempre actualizada)
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request)) // Solo usa caché si no hay red (offline)
  );
});
