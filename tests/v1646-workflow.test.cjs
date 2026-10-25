// v16.46 ตั้งค่า Workflow: ขั้นตอนที่แก้ได้ + กฎอัตโนมัติ (ข้อมูลสมมติทั้งหมด ไม่เรียก Microsoft 365 จริง)
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(a,b){let i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j)}
const line=re=>{let m=html.match(re);assert.ok(m,re);return m[0]};
class PvErr extends Error{constructor(m,s){super(m);this.status=s}}
const DAY=864e5,NOW=Date.parse('2026-10-23T10:00:00+07:00'),iso=d=>new Date(NOW-d*DAY).toISOString();
function setup(settings={}){
 const calls={posts:[],tracks:[],subs:[],logs:[],toasts:[]};
 const c={console,Math,JSON,Number,String,Array,Object,Set,Map,Promise,RegExp,PvErr,calls,
  Date:class extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}},
  M:{role:'admin',profile:{name:'ผู้ดูแลทดสอบ',email:'admin@example.invalid'},tl:'trk',sid:'site',cache:{settings,track:{}},alog:{}},
  CFG:{engineers:{'ENG A':'enga@example.invalid'}},Hd:['ENG A','ENG B'],
  mT:x=>x?Date.parse(x):0,pvNow:()=>new Date(NOW).toISOString(),pvUid:()=>'u'+Math.random().toString(36).slice(2,7),mEsc:x=>String(x??''),
  mEngName:n=>/eng a/i.test(n)?'ENG A':/eng b/i.test(n)?'ENG B':'',mToast:m=>calls.toasts.push(m),mNeedConsent:()=>false,
  wsUi:()=>({status:{cards:{}}}),
  mApprovedAt:p=>p.approvedAt||p.createdAt,
  mChanPost:async(t,ch,h,r,m)=>{calls.posts.push({t,ch,h,m})},
  mSaveTrack:async(p,acts)=>{calls.tracks.push({p,acts});let id=Number(p.listItemId);c.M.cache.track[id]={...(c.M.cache.track[id]||{}),wfDone:p.wfDone||c.M.cache.track[id]?.wfDone,engineer:p.engineer}},
  mSetSub:async(pid,k,o)=>{calls.subs.push({pid,k,o})},
  G:async(url,o)=>{if(o?.method==='POST'){calls.logs.push(JSON.parse(o.json.fields.Payload));return{id:'x'}}if(url.includes('/members'))return{value:[{displayName:'Sales One',email:'sales1@example.invalid',userId:'u-s1'},{displayName:'ENG A',email:'enga@example.invalid',userId:'u-ea'}]};throw Error('no '+url)},
  mHttp:async()=>({id:'draft'}),M_GRAPH:'https://graph.invalid',mState:null,mLoad:async()=>{},mWorkspaceAdmin:()=>true,mSaveSettings:async s=>{c.M.cache.settings=s},DV:{},dvRender:()=>{},mPvLock:async()=>()=>{}};
 vm.createContext(c);
 for(let re of [/^var PSTAT=\{active.*?\};$/m,/^var SUBST=\{recv.*?\};$/m,/^var SUBORD=\[.*?\];$/m,/^var STEPCOL=\{.*?\};$/m,/^function mCardName\(k\)\{let c=wsUi.*?\}$/m,/^var mPStatName=s=>.*?;$/m])vm.runInContext(line(re),c);
 vm.runInContext(between('function mPStat(p){','function mCmd(t)'),c);
 vm.runInContext(between('function mSub(t){','/* v16.17 Power Automate'),c);
 vm.runInContext(between('function mSubOf(p){','async function mSetSub('),c);
 vm.runInContext(between('/* ===== v16.46 ตั้งค่า Workflow','var WFD=null;'),c);
 vm.runInContext(between('function wsDefaultStatus(){','function wsDefaultUi(){'),c);
 c.wsText=(v)=>String(v);
 c.mWfApply(settings);return c}
