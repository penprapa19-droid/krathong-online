// v5: cache safe, bypass audio/range
const CACHE = 'loykrathong-v5';
const ASSETS = [
  './','index.html','manifest.json',
  'images/bg5.png','images/bg5mb.png',
  'images/kt1.png','images/kt2.png','images/kt3.png','images/kt4.png','kt5.png',
  'images/tuktuk.png','images/logo.png',
  'images/icon-192.png','images/icon-512.png',
  'audio/song.mp3',
  'main.js?v=5'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req=e.request;
  const url=new URL(req.url);
  if (req.headers.get('range')) { e.respondWith(fetch(req)); return; }
  if (url.pathname.startsWith('/loykrathong2025/audio/')) { e.respondWith(fetch(req)); return; }
  e.respondWith(
    caches.match(req).then(hit=>{
      const net=fetch(req).then(res=>{
        if(res.ok && res.type==='basic'){ caches.open(CACHE).then(c=>c.put(req,res.clone())).catch(()=>{}); }
        return res;
      }).catch(()=>hit || caches.match('images/bg5.png'));
      return hit || net;
    })
  );
});
