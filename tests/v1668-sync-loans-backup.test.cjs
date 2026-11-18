// v16.68 อ่านแล้วตรงกันทุกเครื่อง · เช็กห้องที่มีความเคลื่อนไหว · ใบยืมใกล้ครบกำหนด · สำรองข้อมูล · ธีม (ข้อมูลสมมติ)
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const part=html.slice(html.indexOf('/* ===== v16.67 แจ้งเตือนเมื่อมีคนแท็กเรา'),html.indexOf('var mUiFrame=0;function mUiSchedule('));
const now=Date.parse('2026-11-15T05:00:00Z'),day=ms=>new Date(now+252e5+ms).toISOString().slice(0,10);
function ctx(){const ls={},cls=new Set();const c={console,Object,JSON,Set,String,Math,Number,Promise,Blob:class{constructor(a){this.a=a}},
 Date:class extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}},
 localStorage:{getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=v}},document:{hidden:false,addEventListener(){},querySelectorAll:()=>[],getElementById:()=>null,head:{appendChild(){}},createElement:()=>({}),documentElement:{classList:{toggle:(k,on)=>on?cls.add(k):cls.delete(k)}}},
 setTimeout:()=>0,clearTimeout(){},M:{profile:{oid:'me',email:'me@x.invalid',name:'Somchai K.'}},TS:{all:[]},LOAN:{},
 mT:v=>Date.parse(v||0)||0,mToast(){},mEsc:s=>String(s),dvAgo:()=>'',dvToday:()=>day(0),mNorm:s=>String(s||'').toLowerCase().replace(/[\s.]/g,'')};
 c.window=c;vm.createContext(c);vm.runInContext(part,c);c.ls=ls;c.cls=cls;return c}
test('รวมสถานะอ่านแล้วจากเครื่องอื่น (เก็บค่าที่ใหม่กว่า)',()=>{const c=ctx();c.MENT.seen={a:now-5};c.M.mseen={seen:{a:now-30,b:now-9},init:7,row:'r1'};c.mentMerge();
 assert.equal(c.MENT.seen.a,now-5);assert.equal(c.MENT.seen.b,now-9);assert.equal(c.MENT.init,7);assert.match(c.ls['9d-ment'],/"b":/)});
test('ส่งสถานะอ่านแล้วขึ้น 9D Project Tracking แบบรวมกับของเดิม',async()=>{const c=ctx(),calls=[];c.M.tl='T';c.M.sid='S';c.M.mseen={row:'42'};c.MENT.seen={x:now-1e3};
 c.G=async(u,o)=>{calls.push([u,o?.method||'GET']);if(!o)return{fields:{Payload:JSON.stringify({seen:{y:now-2e3},init:1})}};return{}};
 await c.mentPush();assert.deepEqual(calls.map(x=>x[1]).join(),'GET,PATCH');assert.equal(c.M.mseen.row,'42');assert.ok(c.MENT.seen.y&&c.MENT.seen.x)});
test('ไม่มีสิทธิ์เขียน → หยุดซิงค์ (ใช้ในเครื่องต่อไป)',async()=>{const c=ctx();c.M.tl='T';c.M.sid='S';c.G=async(u,o)=>{if(o){let e=new Error('x');e.status=403;throw e}return{}};
 await assert.rejects(c.mentPush());assert.equal(c.MENT.noSync,1);await c.mentPush()});
test('เช็กเร็ว: เลือกเฉพาะห้องที่มีข้อความใน 14 วัน สูงสุด 20 ห้อง เรียงล่าสุดก่อน',()=>{const c=ctx(),iso=d=>new Date(now-d*864e5).toISOString();
 const all=[...Array(30)].map((_,i)=>({channelId:'c'+i,teamId:'t',sig:'s',last:iso(i)}));all.push({channelId:'e',teamId:'t',sig:'s',last:iso(1),error:'x'});
 const h=c.mentHotList(all,now);assert.equal(h.length,14);assert.equal(h[0].channelId,'c0');assert.ok(!h.some(x=>x.channelId==='e'))});
test('ใบยืมของฉันที่ใกล้ (≤2 วัน) / เกินกำหนดคืน',()=>{const c=ctx();const Ls=[{id:'1',no:'LN26001',engineer:'Somchai K',dueDate:day(-3*864e5),status:'ยืมอยู่',items:[]},{id:'2',no:'LN26002',engineer:'somchai k.',dueDate:day(2*864e5),status:'คืนบางส่วน',items:[]},{id:'3',no:'LN26003',engineer:'Somchai K.',dueDate:day(5*864e5),status:'ยืมอยู่',items:[]},{id:'4',no:'LN26004',engineer:'Other',dueDate:day(-1*864e5),status:'ยืมอยู่',items:[]},{id:'5',no:'LN26005',engineer:'Somchai K.',dueDate:day(-9*864e5),status:'คืนครบ',items:[]}];
 assert.equal(c.mentMyLoans(Ls).map(L=>L.no).join(),'LN26001,LN26002');assert.equal(c.mentLoanTxt(Ls[0]),'เกินกำหนดคืน 3 วัน');assert.equal(c.mentLoanTxt(Ls[1]),'ครบกำหนดคืนใน 2 วัน')});
test('สำรองข้อมูล: ชื่อสัปดาห์ ISO และเลือกเฉพาะ List ของระบบ',()=>{const c=ctx();assert.equal(c.mBkWeek(Date.parse('2026-11-15T05:00:00Z')),'2026-W46');assert.equal(c.mBkWeek(Date.parse('2027-01-01T03:00:00Z')),'2026-W53');
 const L=[{id:'a',displayName:'KendoProject',list:{template:'genericList'}},{id:'b',displayName:'9D Project Tracking',list:{template:'genericList'}},{id:'c',displayName:'9D Hidden',list:{hidden:true,template:'genericList'}},{id:'d',displayName:'Documents',list:{template:'documentLibrary'}},{id:'e',displayName:'9D Demo Loans',list:{template:'genericList'}}];
 assert.equal(c.mBkPick(L,['a']).map(x=>x.id).join(),'a,b,e')});
test('v16.72 เลิกใช้ธีมพาสเทล (ไม่มีปุ่มสลับธีม)',()=>{const h=fs.readFileSync(__dirname+'/../index.html','utf8');assert.ok(!/th-pastel|mThemeToggle|th-tgl/.test(h));assert.match(h,/localStorage\.removeItem\("9d-theme"\)/)});
test('สต็อก: แสดงกำหนดคืน + ปุ่มสร้างใบยืมจากสินค้า',()=>{const s=html.slice(html.indexOf('var stkDue='),html.indexOf('\n',html.indexOf('var stkDue=')));const c={dvToday:()=>'2026-11-15',dvTH:d=>d};vm.createContext(c);vm.runInContext(s.replace('var stkDue','this.stkDue'),c);
 assert.equal(c.stkDue({no:'LN1',dueDate:'2026-11-13'}).cls,'no');assert.match(c.stkDue({no:'LN1',dueDate:'2026-11-13'}).txt,/เกินกำหนดคืน 2 วัน/);assert.equal(c.stkDue({no:'LN1',dueDate:'2026-11-17'}).cls,'dlv');assert.equal(c.stkDue({no:'LN1',dueDate:'2026-12-17'}).cls,'cur');
 assert.match(html,/data-a="loan">สร้างใบยืมจากสินค้านี้/);assert.match(html,/window\.dvLoanForm=\(id,pre\)=>/)});