const proj=(id,o={})=>({id:'sp-'+id,listItemId:String(id),code:'T'+id,name:'งาน '+id,client:'ลูกค้า',accountId:'acc-sales1@example.invalid',listApproval:'approved',createdAt:iso(30),teamId:'tm',channelId:'ch'+id,serviceRequest:{brands:['CommScope'],workTypes:['ออกแบบ'],urgency:'ด่วน'},...o});

test('ไม่มี settings.workflow = ค่าเดิมทุกอย่าง (SUBST/SUBORD/แฮชแท็กเดิม)',()=>{let c=setup();assert.equal(c.WF_ON,false);assert.deepEqual([...c.SUBORD],['recv','design','buy','sup','price','quote','cust','sales']);assert.equal(c.mSub('#รอราคา ครับ'),'price');assert.equal(c.mSub('#ทำBOM'),'design')});

test('แก้ชื่อ/เรียง/เพิ่มขั้นตอน + แฮชแท็กใหม่ + ลบขั้นตอนแล้วข้อมูลเก่ายังอ่านได้',()=>{
 let c=setup({workflow:{steps:[{k:'recv',t:'รับงาน',who:'เรา',z:'E',warn:0},{k:'price',t:'รอราคา (ใหม่)',tag:'#รอราคา',who:'Supplier',z:'V',warn:5,color:'#FF8000'},{k:'s1',t:'รอทดสอบ',tag:'#รอทดสอบ',who:'ลูกค้า',z:'C',warn:3,color:'#00B259'}],rules:[]}});
 assert.equal(c.WF_ON,true);assert.deepEqual([...c.SUBORD],['recv','price','s1']);assert.equal(c.SUBST.price.t,'รอราคา (ใหม่)');assert.equal(c.STEPCOL.s1,'#00B259');
 assert.equal(c.mSub('ตอนนี้ #รอทดสอบ'),'s1');assert.equal(c.mSub('#รอลูกค้า'),'',  'ขั้นตอนที่ลบแล้วไม่รับแฮชแท็ก');
 assert.ok(c.SUBST.cust&&c.SUBST.cust.hidden,'key เดิมยังอยู่');
 let p=proj(1,{pstat:{s:'active',at:iso(20)},sub:{sub:'cust',at:iso(4)}}),sb=c.mSubOf(p);assert.equal(sb.sub,'recv');assert.equal(sb.was,'cust');
 let q=proj(2,{pstat:{s:'active',at:iso(20)},sub:{sub:'price',at:iso(6)}});assert.equal(c.mSubOf(q).over,true,'warn 5 วันจาก workflow');
 let st=c.wsValidateStatus({activeOrder:['recv','design','buy','sup','price','sales','quote','cust'],cards:{cust:{label:'x'},price:{label:'ทับ'}}});assert.deepEqual([...st.activeOrder],['recv','price','s1']);assert.equal(st.cards.price.label,'รอราคา (ใหม่)');
});

test('ทดลองกฎ (plan) ไม่ทำจริง · เงื่อนไขเซลส์/Brand · ค้างเกิน N วัน',async()=>{
 let rules=[{id:'r1',name:'ค้างราคา',on:true,since:iso(1),trigger:{type:'stuck',step:'price',days:7},cond:{brand:'commscope'},actions:[{type:'teams',mention:'sales',text:'{code} ค้าง {days} วัน ที่ {step}'}]},
  {id:'r2',name:'อนุมัติ',on:true,since:iso(1),trigger:{type:'approved'},cond:{sales:'acc-other@example.invalid'},actions:[{type:'notify',text:'x'}]}];
 let c=setup({workflow:{rules}}),ps=[proj(1,{pstat:{s:'active',at:iso(20)},sub:{sub:'price',at:iso(9)}}),proj(2,{pstat:{s:'active',at:iso(20)},sub:{sub:'price',at:iso(3)}}),proj(3,{pstat:{s:'active',at:iso(20)},sub:{sub:'price',at:iso(9)},serviceRequest:{brands:['Other']}}),proj(4,{approvedAt:iso(0.1)})];
 let plan=c.mWfPlan({projects:ps,accounts:[]},c.mWfRules());assert.equal(plan.map(x=>x.p.code).join(),'T1');assert.equal(plan[0].v.days,'9');
 assert.match(c.mWfActText(rules[0].actions[0],plan[0].v),/T1 ค้าง 9 วัน ที่ รอราคา/);assert.equal(c.calls.posts.length,0);
});

