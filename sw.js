/* 9D Ops service worker — เปิดแบบแอปได้ / เปิดหน้าล่าสุดได้แม้สัญญาณหลุด
   หน้าเว็บโหลดจากเน็ตก่อนเสมอ (ได้เวอร์ชันใหม่ทันที) · ไม่แตะคำขอไป Microsoft 365 */
const C="9d-ops-shell-6"; // v16.80 แอปบนมือถือ: แจ้งเตือน + ทางลัด
const SHELL=["./","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png","favicon-32.png","assets/nine-logo.png","sync-core.js?v=16.41","sync-m365.js?v=16.41"];
const ROOT=new URL("./",self.registration.scope).pathname,isApp=u=>u.pathname===ROOT||u.pathname===ROOT+"index.html";
/* v16.80 แตะการแจ้งเตือน → เปิดแอป (หรือสลับไปแอปที่เปิดอยู่) แล้วไปที่ข้อความนั้น */
self.addEventListener("notificationclick",e=>{e.notification.close();const d=e.notification.data||{};e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>new URL(x.url).pathname.startsWith(ROOT));if(c){c.postMessage(d);return c.focus()}return self.clients.openWindow(ROOT+(d.go?"?go="+encodeURIComponent(d.go):""))}))});
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 if(r.mode==="navigate"){if(!isApp(u))return;/* city.html (เมืองจำลอง) และหน้าอื่นไม่ใช่ตัวแอป — ปล่อยให้โหลดจากเน็ตตามปกติ ไม่ไปทับหน้าแอปที่เก็บไว้ */e.respondWith(fetch(r).then(res=>{if(res.ok&&!u.search){const cp=res.clone();caches.open(C).then(c=>c.put("./",cp))}return res}).catch(()=>caches.match("./")));return}
 if(/\/sync-(core|m365)\.js$/.test(u.pathname)){e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r)));return}
 if(/\.(png|webmanifest)$/.test(u.pathname))e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})));
});
