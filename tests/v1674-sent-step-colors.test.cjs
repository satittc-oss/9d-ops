// v16.74 "ส่งงานแล้ว" เป็นขั้นตอนหนึ่ง (ไม่ใช่สถานะแยก) · นับรอบแก้ R1/R2 · โทนสีกลาง
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
test('ขั้นตอน ส่งงานแล้ว อยู่ท้ายสุดของงานที่กำลังทำ · ทีมขายรับต่อ',()=>{
 assert.match(html,/sent:\{t:"ส่งงานแล้ว · ทีมขายรับต่อ",tag:"#ส่งงานแล้ว",who:"ทีมขาย",z:"S"/);
 assert.match(html,/var SUBORD=\["recv","design","buy","sup","price","quote","cust","sales","sent"\]/);
 assert.match(html,/return p\.pstat\.s==="delivered"\?"active":p\.pstat\.s/,'สถานะ delivered เดิมอ่านเป็น กำลังทำ');
 assert.match(html,/if\(s==="delivered"&&SUBST\.sent\)return mSetSub\(pid,"sent",o\)/,'ปุ่มส่งงานแล้ว = ตั้งขั้นตอน');
 assert.doesNotMatch(html,/\["delivered","ส่งงานแล้ว",cnt\("delivered"\)\]/,'ไม่มีแท็บ ส่งงานแล้ว แยกแล้ว')});
test('นับรอบที่ถูกส่งกลับมาแก้ (จาก ส่งงานแล้ว → ขั้นตอนของทีมเรา)',()=>{
 assert.match(html,/subRev=sublog\[k\]\.filter\(r=>r\.prev==="sent"&&r\.sub!=="sent"/);
 const seg=html.slice(html.indexOf('var mRev='),html.indexOf('\n',html.indexOf('var mRev=')));const c={M:{cache:{track:{7:{subRev:2}}}}};vm.createContext(c);vm.runInContext(seg.replace(/^var /,'var ').replace(/;?\s*$/,';')+'this.dvRevB=dvRevB',c);
 assert.match(c.dvRevB({listItemId:7}),/แก้ R2/);assert.equal(c.dvRevB({listItemId:8}),'')});
test('โทนสีกลาง: สีขั้นตอนใหม่ + สีเดิมที่ Admin เคยบันทึกถูกแปลง',()=>{
 assert.match(html,/var STEPCOL=\{recv:"#2B5FB4",design:"#3E9B5A",buy:"#7A35BD",sup:"#2E9A78",price:"#B03A72",quote:"#4B4FC2",cust:"#B8860B",sales:"#3A8FD0",sent:"#A85A28"/);
 const i=html.indexOf('var M_COL_UP=');const c={};vm.createContext(c);vm.runInContext(html.slice(i,html.indexOf('\n',i)),c);
 assert.equal(c.mColUp('#00B259'),'#3E9B5A');assert.equal(c.mColUp('#ffc012'),'#B8860B');assert.equal(c.mColUp('#123456'),'#123456');
 for(const v of ['FF8000','00B259','FFC012','BC1A8C','6A1499','EC1C24'])assert.ok(!new RegExp('#'+v+'(?![0-9A-F])','i').test(html.replace(/var M_COL_UP=[^\n]*/,'').replace(/var STEP_PALS=[^\n]*/,'')),'ไม่เหลือสีสด #'+v);
 assert.match(html,/\.dv-rev\{/)});
