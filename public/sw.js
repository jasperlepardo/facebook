const CACHE = 'jc-v1'
const STATIC = [
  '/',
  '/manifest.json',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET, cross-origin, and API/payload requests
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/(payload)')
  ) return

  // Network-first for HTML navigation
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
        }
        return res
      })
    })
  )
})
