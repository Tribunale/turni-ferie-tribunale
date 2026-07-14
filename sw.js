const CACHE='turni-ferie-v4';
const STATIC=['./styles.css?v=2.0.0','./app.js?v=2.0.0','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).catch(()=>undefined));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(req).then(response=>{
    if(response.ok && new URL(req.url).origin===self.location.origin){
      const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(req,copy));
    }
    return response;
  }).catch(()=>caches.match(req)));
});
