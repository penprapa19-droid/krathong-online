// v6: cache safe, bypass audio/range, FIXED kt5.png path
const CACHE = 'loykrathong-v6';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'images/bg5.png',
  'images/bg5mb.png',
  'images/kt1.png',
  'images/kt2.png',
  'images/kt3.png',
  'images/kt4.png',
  'images/kt5.png', // FIXED: Added 'images/' prefix
  'images/tuktuk.png',
  'images/logo.png',
  'images/no-smoking.png',
  'images/icon-192.png',
  'images/icon-512.png',
  'audio/song.mp3',
  'main.js?v=6'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  
  // Bypass range requests (for audio/video)
  if (req.headers.get('range')) {
    e.respondWith(fetch(req));
    return;
  }
  
  // Bypass audio files
  if (url.pathname.includes('/audio/')) {
    e.respondWith(fetch(req));
    return;
  }
  
  // Cache-first strategy for other resources
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          caches.open(CACHE)
            .then(c => c.put(req, res.clone()))
            .catch(() => {});
        }
        return res;
      }).catch(() => hit || caches.match('images/bg5.png'));
      
      return hit || net;
    })
  );
});
