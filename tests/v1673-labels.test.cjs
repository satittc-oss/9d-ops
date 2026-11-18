// v16.73 ชื่อสถานะใหม่: ส่งราคาแล้ว · รอลูกค้าตัดสินใจ / รอลูกค้าให้ข้อมูล / ส่งงานแล้ว · ทีมขายดำเนินการต่อได้เลย
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
test('ค่าเริ่มต้นใหม่',()=>{assert.match(html,/cust:\{t:"รอลูกค้าให้ข้อมูล"/);assert.match(html,/quote:\{t:"ส่งราคาแล้ว · รอลูกค้าตัดสินใจ"/);assert.match(html,/delivered:\{t:"ส่งงานแล้ว · ทีมขายดำเนินการต่อได้เลย"/)});
test('ชื่อเดิมที่บันทึกไว้ใน Workflow/การ์ดสถานะ เปลี่ยนเป็นชื่อใหม่ ส่วนชื่อที่ Admin ตั้งเองคงไว้',()=>{const seg=html.slice(html.indexOf('var M_LBL_UP='),html.indexOf('function mWfDefSteps('));const c={};vm.createContext(c);vm.runInContext(seg,c);
 assert.equal(c.mLblUp('quote','ส่งราคาแล้ว'),'ส่งราคาแล้ว · รอลูกค้าตัดสินใจ');assert.equal(c.mLblUp('cust','รอลูกค้า'),'รอลูกค้าให้ข้อมูล');assert.equal(c.mLblUp('delivered','ส่งงานแล้ว · รอลูกค้า'),'ส่งงานแล้ว · ทีมขายรับต่อ');assert.equal(c.mLblUp('cust','รอลูกค้าอนุมัติแบบ'),'รอลูกค้าอนุมัติแบบ');assert.equal(c.mLblUp('recv','x'),'x');
 assert.match(html,/SUBST\[k\]=\{t:mLblUp\(k,/)});
