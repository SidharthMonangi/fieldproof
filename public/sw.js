const CACHE='fieldproof-shell-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fieldproof-shell-')&&k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',event=>{const r=event.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.includes('chatgpt')||u.pathname==='/callback')return;
 if(r.mode==='navigate'&&u.pathname==='/'){event.respondWith(fetch(r).then(async res=>{if(res.ok){const c=await caches.open(CACHE);await c.put('/',res.clone());}return res;}).catch(async()=>{const cached=await caches.match('/');return cached||new Response('Open FieldProof once while connected before using it offline.',{status:503});}));return;}
 if(r.destination==='script'||r.destination==='style'||/\.(js|css|woff2?|svg)$/.test(u.pathname)){event.respondWith(fetch(r).then(async res=>{if(res.ok){const c=await caches.open(CACHE);await c.put(r,res.clone());}return res;}).catch(()=>caches.match(r)));}
});

