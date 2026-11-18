// v16.75 พักงานไว้: ขั้นตอนเดิมอยู่ · หยุดนับวันค้าง · ถึงวันตามแล้วเตือน
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const seg=html.slice(html.indexOf("var HOLD_IC="),html.indexOf('async function mSetHold('));
function ctx(today){const c={mT:x=>Date.parse(x||0)||0,Date:class extends Date{static now(){return Date.parse(today+'T03:00:00Z')}}};vm.createContext(c);vm.runInContext(seg,c);return c}
test('พักอยู่เมื่อแถวพักใหม่กว่าการเปลี่ยนขั้นตอนครั้งล่าสุด',()=>{const c=ctx('2026-11-19');
 const x={sub:'cust',at:'2026-11-01T00:00:00Z'};
 const h=c.mHoldOf({hold:{hold:1,why:'delay',note:'เลื่อน',until:'2026-11-26',at:'2026-11-10T00:00:00Z',by:'A'},holdN:2},x);
 assert.equal(h.why,'delay');assert.equal(h.due,false);assert.equal(h.left,7);assert.equal(h.n,2);
 assert.equal(c.mHoldOf({hold:{hold:1,until:'2026-11-26',at:'2026-10-01T00:00:00Z'}},x),null,'เปลี่ยนขั้นตอนหลังพัก = เลิกพัก');
 assert.equal(c.mHoldOf({hold:null},x),null);
 assert.equal(c.mHoldOf({hold:{hold:1,until:'2026-11-19',at:'2026-11-10T00:00:00Z'}},x).due,true,'ถึงวันตาม');
 assert.equal(c.mHoldWhy('budget'),'รองบประมาณ / PO');assert.equal(c.mHoldWhy('zzz'),'อื่น ๆ')});
test('ระหว่างพักไม่นับค้างเกินกำหนด + แถวพักแยกจากแถวขั้นตอน',()=>{
 assert.match(html,/let held=typeof mHoldOf==="function"\?mHoldOf\(p,x\):null;return\{\.\.\.x,m,days,over:!held&&warn>0&&days>=warn,held\}/);
 assert.match(html,/else if\(pl\.hold!==undefined\)\(holdlog\[-pid\]/);assert.match(html,/hold:t\.hold\|\|null,holdN:t\.holdN\|\|0/);
 assert.match(html,/if\(act==="phold"\)return J\(await mSetHold\(b\.projectId,b\)\)/);
 assert.match(html,/o\("hold:on","พักงานไว้ · รอลูกค้า \/ เลื่อน ฯลฯ…"\)/);assert.match(html,/function mentHolds\(\)/);assert.match(html,/tile\("t-hd"/)});
