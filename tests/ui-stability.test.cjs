// v16.36 จำลองการอ่านข้อมูล การสลับหน้า และรายการจำนวนมาก โดยไม่เรียก Microsoft 365
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return html.slice(a,b)}
function context(values,source){const c={console,Date,Promise,Map,Set,JSON,Math,Number,String,Array,Object,...values};c.window=c;vm.createContext(c);vm.runInContext(source,c);return c}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function readSetup(){
 const batches=[],M={sid:'mock-site',lid:'projects',tl:'tracking',cols:{},cache:null,cacheAt:0};
 const data={projects:[{id:'1',fields:{},lastModifiedDateTime:'2026-10-20T00:00:00Z'}],tracking:[]};
 const c=context({M,M_PRES:-9000000000,M_FLOWIX:-9100000000,M_INBOX:-9200000000,mInboxMerge(){},
  gAll(url){const d=deferred(),kind=url.includes('/lists/projects/')?'projects':'tracking',snapshot=structuredClone(data[kind]);batches.push({kind,...d,snapshot});return d.promise.then(()=>snapshot)}
 },between('async function mLoad(force)','var mT='));
 return{c,M,data,batches,release(from=0){batches.slice(from).forEach(d=>d.resolve())}};
}
test('ผู้อ่านพร้อมกัน 20 รายรวมเป็นการอ่านโครงการ/Tracking ชุดเดียว และใช้ cache ต่อได้',async()=>{
 const r=readSetup(),calls=Array.from({length:20},()=>r.c.mLoad());await tick();assert.equal(r.batches.length,2);r.release();
 const results=await Promise.all(calls);assert.ok(results.every(x=>x===results[0]));assert.equal(r.M.loadPending,null);await r.c.mLoad();assert.equal(r.batches.length,2);
});
test('force หลังมีการบันทึกอ่านรอบใหม่ และผู้อ่านที่เข้าระหว่างรอได้ข้อมูลล่าสุด',async()=>{
 const r=readSetup(),first=r.c.mLoad();await tick();r.data.projects[0].fields.Title='หลังบันทึก';const fresh=r.c.mLoad(true),reader=r.c.mLoad();
 assert.equal(r.batches.length,2);r.release();const old=await first;assert.equal(old.items[0].fields.Title,undefined);await tick();assert.equal(r.batches.length,4);
 r.release(2);const [newer,joined]=await Promise.all([fresh,reader]);assert.equal(newer.items[0].fields.Title,'หลังบันทึก');assert.equal(joined,newer);assert.equal(r.M.cache,newer);
});
test('force หลายรอบรักษาลำดับความสดใหม่ แม้มี cache ที่ยังไม่หมดอายุ',async()=>{
 const r=readSetup();r.M.cache={items:[]};r.M.cacheAt=Date.now();const a=r.c.mLoad(true);await tick();r.data.projects[0].fields.Title='รอบใหม่';const b=r.c.mLoad(true),reader=r.c.mLoad();
 r.release();await a;await tick();assert.equal(r.batches.length,4);r.release(2);assert.equal((await b).items[0].fields.Title,'รอบใหม่');assert.equal((await reader).items[0].fields.Title,'รอบใหม่');
});
test('อ่านล้มเหลวไม่ล็อกคิวค้าง และ force ที่รออยู่ยังลองอ่านรอบใหม่ได้',async()=>{
 const r=readSetup(),first=r.c.mLoad(),rejected=assert.rejects(first,/mock offline/);await tick();const next=r.c.mLoad(true);r.batches.find(x=>x.kind==='projects').reject(Error('mock offline'));r.batches.find(x=>x.kind==='tracking').resolve();await rejected;
 await tick();assert.equal(r.batches.length,4);r.release(2);await next;assert.equal(r.M.loadPending,null);
});
test('สถานะหน้าจอแชร์งานอ่าน แต่หมด cache ทันทีเมื่อมีการบันทึกหรือมีชุดข้อมูลใหม่',async()=>{
 const d=deferred(),M={cache:{},cacheAt:Date.now()},DV={stAt:0},c=context({M,DV,calls:0,mState(){c.calls++;return c.calls===1?d.promise:Promise.resolve({n:c.calls})}},between('async function dvState()','function dvEditing()'));
 const a=c.dvState(),b=c.dvState();assert.equal(c.calls,1);d.resolve({n:1});assert.equal(await a,await b);await c.dvState();assert.equal(c.calls,1);M.loadPending=deferred().promise;await c.dvState();assert.equal(c.calls,1);M.loadPending=null;
 M.cacheAt=0;await c.dvState();assert.equal(c.calls,2);M.cache={};M.cacheAt=Date.now();await c.dvState();assert.equal(c.calls,3);
});
test('สถานะหน้าจอที่อ่านไม่ผ่านสามารถลองใหม่ได้',async()=>{
 const c=context({M:{cache:{},cacheAt:Date.now()},DV:{stAt:0},mState:async()=>{throw Error('mock unavailable')}},between('async function dvState()','function dvEditing()'));
 await assert.rejects(c.dvState(),/mock unavailable/);assert.equal(c.DV.stPending,null);c.mState=async()=>({ok:true});assert.equal((await c.dvState()).ok,true);
});
test('การรวมกิจกรรมตามโครงการยังแสดงเฉพาะงานของ Sales/Viewer และครบทุกงานสำหรับ Engineer',async()=>{
 const items=[{id:'1',createdBy:{user:{email:'sales@example.invalid',displayName:'Sales A'}}},{id:'2',createdBy:{user:{email:'other@example.invalid',displayName:'Sales B'}}}],cache={items,settings:{accounts:{},members:[],settings:{}},track:{1:{activities:[{id:'own',createdAt:'2026-10-20'}]},2:{activities:[{id:'other',createdAt:'2026-10-20'}]}}};
 for(const role of ['sales','viewer','engineer']){
  const c=context({M:{profile:{email:'sales@example.invalid',oid:'mock',name:'Sales A'},cacheAt:Date.now()},PV:{projects:[],accounts:[],activities:[]},CFG:{engineers:{}},TS:{channels:{},all:[{pid:'sp-1',name:'Own',recent:[{id:'own-message',at:'2026-10-20'}]},{pid:'sp-2',name:'Other',recent:[{id:'other-message',at:'2026-10-20'}]}]},mLoad:async()=>cache,mRole:()=>role,mProject:it=>({id:'sp-'+it.id,listItemId:it.id,accountId:'acc-'+it.createdBy.user.email,createdAt:'2026-10-20',listApproval:'approved'})},between('async function mState(force)','/* --- Writes --- */'));
  const result=await c.mState();assert.equal(result.projects.length,role==='engineer'?2:1);assert.equal(result.activities.some(a=>a.id==='other'),role==='engineer');assert.equal(result.activities.some(a=>a.id==='tm-other-message'),role==='engineer');assert.ok(result.activities.some(a=>a.id==='own'));
 }
});

