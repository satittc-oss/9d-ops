// v16.33 ข้อมูลสมมติทั้งหมด ไม่มีการเรียก Microsoft 365 จริง
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const edit=html.slice(html.indexOf('var M_REQ_EDIT='),html.indexOf('/* ===== v16.37 ใบเสนอราคา'));
const imports=html.slice(html.indexOf('var M_IMPORT='),html.indexOf('window.mOfferTeamImports=mOfferTeamImports;'));
const keys=html.slice(html.indexOf('var mKey=s=>'),html.indexOf('/* v16.21 เก็บผลซิงค์'));
const plain=x=>JSON.parse(JSON.stringify(x));
class PvErr extends Error{constructor(message,status=400){super(message);this.status=status}}
function setup(){
 const storage=new Map(),items=[],track={},channel={teamId:'team-1',channelId:'channel-1',name:'TST26001_โครงการเดิม',teamName:'ฝ่ายขายตัวอย่าง',url:'https://teams.microsoft.com/l/channel/channel-1',pid:'',ignored:false};
 const cols={name:{name:'Title'},client:{name:'Partner'},source:{name:'Source',choices:['Email','Phone']},brands:{name:'Brand',type:'multi',choices:['Brand A','Brand B']},workTypes:{name:'Work',type:'multi',choices:['Design']},notes:{name:'Notes'},urgency:{name:'Urgency',choices:['ปกติ','ด่วนมาก']},closingChance:{name:'Chance',choices:['สูง','ต่ำ']},assignedAt:{name:'Assigned',type:'date'},estimatedValue:{name:'Value',choices:['Small','Large']},code:{name:'ProjectCode'},approval:{name:'RequestStatus'}};
 const owner={email:'sales@example.invalid',name:'Test Sales',teamId:'team-1'},ctx={PvErr,console,Date,Set,Map,JSON,Number,String,Array,Promise,isFinite,encodeURIComponent,setTimeout,clearTimeout,window:{},document:{hidden:false,querySelector:()=>null},navigator:{},CFG:{allowedDomains:['example.invalid']},M:{role:'engineer',profile:{email:'engineer@example.invalid',name:'Test Engineer',oid:'test-user'},sid:'mock-site',lid:'mock-list',tl:'mock-track',cols,cache:{items,track,settings:{channelMap:{}}}},TS:{at:1,all:[channel],extra:[channel],live:['channel-1'],liveTeams:['team-1'],channels:{}},calls:[],audits:[],lockReleases:0,owner};
 ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 ctx.pvTxt=(v,max,label,required)=>{v=typeof v==='string'?v.trim():'';if(required&&!v)throw new PvErr('กรุณากรอก '+label);if(v.length>max)throw new PvErr(label+' ยาวเกินไป');return v};
 ctx.mF=(f,k)=>f[cols[k]?.name];ctx.mCodeClean=s=>String(s||'').trim().split(/[\s_\t]+/)[0].toUpperCase();ctx.mEsc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));ctx.pvNow=()=> '2026-10-20T10:00:00Z';ctx.pvUid=()=> 'fake-operation';ctx.mVerNew=async()=>ctx.newVersion||'';
 ctx.mState=async()=>({accounts:[owner],projects:items.map(x=>({id:'sp-'+x.id}))});ctx.mPvLock=async()=>()=>ctx.lockReleases++;ctx.mTsSave=()=>{};
 ctx.mProject=it=>({id:'sp-'+it.id,code:it.fields.ProjectCode,serviceRequest:{notes:it.fields.Notes}});
 ctx.G=async(url,o={})=>{ctx.calls.push({url,...plain(o)});if(url.startsWith('/teams/')){if(ctx.channelError)throw new PvErr('Mock missing',ctx.channelError);return{id:'channel-1',displayName:ctx.liveName||channel.name,webUrl:channel.url,membershipType:'private'}}
  assert.equal(url,'/sites/mock-site/lists/mock-list/items');assert.equal(o.method,'POST');if(ctx.postError&&!ctx.ambiguous)throw new PvErr('Mock create failure',ctx.postError);
  const item={id:String(100+items.length),fields:plain(o.json.fields)};items.push(item);if(ctx.ambiguous)throw new PvErr('Mock timeout after creation',504);return plain(item)};
 ctx.mSaveTrack=async(p,acts)=>{if(ctx.trackError)throw new PvErr('Mock tracking failure',503);ctx.audits.push({p:plain(p),acts:plain(acts)});track[Number(p.listItemId)]=plain(p)};
 vm.createContext(ctx);vm.runInContext(keys+edit+imports,ctx);
 ctx.input=()=>({confirmed:true,channelId:channel.channelId,channelName:channel.name,code:'TST26001',ownerEmail:owner.email,values:{name:'โครงการเดิม',client:'บริษัทตัวอย่าง',source:'Email',brands:['Brand A'],workTypes:['Design'],notes:'รายละเอียดสำหรับนำเข้า',urgency:'ปกติ',closingChance:'สูง',assignedAt:'2026-10-20T09:00',estimatedValue:'Small'}});
 ctx.posts=()=>ctx.calls.filter(x=>x.method==='POST');return ctx;
}
test('พบ Channel ที่ยังไม่มีรายการ รวมชื่อที่ไม่มีรหัส แต่ข้าม General/ที่ซ่อน/ที่ถูกลบ/ที่ผูกแล้ว',()=>{
 const c=setup();c.TS.all.push({...c.TS.all[0]},{teamId:'t',channelId:'plain',name:'งานออกแบบที่สร้างเอง'},{teamId:'t',channelId:'general',name:'General'},{teamId:'t',channelId:'ignored',name:'TST999_Ignore',ignored:true},{teamId:'t',channelId:'deleted',name:'TST888_Deleted'});c.TS.live.push('plain','general','ignored');
 assert.deepEqual(plain(c.mImportCandidates()).map(x=>x.channelId),['channel-1','plain']);c.M.cache.items.push({id:'9',fields:{ProjectCode:'TST26001'}});assert.deepEqual(plain(c.mImportCandidates()).map(x=>x.channelId),['plain']);
});
test('ตรวจชื่อรหัสเทียบแบบ normalized และการผูกด้วย Tracking/Channel Map',()=>{
 for(const variant of ['code','track','map']){const c=setup();c.M.cache.items.push({id:'9',fields:{ProjectCode:variant==='code'?'TST026001':'OTHER'}});if(variant==='track')c.M.cache.track[9]={teamId:'team-1',channelId:'channel-1'};if(variant==='map')c.M.cache.settings.channelMap['channel-1']='9';assert.equal(c.mImportCandidates().length,0)}
});
test('Sales/Viewer ไม่เห็นคำถามและไม่สร้างรายการ',async()=>{
 for(const role of ['sales','viewer']){const c=setup();c.M.role=role;assert.equal(c.mImportCandidates().length,0);await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===403);assert.equal(c.calls.length,0)}
});
test('ต้องยืนยันก่อนสร้าง และการเปิดดู Context ไม่มีคำสั่งเขียน',async()=>{
 const c=setup();await assert.rejects(c.mImportTeamProject({...c.input(),confirmed:false}),e=>e.status===400);assert.equal(c.calls.length,0);await c.mImportContext('channel-1');assert.equal(c.posts().length,0);
});
test('สร้างหนึ่งรายการและเชื่อม Channel เดิม/เซลส์เจ้าของงาน โดยไม่อนุมัติหรือแก้ Teams',async()=>{
 const c=setup(),r=await c.mImportTeamProject(c.input());assert.equal(c.posts().length,1);assert.match(c.posts()[0].url,/lists\/mock-list\/items$/);assert.equal(c.posts()[0].json.fields.ProjectCode,'TST26001');assert.equal(c.posts()[0].json.fields.RequestStatus,undefined);assert.equal(c.posts()[0].json.fields.Assigned,'2026-10-20T02:00:00.000Z');assert.match(c.posts()[0].json.fields.Notes,/ต้นทาง Teams:/);
 assert.equal(r.project.channelId,'channel-1');assert.equal(r.project.teamId,'team-1');assert.equal(r.project.onBehalf.email,c.owner.email);assert.equal(r.project.importSource.type,'teams');assert.equal(c.TS.channels['sp-100'].channelId,'channel-1');assert.equal(c.mImportCandidates().length,0);assert.equal(c.lockReleases,1);
 assert.ok(c.calls.every(x=>x.url.startsWith('/teams/')?!x.method:x.method==='POST'));assert.equal(c.audits[0].acts[0].action,'นำโครงการจาก Teams เข้า SharePoint');
});
test('กดพร้อมกันในแท็บเดียวกันสร้างเพียงหนึ่งครั้ง',async()=>{
 const c=setup(),b=c.input();await Promise.all([c.mImportTeamProject(b),c.mImportTeamProject(b)]);assert.equal(c.posts().length,1);
});
test('มีรายการเกิดขึ้นหลังเปิดฟอร์ม: ไม่สร้างซ้ำหรือผูกทับรายการอื่น',async()=>{
 const c=setup();await c.mImportContext('channel-1');c.M.cache.items.push({id:'9',fields:{ProjectCode:'TST26001'}});await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===409&&/มีรายการ/.test(e.message));assert.equal(c.posts().length,0);assert.equal(c.audits.length,0);
});
test('ตรวจ Channel ล่าสุด: ชื่อเปลี่ยน/ถูกลบ/ไม่อยู่ในผลซิงค์ หยุดก่อนสร้าง',async()=>{
 for(const mode of ['rename','missing','stale']){const c=setup();if(mode==='rename')c.liveName='Renamed';if(mode==='missing')c.channelError=404;if(mode==='stale')c.TS.live=[];await assert.rejects(c.mImportTeamProject(c.input()));assert.equal(c.posts().length,0)}
});
test('ตรวจข้อมูลบังคับ/ตัวเลือก/วันที่/รหัส/เซลส์ก่อน POST',async()=>{
 for(const change of [{code:'bad code'},{ownerEmail:'unknown@example.invalid'},{values:{}},{values:{...setup().input().values,brands:[]}},{values:{...setup().input().values,assignedAt:'2026-02-30T09:00'}}]){const c=setup();await assert.rejects(c.mImportTeamProject({...c.input(),...change}));assert.equal(c.posts().length,0)}
});
test('สิทธิ์สร้างรายการ 403 ไม่พยายามแก้สิทธิ์ และอนุญาตให้ลองใหม่หลังแก้สาเหตุ',async()=>{
 const c=setup();c.postError=403;await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===403);assert.equal(Object.keys(c.mImportReceipts()).length,0);assert.equal(c.audits.length,0);
});
test('Tracking ล้มเหลว: เปิดใหม่และเชื่อมรายการเดิมต่อโดยไม่ POST อีกครั้ง',async()=>{
 const c=setup();c.trackError=true;await assert.rejects(c.mImportTeamProject(c.input()),/สร้างรายการ #100 แล้ว/);assert.equal(c.posts().length,1);const ctx=await c.mImportContext('channel-1');assert.equal(ctx.channel.channelId,'channel-1');c.trackError=false;const r=await c.mImportTeamProject(c.input());assert.equal(r.project.listItemId,'100');assert.equal(c.posts().length,1);assert.equal(Object.keys(c.mImportReceipts()).length,0);
});
test('POST หมดเวลาแต่สร้างแล้ว: ค้นหลักฐานต้นทางและเชื่อมรายการเดิมแทนการสร้างซ้ำ',async()=>{
 const c=setup();c.ambiguous=true;await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===504);assert.equal(c.posts().length,1);c.ambiguous=false;const r=await c.mImportTeamProject(c.input());assert.equal(r.project.listItemId,'100');assert.equal(c.posts().length,1);
});
test('ยังไม่ทราบผล POST ครั้งก่อนหรือเปลี่ยนเจ้าของ/รหัสระหว่างกู้คืน: ไม่ POST ซ้ำ',async()=>{
 const c=setup();c.trackError=true;await assert.rejects(c.mImportTeamProject(c.input()));c.trackError=false;await assert.rejects(c.mImportTeamProject({...c.input(),code:'OTHER26001'}),e=>e.status===409);c.M.cache.items.length=0;await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===409&&/ครั้งก่อน/.test(e.message));assert.equal(c.posts().length,1);
});
test('Metadata อยู่ใน keep, ข้ามการเพิ่มสมาชิกอัตโนมัติ, และผูกคำถามหลังซิงค์',()=>{
 assert.ok(html.includes('"reqCancel","importSource","channelArchive"]'));assert.ok(html.includes('!T(p).importSource&&(!p.permissionsVerifiedAt'));assert.ok(html.includes('M.cacheAt=0;mScheduleImportOffer()}'));assert.ok(html.includes('if(act==="import_team_project")return J(await mImportTeamProject(b));'));assert.ok(html.includes('onclick="mImportProject(this.dataset.cid)"'));
});
test('Tracking ยังไม่พร้อม: หยุดก่อนสร้างรายการ',async()=>{
 const c=setup();c.M.tl=null;await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===409);assert.equal(c.posts().length,0);
});
test('POST สร้างรายการไม่ retry อัตโนมัติ และเก็บหลักฐานเมื่อผล 503 ไม่แน่นอน',async()=>{
 const c=setup();c.postError=503;await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===503);assert.equal(c.posts().length,1);assert.equal(c.posts()[0].noRetry,true);assert.equal(Object.keys(c.mImportReceipts()).length,1);await assert.rejects(c.mImportTeamProject(c.input()),e=>e.status===409);assert.equal(c.posts().length,1);assert.ok(html.includes('tries<2&&!o.noRetry'));
});
