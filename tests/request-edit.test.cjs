// v16.32 ทดสอบการแก้ไขคำขอด้วยข้อมูลสมมติเท่านั้น ไม่มีการเชื่อมต่อ Microsoft 365
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const block=html.slice(html.indexOf('var M_REQ_EDIT='),html.indexOf('/* ===== v16.37 ใบเสนอราคา'));
const project=html.slice(html.indexOf('function mProject('),html.indexOf('function mRole('));
const plain=x=>JSON.parse(JSON.stringify(x));
class PvErr extends Error{constructor(message,status=400){super(message);this.status=status}}
function setup(){
 const columns={name:{name:'Title'},client:{name:'PartnerName'},source:{name:'Source',choices:['Email','Phone']},brands:{name:'Brand',type:'multi',choices:['Brand A','Brand B']},workTypes:{name:'Work',type:'multi',choices:['Design','Survey']},notes:{name:'Notes'},urgency:{name:'Urgency',choices:['ปกติ','ด่วนมาก']},closingChance:{name:'Chance',choices:['สูง','ต่ำ']},assignedAt:{name:'Assigned',type:'date'},estimatedValue:{name:'Value',choices:['Small','Large']},code:{name:'ProjectCode'},approval:{name:'RequestStatus'},latest:{name:'Latest'},winLoss:{name:'WinLoss'}};
 let item={id:'42',eTag:'"item,1"',createdBy:{user:{email:'sales@example.invalid',displayName:'Test Sales'}},createdDateTime:'2026-10-01T00:00:00Z',fields:{Title:'Original project',PartnerName:'Original partner',ProjectCode:'TST26001',Source:'Email',Brand:['Brand A'],Work:['Design'],Notes:'Original notes',Urgency:'ปกติ',Chance:'สูง',Assigned:'2026-10-20T02:30:00Z',Value:'Small',RequestStatus:'',Latest:'In Progress',WinLoss:'Process',Attachments:true}};
 const track={version:4,channelId:'old-channel',channelUrl:'https://example.invalid/channel',teamId:'test-team',reqFiles:{names:['original.pdf']}};
 const ctx={PvErr,console,Date,Set,Map,JSON,Number,String,Array,Promise,isFinite,document:{},M:{role:'sales',profile:{email:'sales@example.invalid',name:'Test Sales'},sid:'test-site',lid:'test-list',tl:'test-tracking',cols:columns,cache:{items:[plain(item)],track:{42:track}}},writes:[],audits:[],newVersion:'',get item(){return item},set item(v){item=v}};
 ctx.pvTxt=(v,max,label,required)=>{v=typeof v==='string'?v.trim():'';if(required&&!v)throw new PvErr('กรุณากรอก '+label);if(v.length>max)throw new PvErr(label+' ยาวเกินไป');return v};
 ctx.mF=(f,k)=>f[columns[k]?.name];ctx.mReqStatus=f=>/^approv/i.test(f.RequestStatus||'')?'approved':/^rej/i.test(f.RequestStatus||'')?'rejected':'pending';
 ctx.pvNow=()=> '2026-10-20T10:00:00Z';ctx.pvUid=()=> 'test-activity';ctx.mVerNew=async()=>ctx.newVersion;
 ctx.mVisible=async()=>ctx.mProject({...plain(item),createdBy:ctx.M.cache.items[0].createdBy},track);
 ctx.G=async(url,options={})=>{if(options.method==='PATCH'){ctx.writes.push({url,...plain(options)});if(ctx.patchError)throw new PvErr('Mock error',ctx.patchError);assert.equal(options.headers['If-Match'],item.eTag);Object.assign(item.fields,plain(options.json));item.eTag='"item,2"';return plain(item.fields)}return plain(item)};
 ctx.mSaveTrack=async(p,acts)=>{if(ctx.auditError)throw new Error('Mock audit failure');ctx.audits.push({p:plain(p),acts:plain(acts)})};
 vm.createContext(ctx);vm.runInContext(project+block,ctx);
 ctx.values=()=>Object.fromEntries(ctx.M_REQ_EDIT.map(d=>[d.k,plain(ctx.mReqEditCurrent(ctx.mProject({...item,createdBy:ctx.M.cache.items[0].createdBy},track),d.k))]));
 ctx.save=values=>ctx.mEditRequestSave({projectId:'sp-42',etag:'"item,1"',values});return ctx;
}
test('เจ้าของ Sales และ Engineer/Admin แก้ได้ แต่ Viewer/เซลส์อื่น/งานที่อนุมัติแล้วแก้ไม่ได้',()=>{
 const c=setup(),p=c.mProject(c.item,c.M.cache.track[42]);
 for(const [role,email,allowed] of [['sales','sales@example.invalid',true],['sales','other@example.invalid',false],['viewer','sales@example.invalid',false],['engineer','other@example.invalid',true],['admin','other@example.invalid',true]])assert.equal(c.mCanEditRequest(p,{role,email}),allowed);
 for(const state of ['approved','rejected'])assert.equal(c.mCanEditRequest({...p,listApproval:state},{role:'admin'}),false);
 assert.equal(c.mCanEditRequest({...p,demo:true},{role:'admin'}),false);
});
test('PATCH รายการเดิมเฉพาะช่องที่เปลี่ยน พร้อม If-Match และประวัติ โดยเก็บสถานะ/รหัส/ไฟล์/Channel',async()=>{
 const c=setup(),v=c.values();Object.assign(v,{name:'Updated project',notes:'Updated scope',brands:['Brand B'],workTypes:[],assignedAt:'',estimatedValue:'',urgency:'ด่วนมาก'});
 const r=await c.save(v);assert.equal(c.writes.length,1);const w=c.writes[0];assert.match(w.url,/items\/42\/fields$/);assert.equal(w.method,'PATCH');assert.equal(w.headers['If-Match'],'"item,1"');
 assert.deepEqual(w.json,{Title:'Updated project','Brand@odata.type':'Collection(Edm.String)',Brand:['Brand B'],'Work@odata.type':'Collection(Edm.String)',Work:[],Notes:'Updated scope',Urgency:'ด่วนมาก',Assigned:null,Value:''});
 assert.equal(c.item.fields.ProjectCode,'TST26001');assert.equal(c.item.fields.RequestStatus,'');assert.equal(c.item.fields.Attachments,true);assert.equal(c.audits[0].p.channelId,'old-channel');assert.equal(c.audits[0].p.priority,'urgent');assert.match(c.audits[0].acts[0].note,/ชื่อโครงการ/);assert.equal(r.project.version,5);
});
test('ปิดกั้นข้อมูลที่ถูกแก้ไขหลังเปิดฟอร์มก่อนส่ง PATCH',async()=>{
 const c=setup();c.item.eTag='"item,3"';await assert.rejects(c.save({...c.values(),notes:'New'}),e=>e.status===409);assert.equal(c.writes.length,0);
});
test('ปิดกั้นการอนุมัติที่เกิดหลังเปิดฟอร์ม',async()=>{
 const c=setup(),pending=c.mProject(c.item,c.M.cache.track[42]);c.mVisible=async()=>pending;c.item.fields.RequestStatus='Approved';
 await assert.rejects(c.save({...c.values(),notes:'New'}),e=>e.status===409);assert.equal(c.writes.length,0);
});
test('Microsoft ตอบ 412: ไม่เขียนประวัติและแจ้งให้โหลดใหม่',async()=>{
 const c=setup();c.patchError=412;await assert.rejects(c.save({...c.values(),notes:'New'}),e=>e.status===409&&/เปิดรายการใหม่/.test(e.message));assert.equal(c.audits.length,0);
});
test('Microsoft ตอบ 403: ไม่ขยายสิทธิ์หรือสร้างรายการใหม่',async()=>{
 const c=setup();c.patchError=403;await assert.rejects(c.save({...c.values(),notes:'New'}),e=>e.status===403&&/ไม่มีสิทธิ์แก้ไข/.test(e.message));assert.equal(c.writes.length,1);assert.equal(c.audits.length,0);
});
test('ข้ามฟิลด์นอกขอบเขตและคอลัมน์ readOnly แม้ส่งมาจาก client',async()=>{
 const c=setup();c.M.cols.name.readOnly=true;await c.save({...c.values(),name:'Forbidden',notes:'New',approval:'Approved',code:'OTHER',channelId:'other'});
 assert.deepEqual(c.writes[0].json,{Notes:'New'});
});
test('ตรวจข้อมูลบังคับ ตัวเลือก และวันที่จริงก่อนเขียน',async()=>{
 for(const change of [{notes:''},{brands:[]},{brands:'Brand A'},{source:'Invalid'},{assignedAt:'2026-02-30T10:00'},{assignedAt:'2026-10-20T25:00'}]){const c=setup();await assert.rejects(c.save({...c.values(),...change}));assert.equal(c.writes.length,0)}
});
test('เก็บตัวเลือกเก่าและวันที่เดิมที่ไม่ได้แก้ โดยไม่เขียนซ้ำ',async()=>{
 const c=setup();c.item.fields.Source='Legacy source';c.M.cache.items[0]=plain(c.item);await c.save(c.values());assert.equal(c.writes.length,0);assert.equal(c.audits.length,0);
});
test('แปลงเวลาท้องถิ่นไทยกลับเป็น UTC',async()=>{
 const c=setup();await c.save({...c.values(),assignedAt:'2026-10-21T09:15'});assert.equal(c.writes[0].json.Assigned,'2026-10-21T02:15:00.000Z');
});
test('สิทธิ์เจ้าของงานอ้างอิงเซลส์ที่ Engineer คีย์แทน',async()=>{
 const c=setup();c.item.createdBy.user.email='engineer@example.invalid';c.M.cache.track[42].onBehalf={email:'sales@example.invalid',name:'Test Sales'};
 await c.save({...c.values(),notes:'Owner edit'});assert.equal(c.writes.length,1);
});
test('ประวัติล้มเหลวหลัง PATCH: รายงานว่าข้อมูลบันทึกแล้ว ไม่แจ้งให้บันทึกซ้ำ',async()=>{
 const c=setup();c.auditError=true;const r=await c.save({...c.values(),notes:'Saved'});assert.match(r.warning,/บันทึกคำขอใน Microsoft Lists แล้ว/);assert.equal(c.item.fields.Notes,'Saved');assert.equal(c.M.cacheAt,0);
});
test('ผู้ไม่มีสิทธิ์ เว็บเก่า และ eTag หาย ไม่ส่งคำสั่งเขียน',async()=>{
 const c=setup();c.M.role='viewer';await assert.rejects(c.save(c.values()),e=>e.status===403);c.M.role='sales';c.newVersion='v16.33';await assert.rejects(c.save(c.values()),e=>e.status===409);c.newVersion='';delete c.item.eTag;await assert.rejects(c.save(c.values()),e=>e.status===409);assert.equal(c.writes.length,0);
});
test('เลข release และจุดเชื่อมต่อปุ่ม/การรีเฟรชตรงกับเวอร์ชันใหม่',()=>{
 const version=JSON.parse(fs.readFileSync(path.join(__dirname,'../version.json'),'utf8')).v;
 assert.ok(html.includes('var M_VER="'+version+'";'));assert.ok(html.includes('onRequestSaved:()=>El()'));assert.ok(html.includes('onClick:()=>mEditRequest(t,onRequestSaved)'));assert.ok(html.includes('if(act==="edit_request")return J(await mEditRequestSave(b));'));
});