function navItem(text,id='',active=false){const attrs={},classes=new Set(active?['active']:[]);return{textContent:text,id,classList:{contains:x=>classes.has(x),toggle(x,on){on?classes.add(x):classes.delete(x)}},getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs,setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k]}}
test('เลือกทะเบียน/สถานะ/ภาพรวม/เมนู React เดิม มี active และ aria-current เพียงจุดเดียว',()=>{
 const items=[navItem('ภาพรวม','',true),navItem('โครงการทั้งหมด'),navItem('รออนุมัติ 8'),navItem('สถานะโครงการ','dvnav-status'),navItem('ใบเสนอราคา','dvnav-quotes')],DV={},c=context({DV},between('function dvPaintNav(','function dvSync('));
 for(const target of [0,1,3,4,0,2,0]){DV.page=target===1?'projects':target===3?'status':target===4?'quotes':null;if(!DV.page){DV.nativeEl=items[target];DV.nativePending=true}c.dvPaintNav(items);DV.nativePending=false;
  assert.deepEqual(items.filter(x=>x.classList.contains('active')),[items[target]]);assert.deepEqual(items.filter(x=>x.getAttribute('aria-current')==='page'),[items[target]]);
 }
});
test('สร้างโครงการผ่านหน้าฟอร์มเดิมและการเปลี่ยนหน้าโดย React ยังคงเลือกเมนูได้ถูกต้อง',()=>{
 const items=[navItem('ภาพรวม','',true),navItem('โครงการทั้งหมด'),navItem('รออนุมัติ')],DV={page:'projects'},c=context({DV},between('function dvPaintNav(','function dvSync('));c.dvPaintNav(items);
 DV.page=null;DV.nativeEl=items[1];DV.nativePending=true;c.dvPaintNav(items);DV.nativePending=false;assert.equal(DV.painted,items[1]);
 items[1].classList.toggle('active',false);items[0].classList.toggle('active',true);assert.equal(c.dvPaintNav(items),items[0]);
});
test('ลายเซ็นตรวจพบการแก้ค่าแม้ข้อความยาวเท่าเดิม และไม่วาดหน้าซ้ำตามตัวเลข progress',()=>{
 const M={cache:{items:[{id:'1',lastModifiedDateTime:'2026-10-20'}],track:{1:{engineer:'Demo A',activities:[{id:'a',createdAt:'2026-10-20'}]}},settings:{label:'aaa'}}},TS={at:'2026-10-20',progress:{done:1,total:20}},c=context({M,TS},between('var dvSig=','var dvTitle='));
 const first=c.dvSig();TS.progress.done=2;assert.equal(c.dvSig(),first);M.cache.track[1].engineer='Demo B';assert.notEqual(c.dvSig(),first);
 const second=c.dvSig();M.cache.settings.label='bbb';assert.notEqual(c.dvSig(),second);const third=c.dvSig();M.cache.items[0].lastModifiedDateTime='2026-10-21';assert.notEqual(c.dvSig(),third);
 const fourth=c.dvSig();TS.progress=null;assert.notEqual(c.dvSig(),fourth);
});
test('ลายเซ็นไม่แตะข้อความกิจกรรมขนาดใหญ่ระหว่างตรวจหน้าจอ',()=>{
 const activity={id:'a',createdAt:'2026-10-20'};Object.defineProperty(activity,'note',{enumerable:true,get(){throw Error('ไม่ควรอ่านประวัติทั้งชุด')}});
 const c=context({M:{cache:{items:[],track:{1:{activities:[activity]}},settings:{}}},TS:{}},between('var dvSig=','var dvTitle='));assert.doesNotThrow(()=>c.dvSig());
});