test('กฎทำงานจริง: โพสต์ Teams พร้อมแท็กเซลส์ + ตั้งขั้นตอน + มอบหมาย + บันทึกประวัติ + ไม่ทำซ้ำ',async()=>{
 let rules=[{id:'r1',name:'อนุมัติแล้ว',on:true,since:iso(1),trigger:{type:'approved'},cond:{},actions:[{type:'teams',mention:'both',title:'อนุมัติ',text:'งาน {code} ของ {client}'},{type:'sub',step:'design'},{type:'assign',eng:'ENG B'},{type:'mail',to:'sales',subject:'แจ้ง {code}',text:'สวัสดี'}]},
  {id:'r2',name:'ปิด',on:false,since:iso(1),trigger:{type:'approved'},actions:[{type:'notify',text:'x'}]}];
 let c=setup({workflow:{rules}}),p=proj(5,{approvedAt:iso(0.2),engineer:'ENG A',pstat:{s:'active',at:iso(0.2)}}),old=proj(6,{approvedAt:iso(5)});
 c.mState=async()=>({projects:[p,old],accounts:[{id:p.accountId,name:'Sales One'}]});
 let log=await c.mWfRun();assert.equal(log.length,1);assert.equal(log[0].code,'T5');
 assert.equal(c.calls.posts.length,1);assert.equal(c.calls.posts[0].m.length,2);assert.match(c.calls.posts[0].h,/<at id="0">Sales One<\/at>/);assert.match(c.calls.posts[0].h,/งาน T5 ของ ลูกค้า/);
 assert.equal(c.calls.subs[0].k,'design');assert.ok(c.calls.tracks.some(t=>t.p.engineer==='ENG B'));assert.equal(c.calls.logs.length,1);assert.equal(c.calls.logs[0].runs[0].res.length,4);
 assert.ok(c.M.cache.track[5].wfDone['r1|ap:'+iso(0.2)],'จดว่าทำแล้ว');
 let again=await c.mWfRun();assert.equal(again.length,0,'ไม่ทำซ้ำ');assert.equal(c.calls.posts.length,1);
});

test('บันทึก Workflow ตรวจค่าผิด (ไม่มี recv / แฮชแท็กซ้ำ / กฎไม่มีการกระทำ)',async()=>{
 let c=setup();
 await assert.rejects(c.mWfSave({steps:[{k:'price',t:'x'}],rules:[]}),/recv/);
 await assert.rejects(c.mWfSave({steps:[{k:'recv',t:'a'},{k:'a1',t:'b',tag:'#x1'},{k:'a2',t:'c',tag:'#X1'}],rules:[]}),/ซ้ำ/);
 await assert.rejects(c.mWfSave({steps:[{k:'recv',t:'a'}],rules:[{name:'n',trigger:{type:'new'},actions:[]}]}),/การกระทำ/);
 let w=await c.mWfSave({steps:[{k:'recv',t:'a'},{k:'z9',t:'ใหม่',tag:'#ใหม่'}],rules:[]});assert.equal(w.v,1);assert.equal(c.SUBORD.length,2);
});

test('keep ของ mSaveTrack มี wfDone · หน้า workflow เฉพาะ Admin · กฎทำงานต่อจาก mStatusAuto',()=>{
 assert.ok(html.includes('"importSource","channelArchive","wfDone"]'));assert.ok(html.includes("if(key==='workflow')return role==='admin'&&mWorkspaceAdmin();"));assert.ok(html.includes('try{await mWfAuto()}catch(e){console.warn(e)}'));assert.ok(html.includes('if(page==="workflow"){await dvWorkflowPage(host,id);return}'));
});
