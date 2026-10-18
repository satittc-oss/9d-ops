/* 9D Ops service worker — เปิดแบบแอปได้ / เปิดหน้าล่าสุดได้แม้สัญญาณหลุด
   หน้าเว็บโหลดจากเน็ตก่อนเสมอ (ได้เวอร์ชันใหม่ทันที) · ไม่แตะคำขอไป Microsoft 365 */
const C="9d-ops-shell-3"; // เปลี่ยนเลขทุกครั้งที่แก้ไอคอน/manifest เพื่อให้เครื่องที่ติดตั้งแล้วโหลดไฟล์ใหม่
const SHELL=["./","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png","favicon-32.png"];
const ROOT=new URL("./",self.registration.scope).pathname,isApp=u=>u.pathname===ROOT||u.pathname===ROOT+"index.html";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 if(r.mode==="navigate"){if(!isApp(u))return;/* city.html (เมืองจำลอง) และหน้าอื่นไม่ใช่ตัวแอป — ปล่อยให้โหลดจากเน็ตตามปกติ ไม่ไปทับหน้าแอปที่เก็บไว้ */e.respondWith(fetch(r).then(res=>{if(res.ok&&!u.search){const cp=res.clone();caches.open(C).then(c=>c.put("./",cp))}return res}).catch(()=>caches.match("./")));return}
 if(/\.(png|webmanifest)$/.test(u.pathname))e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})));
});
