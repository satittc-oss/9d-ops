// v16.80 แอปบนมือถือ: อยู่ในระบบตลอดเมื่อเปิดแบบแอป · บัญชีเดิม · แจ้งเตือนผ่าน service worker · ทางลัด
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const seg=html.slice(html.indexOf('/* v16.80 เปิดแบบแอป'),html.indexOf('async function mLogin('));
function mk(standalone,keep){const store=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m}};const c={localStorage:store(),sessionStorage:store(),matchMedia:()=>({matches:standalone}),navigator:{},M:{auth:{rt:'x'}}};if(keep)c.localStorage.setItem('9d-keep','1');vm.createContext(c);vm.runInContext(seg,c);return c}
test('เปิดแบบแอป → เก็บการเข้าสู่ระบบในเครื่อง · เบราว์เซอร์ปกติ → เฉพาะแท็บ',()=>{let a=mk(true);a.mSaveAuth();assert.ok(a.localStorage.getItem('9d-auth'));assert.equal(a.sessionStorage.getItem('9d-auth'),null);
 let b=mk(false);b.mSaveAuth();assert.equal(b.localStorage.getItem('9d-auth'),null);assert.ok(b.sessionStorage.getItem('9d-auth'));
 let k=mk(false,true);k.mSaveAuth();assert.ok(k.localStorage.getItem('9d-auth'),'เลือกจำการเข้าสู่ระบบ');
 a.mAuthClear();assert.equal(a.localStorage.getItem('9d-auth'),null)});
test('เข้าสู่ระบบด้วยบัญชีเดิม / ใช้บัญชีอื่น · แอปเข้าสู่ระบบอัตโนมัติครั้งเดียว',()=>{assert.match(html,/h=o\.pick\?"":localStorage\.getItem\("9d-hint"\)/);assert.match(html,/return h\?\{login_hint:h\}:\{prompt:"select_account"\}/);assert.match(html,/mLogin\(\{pick:1\}\)">ใช้บัญชีอื่น/);assert.match(html,/if\(mAppMode\(\)&&h&&!sessionStorage\.getItem\("9d-auto"\)\)/)});
test('แจ้งเตือนผ่าน service worker + ตัวเลขบนไอคอน + ทางลัด',()=>{assert.match(html,/r\.showNotification\(title/);assert.match(html,/pwaNotify\(`\$\{y\.by\|\|"มีคน"\} แท็กคุณใน/);assert.match(html,/navigator\.setAppBadge\(n\)/);
 const sw=fs.readFileSync(__dirname+'/../sw.js','utf8');assert.match(sw,/notificationclick/);const m=JSON.parse(fs.readFileSync(__dirname+'/../manifest.webmanifest','utf8'));assert.ok(m.shortcuts.some(s=>s.url==='./?go=appr'));
 assert.ok(fs.existsSync(__dirname+'/../vendor/qrcode.min.js'));assert.ok(fs.existsSync(__dirname+'/../splash/splash-1320x2868.png'));assert.match(html,/apple-touch-startup-image/)});