function listSetup(page='projects',count=2000){
 const blobs=[],result={innerHTML:'',querySelectorAll:()=>[],insertAdjacentHTML(_where,s){this.innerHTML+=s}},csv={},host={writes:0,markup:'',set innerHTML(v){this.markup=v;this.writes++},get innerHTML(){return this.markup},querySelector:s=>s==='#dv-pcsv'?csv:result};
 const projects=Array.from({length:count},(_,i)=>({id:'sp-'+(i+1),listItemId:String(i+1),code:'TST'+String(i+1).padStart(5,'0'),name:'งานตัวอย่าง '+(i+1),client:'ลูกค้าตัวอย่าง',accountId:'acc-sales',createdAt:'2026-10-20T00:00:00Z',listApproval:'approved',pstat:{s:'active',at:'2026-10-20T00:00:00Z'}}));
 const values={Blob,URL:{createObjectURL:b=>{blobs.push(b);return'blob:mock'}},innerWidth:1200,DV:{page,stAt:0,stv:'list',sf:'active',q:'',pq:''},M:{profile:{email:'engineer@example.invalid'},role:'engineer'},TS:{channels:{},all:[]},Hd:['Engineer ตัวอย่าง'],STEPCOL:{recv:'#123'},SUBORD:['recv'],SUBST:{recv:{t:'รับงานแล้ว',who:'เรา'},design:{warn:3},price:{warn:7},cust:{warn:14}},
  document:{querySelector:()=>result,createElement:()=>({click(){}})},dvState:async()=>({projects,accounts:[{id:'acc-sales',name:'Sales ตัวอย่าง'}]}),dvRenderCurrent:()=>true,dvSig:()=>'',mIsEng:()=>true,mPStat:p=>p.pstat.s,mSubOf:()=>({sub:'recv',m:{t:'รับงานแล้ว',who:'เรา'},days:1,dflt:true}),dvCityEng:()=>0,mChanUrl:()=>'',mCodeClean:x=>x,mDups:()=>({sp:[],tm:[]}),dvDraftBox:()=>'',dvDupCard:()=>'',mEsc:esc,dvTH2:x=>x,dvDay:()=> '2026-10-20',dvNum:String,dvPChip:()=>'',dvStepField:()=>'',dvIcon:{ok:'',warn:''},dvRecent:()=>'',dvApprovalLog:()=>'',dvQNote:(q,n)=>{values.note={q,n}}};
 const source=between('function dvMatchProjects(','/* ===== v16.23 ===== */')+between('async function dvStatusPage(','window.dvFilterRows=');
 const c=context(values,source);return{c,host,result,projects,csv,blobs,note:()=>values.note};
}
test('ทะเบียน 2,000 โครงการแสดงชุดละ 200 แต่ค้นหารายการท้ายสุดได้โดยไม่สร้างช่องกรอกใหม่',async()=>{
 const r=listSetup();await r.c.dvProjectsPage(r.host);assert.equal((r.result.innerHTML.match(/class="dv-preg"/g)||[]).length,200);
 r.c.dvProjectSearch('TST02000');assert.match(r.result.innerHTML,/TST02000/);assert.equal((r.result.innerHTML.match(/class="dv-preg"/g)||[]).length,1);assert.equal(r.host.writes,1);assert.equal(r.note().n,1);
 r.c.dvProjectSearch('ไม่พบงานนี้');assert.match(r.result.innerHTML,/ไม่มีโครงการ/);assert.equal(r.note().n,0);
});
test('ค้นหาหลายคำและล้างการค้นหาคืนรายการได้ครบโดยยังแบ่งแสดง',async()=>{
 const r=listSetup();await r.c.dvProjectsPage(r.host);r.c.dvProjectSearch('tst02000 ลูกค้า');assert.equal(r.note().n,1);r.c.dvProjectSearch('');assert.equal(r.note().n,2000);assert.match(r.result.innerHTML,/อีก 1800 โครงการ/);r.c.DV.plim=400;r.c.dvRegistryResults();assert.equal((r.result.innerHTML.match(/class="dv-preg"/g)||[]).length,400);
});
test('ทะเบียนรักษาตัวกรองเซลส์และสถานะขณะค้นหาจากข้อมูลทั้งหมด',async()=>{
 const r=listSetup();r.projects[1999].accountId='acc-other';r.projects[0].pstat.s='won';r.c.DV.pa='acc-sales';r.c.DV.ps='active';await r.c.dvProjectsPage(r.host);
 r.c.dvProjectSearch('TST02000');assert.equal(r.note().n,0);r.c.dvProjectSearch('TST00001');assert.equal(r.note().n,0);r.c.dvProjectSearch('TST00002');assert.equal(r.note().n,1);
});
test('CSV ทะเบียนส่งออกเฉพาะรายการที่ตรงกับคำค้นหา แม้อยู่เกิน 200 รายการแรก',async()=>{
 const r=listSetup();await r.c.dvProjectsPage(r.host);r.c.dvProjectSearch('TST02000');r.csv.onclick();assert.equal(r.blobs.length,1);const csv=await r.blobs[0].text();assert.match(csv,/TST02000/);assert.doesNotMatch(csv,/TST00001/);assert.equal(csv.trim().split('\n').length,2);
});
test('ผู้ใช้เริ่มพิมพ์ระหว่างโหลดข้อมูล ทะเบียนและสถานะคืน focus/ช่วงข้อความหลังวาดผลใหม่',async()=>{
 for(const page of ['projects','status']){
  const r=listSetup(page),d=deferred(),state=await r.c.dvState(),key=page==='projects'?'pq':'q',oldInput={dataset:{qk:key},selectionStart:2,selectionEnd:5,selectionDirection:'backward'},newInput={focus(){this.focused=true},setSelectionRange(...a){this.selection=a}},query=r.host.querySelector;
  r.c.dvState=()=>d.promise;r.host.contains=e=>e===oldInput;r.host.querySelector=s=>s===`input[data-qk="${key}"]`?newInput:query(s);
  const pending=page==='projects'?r.c.dvProjectsPage(r.host):r.c.dvStatusPage(r.host);r.c.document.activeElement=oldInput;r.c.DV[key]='TST02000';d.resolve(state);await pending;
  assert.equal(newInput.focused,true);assert.deepEqual(newInput.selection,[2,5,'backward']);assert.match(r.result.innerHTML,/TST02000/);
 }
});
test('สถานะ 2,000 งานจำกัดรายการหน้าจอ แต่ค้นหาท้ายชุดและสลับบอร์ดยังค้นเจอ',async()=>{
 const r=listSetup('status');await r.c.dvStatusPage(r.host);assert.equal((r.result.innerHTML.match(/class="dv-prow"/g)||[]).length,200);
 r.c.dvStatusSearch('TST02000');assert.match(r.result.innerHTML,/TST02000/);assert.equal(r.note().n,1);assert.equal(r.host.writes,1);
 r.c.DV.stv='board';await r.c.dvStatusPage(r.host);assert.match(r.result.innerHTML,/TST02000/);assert.equal((r.result.innerHTML.match(/class="dv-bcard/g)||[]).length,1);
 r.c.dvStatusSearch('');assert.equal((r.result.innerHTML.match(/class="dv-bcard/g)||[]).length,200);r.c.dvSMore();assert.equal((r.result.innerHTML.match(/class="dv-bcard/g)||[]).length,400);
});
test('ปุ่มแบ่งแสดงไม่ถูกผูกเป็นคำสั่งเปลี่ยนสถานะ และปุ่มสถานะยังส่งโครงการ/ค่าที่เลือก',async()=>{
 const b={dataset:{pid:'sp-1',s:'delivered',code:'TST00001'}},select={dataset:{pid:'sp-2',code:'TST00002'},value:'sub:recv'},requests=[],selectors=[];
 const c=context({DV:{},M:{},PSTAT:{delivered:{t:'ส่งงานแล้ว'}},SUBST:{recv:{t:'รับงานแล้ว'}},confirm:()=>true,mToast(){},dvRender(){},dvPost:async body=>{requests.push(body);return{}}},between('function dvStatusWire(','window.dvFilterRows='));
 c.dvStatusWire({querySelectorAll(s){selectors.push(s);return s==='.dv-subsel'?[select]:s==='.dv-sb[data-pid]'?[b]:[]}});await b.onclick();await select.onchange();
 assert.equal(selectors.includes('.dv-sb'),false);assert.equal(requests[0].projectId,'sp-1');assert.equal(requests[0].status,'delivered');assert.equal(requests[1].projectId,'sp-2');assert.equal(requests[1].sub,'recv');
});

function renderSetup(){
 const d=deferred(),host={innerHTML:'',dataset:{},querySelector:()=>null},DV={page:'quotes'},timers=[];
 const c=context({DV,QT:{items:[]},QT_ST:{},M:{role:'engineer'},mIsEng:()=>true,mCanQuote:()=>true,mWorkspaceAdmin:()=>false,wsPageAllowed:()=>true,wsApplyUi(){},mQuotes:()=>d.promise,dvSig:()=>'',mEsc:esc,dvCityStop(){},document:{getElementById:()=>host},setTimeout:fn=>timers.push(fn)},between('function dvRenderCurrent(','window.dvDecide=')+between('async function dvQuotesPage(','/* ===== v16.29'));
 c.dvStatusPage=async(h,id)=>{if(c.dvRenderCurrent(id,'status'))h.innerHTML='หน้าสถานะล่าสุด'};return{c,DV,host,d,timers};
}
test('หน้าโหลดช้าไม่ล็อกการสลับไปสถานะ และผลเก่าที่เสร็จทีหลังไม่เขียนทับ',async()=>{
 const r=renderSetup(),old=r.c.dvRender();assert.equal(r.DV.busy,true);r.DV.page='status';await r.c.dvRender();assert.equal(r.host.innerHTML,'หน้าสถานะล่าสุด');r.d.resolve([]);await old;assert.equal(r.host.innerHTML,'หน้าสถานะล่าสุด');assert.equal(r.DV.busy,false);
});
test('ข้อผิดพลาดจากหน้าที่ออกไปแล้วไม่แทนที่หน้าปัจจุบัน',async()=>{
 const r=renderSetup(),old=r.c.dvRender();r.DV.page='status';await r.c.dvRender();r.d.reject(Error('mock delayed failure'));await old;assert.equal(r.host.innerHTML,'หน้าสถานะล่าสุด');
});
test('การออกไปหน้า React เดิมยกเลิกผลโหลดของหน้าก่อนหน้า',async()=>{
 const r=renderSetup(),old=r.c.dvRender();r.DV.page=null;r.DV.renderId++;r.DV.busy=false;r.host.innerHTML='เนื้อหาเดิมที่ต้องคงไว้';r.d.resolve([]);await old;assert.equal(r.host.innerHTML,'เนื้อหาเดิมที่ต้องคงไว้');
});
test('คำขอวาดหน้าเดียวกันระหว่างโหลดรวมเป็นรอบตามหลังเพียงรอบเดียว',async()=>{
 const r=renderSetup();r.DV.page='status';let calls=0;r.c.dvStatusPage=async()=>{calls++;await r.d.promise};const first=r.c.dvRender();await Promise.all(Array.from({length:10},()=>r.c.dvRender()));assert.equal(calls,1);r.d.resolve();await first;assert.equal(r.timers.length,1);await r.timers[0]();assert.equal(calls,2);
});
test('MutationObserver ข้ามการอัปเดตภายใน dashboard และรวมการเปลี่ยน React ต่อเฟรม',()=>{
 const frames=[],runs=[],c=context({requestAnimationFrame:fn=>{frames.push(fn);return frames.length},mNavInject:()=>runs.push('nav'),dvSync:()=>runs.push('sync'),mCodeAuto:()=>runs.push('code'),dvDraftInject:()=>runs.push('draft'),dvWorkspaceSettingsInject:()=>{},wsApplyUi(){},mApprovalImportsInject(){}},between('var mUiFrame=','async function boot()'));
 const record=inside=>({target:{nodeType:1,closest:()=>inside?{}:null}});c.mUiSchedule([record(true)]);assert.equal(frames.length,0);for(let i=0;i<20;i++)c.mUiSchedule([record(false)]);assert.equal(frames.length,1);frames[0]();assert.deepEqual(runs,['nav','sync','code','draft']);
});
test('เปิดคีย์บอร์ดที่เปลี่ยนเฉพาะความสูงไม่วาดหน้า และแท็บที่ซ่อนไม่ poll หน้าจอ',()=>{
 const events={},timers=[],DV={},body={classList:{contains:()=>true}},doc={hidden:false,body},c=context({DV,innerWidth:390,document:doc,draws:0,dvRender:()=>c.draws++,dvEditing:()=>false,dvProgress(){},dvSig:()=>'',setInterval:fn=>events.poll=fn,addEventListener:(k,fn)=>events[k]=fn,clearTimeout(){},setTimeout:fn=>timers.push(fn)},between('setInterval(()=>{if(document.hidden||!document.body.classList.contains("dv-on"))','/* ---- ชิ้นส่วนกราฟ ---- */'));
 events.resize();assert.equal(timers.length,0);c.innerWidth=420;events.resize();assert.equal(timers.length,1);timers[0]();assert.equal(c.draws,1);doc.hidden=true;events.poll();assert.equal(c.draws,1);
});
