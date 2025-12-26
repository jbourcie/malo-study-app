// Service worker neutre pour éviter les 404 lors de l'enregistrement.
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Pas de cache pour l'instant
})

self.addEventListener('fetch', () => {
  // Pas d'interception : on laisse le réseau gérer
})
