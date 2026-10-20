// v16.35 Flow 3D: ทดสอบสถานะ สิทธิ์ และข้อความระหว่าง iframe ด้วยข้อมูลสมมติเท่านั้น
const{test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../flow3d-data.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const block=html.slice(html.indexOf('/* v16.35 Flow งาน 3D แยกจากเมืองจำลอง'),html.indexOf('/* ---- หน้า สถานะโครงการ ---- */'));
const row=(state,stepKey='recv',extra={})=>({id:'sp-1',code:'TEST-001',name:'งานตัวอย่าง',client:'ลูกค้าตัวอย่าง',state,stepKey,...extra});
test('จัดสถานะและขั้นตอนเข้าจุดงาน โดยคงความต่างระหว่างส่งงานกับปิดงาน',()=>{
 for(const[state,stepKey,expected]of[['pending','recv','request'],['active','recv','engineer'],['active','design','engineer'],['active','sup','supplier'],['active','price','supplier'],['active','buy','purchase'],['active','sales','sales'],['active','cust','customer'],['active','quote','customer'],['delivered','recv','customer'],['won','recv','closed'],['lost','recv','closed'],['cancelled','recv','closed'],['rejected','recv','closed']]){
  const j=D.normalize({jobs:[row(state,stepKey)]}).jobs[0];assert.equal(j.stage,expected);assert.equal(j.state,state);
 }
});
test('ใช้เกณฑ์เตือนของขั้นตอน ไม่คิดระยะเวลาที่ไม่มีหลักฐาน และไม่นับงานปิดว่าค้าง',()=>{
 const jobs=D.normalize({jobs:[row('active','design',{days:3,warn:3}),row('active','price',{id:'sp-2',days:null,warn:7}),row('active','recv',{id:'sp-3',days:500,warn:0}),row('won','design',{id:'sp-4',days:50,warn:3}),row('active','sup',{id:'sp-5',days:6,warn:7})]}).jobs;
 assert.deepEqual(jobs.map(j=>j.over),[true,false,false,false,false]);assert.equal(jobs[1].days,null);assert.equal(D.summary(jobs).over,1);
});
test('กรองหลายเงื่อนไขร่วมกัน และค้นหางานที่ยังไม่ระบุผู้รับผิดชอบ',()=>{
 const jobs=D.normalize({jobs:[row('active','design',{code:'ABC-01',engineer:'วิศวกร ก.',days:4,warn:3}),row('active','price',{id:'sp-2',code:'ABC-02'}),row('won','recv',{id:'sp-3',code:'ABC-03',engineer:'วิศวกร ก.'}),row('pending','recv',{id:'sp-4',code:'DEF-01'})]}).jobs;
 assert.equal(D.filter(jobs).length,3);assert.equal(D.filter(jobs,{mode:'closed'}).length,1);assert.equal(D.filter(jobs,{mode:'over',q:'abc',engineer:'วิศวกร ก.'})[0].id,'sp-1');assert.equal(D.filter(jobs,{mode:'all',engineer:'__none'}).length,2);
});
test('ตัดข้อมูลซ้ำ/รหัสผิด/สถานะไม่รู้จัก และไม่คัดลอก token หรือลิงก์ที่ผู้ส่งแทรกมา',()=>{
 const a=row('active','design',{token:'PRIVATE_TOKEN',channelUrl:'javascript:alert(1)',days:NaN}),r=D.normalize({jobs:[a,a,{id:'other',state:'active'},row('unknown','recv',{id:'sp-2'}),null]});
 assert.equal(r.jobs.length,1);assert.equal(r.jobs[0].days,null);assert.ok(!JSON.stringify(r).includes('PRIVATE_TOKEN'));assert.ok(!JSON.stringify(r).includes('javascript:'));assert.throws(()=>D.normalize({jobs:null}));
});
test('ตัวเลขนับครบแม้มีมากกว่า 12 งานต่อขั้นตอน และจัดงานค้าง/ด่วนไว้ต้นรายการ',()=>{
 const jobs=D.normalize({jobs:Array.from({length:70},(_,i)=>row('active','design',{id:'sp-'+(i+1),code:'T'+i,days:i===60?6:1,warn:3,priority:i===50?'urgent':'normal'}))}).jobs;
 assert.equal(D.summary(jobs).total,70);assert.equal(D.filter(jobs).length,70);assert.equal(D.sort(jobs)[0].id,'sp-61');assert.equal(D.sort(jobs)[1].id,'sp-51');
});
function setup(role='engineer'){
 const listeners=[],messages=[],opened=[],frame={contentWindow:{postMessage:(data,origin)=>messages.push({data,origin})},remove(){c.frame=null}};
 const c={Date,Math,Number,String,Object,Array,console:{warn(){}},setInterval:()=>7,clearInterval:()=>{},setTimeout,clearTimeout,dvNavIcon:{},DV:{page:'flow3d'},M:{profile:{email:'user@example.invalid',name:'ผู้ใช้สมมติ'},role,cacheAt:123},frame,
  location:{origin:'https://app.example.invalid'},document:{querySelector:()=>c.frame,body:{classList:{remove(){}}}},messages,opened};
 c.window={addEventListener:(name,fn)=>listeners.push(fn)};
 c.st={accounts:[{id:'acc-user@example.invalid',name:'ฝ่ายขาย ก.'},{id:'acc-other@example.invalid',name:'ฝ่ายขาย ข.'}],projects:[
  {id:'sp-1',code:'TEST-001',name:'งานที่เข้าถึงได้',accountId:'acc-user@example.invalid',listApproval:'approved',pstat:{s:'active'},createdAt:'2026-01-01',updatedAt:'2026-01-02',engineer:'วิศวกร ก.',nextAction:'ตรวจแบบ'},
  {id:'sp-2',code:'OTHER-001',name:'งานอื่น',accountId:'acc-other@example.invalid',listApproval:'approved',pstat:{s:'won'}},
  {id:'p-draft',code:'DRAFT',accountId:'acc-user@example.invalid',listApproval:'pending'}]};
 c.dvState=async()=>c.st;c.mPStat=p=>p.listApproval==='pending'?'pending':p.pstat?.s||'active';c.mSubOf=()=>({sub:'design',at:'2026-01-01T00:00:00Z',m:{warn:3,who:'เรา'}});c.mT=v=>Date.parse(v)||0;c.dvGo=page=>opened.push(page);c.mToast=()=>{};c.dvSig=()=>'';
 vm.createContext(c);vm.runInContext(block,c);c.onMessage=listeners[0];return c;
}
test('snapshot เซลส์และ viewer เห็นเฉพาะงานตัวเอง แม้ upstream ส่งงานคนอื่นมาด้วย',async()=>{
 for(const role of['sales','viewer']){const c=setup(role),r=await c.dvFlowSnap();assert.equal(r.scope,'own');assert.deepEqual(Array.from(r.jobs,j=>j.id),['sp-1']);assert.ok(!JSON.stringify(r).includes('OTHER-001'));assert.ok(!JSON.stringify(r).includes('user@example.invalid'))}
 const c=setup();assert.equal((await c.dvFlowSnap()).jobs.length,2);
});
test('งาน draft ที่บันทึกบน List แสดงรออนุมัติ ส่วน draft ในเครื่องไม่ส่งเข้า iframe',async()=>{
 const c=setup();c.st.projects[0].listApproval='draft';const r=await c.dvFlowSnap();assert.equal(r.jobs[0].state,'pending');assert.equal(r.jobs.length,2);
});
test('ไม่ส่ง snapshot หากยังไม่ได้ล็อกอิน',async()=>{
 const c=setup();c.M.profile=null;await assert.rejects(c.dvFlowSnap(),/เข้าสู่ระบบ/);
});
test('ข้อความผิด origin/source/version ไม่เปิดงานหรือรีเฟรช และเปิดได้เฉพาะงานตามสิทธิ์',async()=>{
 const c=setup('sales'),valid={origin:c.location.origin,source:c.frame.contentWindow,data:{t:'9d-flow-open',v:1,id:'sp-1'}};
 await c.onMessage({...valid,origin:'https://other.example.invalid'});await c.onMessage({...valid,source:{}});await c.onMessage({...valid,data:{...valid.data,v:2}});await c.onMessage({...valid,data:{...valid.data,id:'sp-2'}});assert.equal(c.opened.length,0);
 await c.onMessage(valid);assert.equal(c.opened[0],'projects');assert.equal(c.DV.pq,'TEST-001');
});
test('ส่งข้อมูลเฉพาะ iframe ปัจจุบัน และคำตอบที่มาช้าหลังเปลี่ยนหน้าไม่หลุดไปหน้าใหม่',async()=>{
 const c=setup();let resolve;c.dvState=()=>new Promise(r=>resolve=r);const pending=c.dvFlowSend();c.DV.page='status';resolve(c.st);await pending;assert.equal(c.messages.length,0);
 c.DV.page='flow3d';c.dvState=async()=>c.st;await c.dvFlowSend();assert.equal(c.messages.length,1);assert.equal(c.messages[0].origin,c.location.origin);assert.equal(c.messages[0].data.t,'9d-flow');
});
test('การเปิดหน้าครั้งใหม่ส่งข้อมูลได้ แม้ snapshot ของ iframe ก่อนหน้ายังไม่เสร็จ',async()=>{
 const c=setup();let resolve;c.dvState=()=>new Promise(r=>resolve=r);const old=c.dvFlowSend();const nextMessages=[];c.frame={contentWindow:{postMessage:d=>nextMessages.push(d)}};c.dvState=async()=>c.st;await c.dvFlowSend();assert.equal(nextMessages.length,1);resolve(c.st);await old;assert.equal(c.messages.length,0);assert.equal(nextMessages.length,1);
});
test('ข้อผิดพลาดโหลดข้อมูลแจ้งสถานะแทนการสร้างข้อมูลตัวอย่าง',async()=>{
 const c=setup();c.dvState=async()=>{throw Error('mock offline')};await c.dvFlowSend();assert.equal(c.messages[0].data.t,'9d-flow-error');assert.ok(!('jobs'in c.messages[0].data));assert.equal(c.DV.flowSending,null);
});
