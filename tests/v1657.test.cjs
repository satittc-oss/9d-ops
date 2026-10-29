// v16.57 ข้อมูลสมมติทั้งหมด: เปิดอีเมลล่าสุดของโครงการ (ค้นด้วย Project Code) + ไอคอนแอ็กชันในทะเบียน + คู่มือ flow แจ้งเตือนผู้อนุมัติ
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(a,b){let i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j)}
class PvErr extends Error{constructor(m,s){super(m);this.status=s}}
function mailCtx(httpImpl){let toasts=[],opened=[],consent=[],win={open:(u)=>{let w={location:{href:""},document:{write(){}},close(){w.closed=!0}};opened.push(w);if(u&&u!=="about:blank")w.location.href=u;return w}};
 let c={console,Date,Promise,JSON,Number,String,Array,Object,encodeURIComponent,PvErr,M_GRAPH:'https://graph.microsoft.com/v1.0',window:win,
  mHttp:httpImpl,mToast:(m,e)=>toasts.push({m,e:!!e}),mConsentGo:async k=>consent.push(k),mNeedConsent:e=>e&&e.status===403};
 c.window=Object.assign(win,c);vm.createContext(c);vm.runInContext(between('window.dvMailForCode=async','/* v16.37 ส่ง Archive'),c);
 return{c,toasts,opened,consent,win}}

test('เปิดอีเมลล่าสุด: เลือกฉบับ receivedDateTime ใหม่สุดและเปิด webLink',async()=>{
 let seen;let{c,toasts,opened}=mailCtx(async(url)=>{seen=url;return{value:[
  {subject:'เก่า',webLink:'https://outlook/old',receivedDateTime:'2026-01-01T00:00:00Z'},
  {subject:'ใหม่',webLink:'https://outlook/new',receivedDateTime:'2026-10-20T00:00:00Z'},
  {subject:'ไม่มีลิงก์',receivedDateTime:'2026-12-01T00:00:00Z'}]}});
 await c.window.dvMailForCode('ASP26060');
 assert.match(seen,/\/me\/messages\?\$search=/);
 assert.match(seen,/%22ASP26060%22/);// ค้นแบบมี double-quote ครอบ
 assert.equal(opened[0].location.href,'https://outlook/new');
 assert.ok(toasts.some(t=>/เปิดอีเมลล่าสุดของ ASP26060/.test(t.m)));
});
test('ไม่พบอีเมล: แจ้งเตือนและปิดหน้าต่างที่เปิดไว้',async()=>{
 let{c,toasts,opened}=mailCtx(async()=>({value:[]}));
 await c.window.dvMailForCode('XYZ99999');
 assert.ok(opened[0].closed,'ต้องปิดหน้าต่าง about:blank');
 assert.ok(toasts.some(t=>t.e&&/ไม่พบอีเมล/.test(t.m)));
});
test('ยังไม่ได้ให้สิทธิ์ (403): พาไปขอ consent outlook ไม่ล้ม',async()=>{
 let{c,consent,toasts}=mailCtx(async()=>{throw new PvErr('forbidden',403)});
 await c.window.dvMailForCode('ASP26060');
 assert.deepEqual(consent,['outlook']);
 assert.ok(toasts.some(t=>/สิทธิ์อ่าน Outlook/.test(t.m)));
});
test('code ว่าง: ไม่เรียก mHttp',async()=>{
 let called=0;let{c}=mailCtx(async()=>{called++;return{value:[]}});
 await c.window.dvMailForCode('   ');
 assert.equal(called,0);
});

test('ทะเบียนใช้ไอคอนแอ็กชัน (dv-ico) + ปุ่มเมล ✉ เรียก dvMailForCode',()=>{
 assert.ok(html.includes('class="dv-ico"'));
 assert.ok(html.includes('onclick="dvMailForCode('));
 assert.ok(html.includes('<style id="v1657">'));
 assert.ok(html.includes('#dashv .dv-pregt td.lk .dv-ico'));
});
test('มีคู่มือ flow แจ้งเตือนผู้อนุมัติ และลิงก์ในหน้า Admin',()=>{
 assert.ok(fs.existsSync(path.join(__dirname,'../docs/APPROVAL-EMAIL-FLOW.md')),'ต้องมีไฟล์คู่มือ');
 assert.ok(html.includes('docs/APPROVAL-EMAIL-FLOW.md'),'ต้องลิงก์คู่มือในเว็บ');
});
