// Juyeop loading optimization, test build 20.
// Only same-origin static game assets; never cache ranking/API or save transfers.
const CACHE = "juyeop-test20-assets-v2";
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil((async()=>{
  for(const key of await caches.keys()) if(key.startsWith("juyeop-test20-assets-") && key!==CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  const req=event.request, url=new URL(req.url);
  if(req.method!=="GET" || url.origin!==self.location.origin || req.headers.has("range")) return;
  const assetsPath=new URL("../assets/",self.registration.scope).pathname;
  if(!url.pathname.startsWith(assetsPath) || !/\.(webp|png|jpe?g|gif|svg|ogg|mp3|wav|m4a|woff2?)$/i.test(url.pathname)) return;
  event.respondWith((async()=>{
    let cache;
    try{cache=await caches.open(CACHE);const cached=await cache.match(req);if(cached)return cached;}catch(e){}
    const response=await fetch(req);
    if(cache && response.ok && response.status===200){try{await cache.put(req,response.clone());}catch(e){}}
    return response;
  })());
});