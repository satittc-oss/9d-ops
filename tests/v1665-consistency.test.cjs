// v16.65 ฟังก์ชันเดียวกัน = คำ + ไอคอนเดียวกัน · ชื่อหน้าตรงกับเมนู · กราฟคำขอตามเซลส์
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
test('ไม่เหลือคำเก่าที่ไม่ตรงชุดกลาง (Export / ⤓ CSV / Teams ↗ / 💬 คุยในทีม / รีเฟรชข้อมูล / 🔎)',()=>{
 for(const old of ['${dvIcon.dl} Export','>⤓ CSV<','>Teams ↗<','เปิดใน Teams ↗','💬 คุยในทีม','>รีเฟรชข้อมูล<','placeholder="🔎','>ปรับแต่งหน้านี้<'])assert.ok(!html.includes(old),old);
 assert.ok((html.match(/\$\{uiA\("csv"/g)||[]).length>=7);assert.ok((html.match(/\$\{uiA\("teams"\)\}/g)||[]).length>=5)});
test('ปุ่มสร้างทุกหน้าใช้รูปแบบเดียวกัน (+ สร้าง… / ส่ง Service Request, ปุ่มหลัก)',()=>{
 for(const t of ['ส่ง Service Request','สร้างใบเสนอราคา','สร้างใบยืม','สร้างรายการสินค้า'])assert.match(html,new RegExp('class="dv-new"[^>]*>(?:\\$\\{[^}]*\\})?<span aria-hidden="true">\\+</span> '+t));
 assert.ok(!html.includes('>+ สร้างโครงการ<'))});
test('ชื่อหน้า = ชื่อเมนู (WS_MENU ที่เดียว)',()=>{const c={};vm.createContext(c);vm.runInContext(html.match(/var WS_MENU=\[[^;]*;/)[0]+html.match(/var dvLbl=[^;]*;/)[0],c);
 assert.equal(c.dvLbl('city'),'ศูนย์ข้อมูลงาน');assert.equal(c.dvLbl('stock'),'สต็อก Demo');assert.equal(c.dvLbl('workflow'),'ตั้งค่า Workflow');
 for(const k of ['home','city','stock','projects','loans','service'])assert.ok(html.includes('<h1>${dvLbl("'+k+'")}</h1>')||html.includes('dvLbl("'+k+'")'),k)});
test('กราฟคำขอตามเซลส์: นับทุกคำขอ (รวมรออนุมัติ/ไม่อนุมัติ) แยกสถานะ เรียงมาก→น้อย และกดเพื่อกรอง',()=>{
 const src=html.slice(html.indexOf('/* v16.65 คำขอโครงการตามเซลส์'),html.indexOf('window.dvStatusPerson=(kind'));
 const mk=(id,acc,s,appr)=>({p:{id,createdAt:'2026-11-01',listApproval:appr},s,sales:{key:'account:'+acc,label:acc},engineer:{key:'eng:x'}});
 const c={DV:{sa:'account:B'},mEsc:v=>String(v),dvNum:String,dvStatusFilterPeople:(r)=>r,dvStatusRows:(p,a,m)=>m==='open'?[mk('3','A','pending','pending'),mk('4','B','rejected','rejected')]:[]};vm.createContext(c);vm.runInContext(src,c);
 const all=[mk('1','A','active','approved'),mk('2','A','won','approved'),mk('5','B','lost','approved')];
 const h=c.dvSalesBars({projects:[]},{},all);assert.match(h,/คำขอโครงการตามเซลส์/);assert.match(h,/· 5 โครงการ/);
 assert.ok(h.indexOf('>A<')<h.indexOf('>B<'));assert.match(h,/กำลังทำ 1 · WIN 1/);assert.match(h,/รออนุมัติ 1/);assert.match(h,/LOSS 1 · ยกเลิก\/ไม่อนุมัติ 1/);
 assert.match(h,/class="dv-sbr on" aria-pressed="true" data-sk="account:B"/)});
test('v16.66 สรุปสถานะใช้แท่งแบบเดียวกับกราฟเซลส์ · ข้อมูลรองเป็นปุ่มเล็ก · ปุ่มคุยในทีม/Teams/อีเมล แบบเดียวกัน · บอร์ดมือถือเลือกทีละคอลัมน์',()=>{
 assert.match(html,/class="dv-sbr dv-str\$\{on\?" on":""\}/);assert.ok(!html.includes('<div class="dv-card dv-oldc">')||html.includes('old:(M.role==="admin"||M.isApprover)?`<div class="dv-card dv-oldc">'));
 assert.match(html,/\$\{dvMinis\(\{recent:dvRecent\(ps,acc\),alog:dvApprovalLog\(/);assert.ok(!/\n  <details class="dv-tip-box">/.test(html));
 assert.match(html,/class="ui-act dv-pchat"/);assert.match(html,/mailB=x=>`<button type="button" class="ui-act"/);
 assert.match(html,/<div class="dv-bchips" role="group" aria-label="เลือกคอลัมน์">/);assert.match(html,/window\.dvBCol=k=>/)});
