// v16.34 ทดสอบเอกสารสำหรับแชร์ด้วยข้อมูลสมมติ ไม่มีการส่งข้อความหรือเรียก API จริง
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('var qtN='),html.indexOf('window.dvQtPdf='));
function setup(){
 const quote={id:'7',no:'QX2610-001',date:'2026-10-20',cust:{name:'Test Customer',email:'customer@example.invalid'},items:[{code:'DEMO',desc:'สินค้าตัวอย่าง',qty:1,price:123456.78,disc:0,cost:98765.43}],vat:7,status:'ร่าง',quotedBy:'Test Engineer'};
 const c={console,Set,JSON,Date,Math,Number,String,Array,Blob,QT:{items:[quote]},QT_REMARK:'หมายเหตุสำหรับลูกค้า',QT_CONFIRM:'ยืนยันสั่งซื้อ',deliveries:[],renders:[],toasts:[],allowed:true};c.window=c;
 c.mCanQuote=()=>c.allowed;c.qtFind=id=>c.allowed&&c.QT.items.find(q=>q.id===id);c.mToast=(message,error)=>c.toasts.push({message,error});c.mEsc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 c.qtCo=()=>({name:'Test Company',addr:'Test Address',tel:'000',taxId:'000'});c.qtLayout=o=>({mt:8,ms:8,mb:8,scale:100,logo:25,sig:12,bottom:true,...o});c.dvTH2=s=>s;c.dvToday=()=> '2026-10-20';
 c.dvDocPdf=async markup=>{c.renders.push(markup);return new Blob(['%PDF-1.4\nmock customer document'],{type:'application/pdf'})};c.dvPdfDeliver=(...args)=>c.deliveries.push(args);vm.createContext(c);vm.runInContext(source,c);return c;
}
test('เอกสารแชร์ใช้ PDF ลูกค้าเท่านั้น ไม่มีต้นทุนหรือกำไร',async()=>{
 const c=setup();await c.dvQtShare('7');const markup=c.renders[0];assert.match(markup,/123,456.78/);assert.doesNotMatch(markup,/98,765.43|98765.43|ต้นทุน|กำไร|costT|margin/);assert.equal(c.deliveries.length,1);assert.equal(c.deliveries[0][0].type,'application/pdf');assert.equal(c.deliveries[0][1],'QX2610-001_Test Customer.pdf');assert.equal(c.deliveries[0][2],false);assert.equal(c.deliveries[0][3],true);assert.equal(c.QT.items[0].status,'ร่าง');
});
test('แชร์ด้วยรูปแบบกระดาษปัจจุบันในหน้าดูเอกสาร',async()=>{
 const c=setup();await c.dvQtShare('7',{ms:11,mt:12,scale:90});assert.match(c.renders[0],/--qms:11mm/);assert.match(c.renders[0],/--qmt:12mm/);assert.match(c.renders[0],/--qs:0.9/);
});
test('กดซ้ำระหว่างสร้าง PDF ไม่สร้างงานซ้อนและคืนสถานะปุ่ม',async()=>{
 const c=setup();let release;c.dvDocPdf=()=>new Promise(resolve=>release=resolve);const button={textContent:'แชร์',disabled:false},first=c.dvQtShare('7',undefined,button);assert.equal(button.disabled,true);await c.dvQtShare('7');release(new Blob(['PDF']));await first;assert.equal(c.deliveries.length,1);assert.equal(button.disabled,false);assert.equal(button.textContent,'แชร์');
});
test('สร้าง PDF ไม่ผ่านแสดงข้อความ คืนปุ่ม และลองใหม่ได้',async()=>{
 const c=setup(),button={textContent:'แชร์',disabled:false};c.dvDocPdf=async()=>{throw Error('Mock render error')};await c.dvQtShare('7',undefined,button);assert.equal(c.deliveries.length,0);assert.match(c.toasts[0].message,/เตรียมไฟล์สำหรับแชร์ไม่สำเร็จ/);assert.equal(button.disabled,false);assert.equal(c.QT_SHARE.size,0);
});
test('ผู้ที่ยังไม่เข้าสู่ระบบหรือเลขเอกสารที่ไม่พบไม่สร้าง PDF',async()=>{
 const c=setup();c.allowed=false;await c.dvQtShare('7');c.allowed=true;await c.dvQtShare('missing');assert.equal(c.renders.length,0);assert.equal(c.deliveries.length,0);
});
test('ชื่อไฟล์ใช้ข้อมูลขณะกด แม้ข้อมูลในฟอร์มเปลี่ยนระหว่างสร้าง PDF',async()=>{
 const c=setup();let release;c.dvDocPdf=()=>new Promise(resolve=>release=resolve);const task=c.dvQtShare('7');c.QT.items[0].cust.name='Changed later';release(new Blob(['PDF']));await task;assert.equal(c.deliveries[0][1],'QX2610-001_Test Customer.pdf');
});
test('มีปุ่มทั้งตาราง/หน้าดู ใช้โหมดแชร์และมีทางดาวน์โหลดเมื่อไม่รองรับ',()=>{
 assert.ok(html.includes('onclick="dvQtShare(this.dataset.id,undefined,this)"'));assert.ok(html.includes('data-a="share">แชร์</button>'));assert.ok(html.includes('dvQtShare(id,d._ly,ev.currentTarget)'));assert.ok(html.includes('if(!touch&&!forPrint&&!forShare)'));assert.ok(html.includes('navigator.share&&navigator.canShare'));assert.ok(html.includes('เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์โดยตรง'));
});
