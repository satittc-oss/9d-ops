// ตัวอย่างสำหรับตรวจ UI เท่านั้น ไม่เข้าสู่ระบบหรือเรียก Microsoft 365 จริง
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),before=cp.execFileSync('git',['show','bebf7362d5e131fecfec82ffd67f9949eef4e9e3:index.html'],{cwd:root,encoding:'utf8',maxBuffer:5e6});
function page(html,count,baseline,role='admin',people=120,orphans=2){
 const match=html.match(/new MutationObserver\([\s\S]*?\)\.observe\(document\.getElementById\("root"\),\{childList:!0,subtree:!0\}\);/);
 if(!match)throw Error('UI observer not found');
 html=html.replace(/clientId:"[0-9a-f-]{36}"/,'clientId:"11111111-1111-1111-1111-111111111111"').replace(/<link[^>]+href="https:\/\/fonts\.googleapis\.com[^"\n]*"[^>]*>/g,'');
 const hook=`
// ข้อมูลสมมติใช้ตรวจความเสถียรหน้าจอ ไม่มีสิทธิ์เขียนข้อมูลจริง
const UI_TEST={reads:0,stateCalls:0,renders:0,observers:0,delay:180,extraDelay:80,quoteDelay:2000};window.__uiTest=UI_TEST;
Hd.splice(0,Hd.length,'วิศวกรตัวอย่าง ก.','วิศวกรตัวอย่าง ข.','วิศวกรตัวอย่าง ค.');
CFG.allowedDomains=['example.invalid'];CFG.engineers={'วิศวกรตัวอย่าง ก.':'engineer@example.invalid'};M.profile={oid:'mock-ui',name:'ผู้ใช้ทดสอบ',email:'engineer@example.invalid'};M.role='${role}';M.isApprover=false;M.isAdmin=${role==='admin'};
M.sid='mock-site';M.lid='mock-projects';M.tl='mock-tracking';M.listWebUrl='https://example.invalid/projects/AllItems.aspx';M.trackErr='';
M.cols=Object.fromEntries(Object.entries(M_COLS).map(([key,[label,name,type]])=>[key,{name,type,readOnly:false}]));
const uiNow=Date.now(),uiDate=d=>new Date(uiNow-d*864e5).toISOString(),put=(f,k,v)=>{if(M.cols[k])f[M.cols[k].name]=v};
const uiItems=[],uiTracking=[{id:'settings',fields:{ProjectItemId:0,Payload:JSON.stringify({quoteAccess:{v:1,listId:'mock-quotes'},accounts:{},members:[{name:M.profile.name,email:M.profile.email,role:'${role}'}],settings:{}})}}];
let uiSettingsVersion=1;let uiSettings=JSON.parse(uiTracking[0].fields.Payload);for(let i=1;i<=${people};i++)uiSettings.members.push({userId:'demo-user-'+i,name:'พนักงานตัวอย่าง '+String(i).padStart(3,'0'),email:'demo'+i+'@example.invalid',role:['viewer','sales','engineer'][i%3]});uiTracking[0].fields.Payload=JSON.stringify(uiSettings);
for(let i=0;i<${count};i++){
 const id=String(i+1),state=i%19===0?'won':i%11===0?'delivered':'active',approval=i%9===0?'Pending':'Approved',created=uiDate(i%70+1),fields={Title:'โครงการทดสอบ '+(i+1),Attachments:false};
 for(const[k,v]of Object.entries({code:'TST26'+String(i+1).padStart(4,'0'),name:'โครงการทดสอบ '+(i+1),client:'ลูกค้าตัวอย่าง '+(i%7+1),approval,latest:state==='active'?'In Progress':'Finish',winLoss:state==='won'?'WIN':'Process',source:'อีเมล',brands:['แบรนด์ตัวอย่าง'],workTypes:['ออกแบบ'],notes:'รายละเอียดงานตัวอย่างสำหรับตรวจหน้าจอ',urgency:'ปกติ'}))put(fields,k,v);
 uiItems.push({id,webUrl:'https://example.invalid/project/'+id,createdBy:{user:{email:'sales'+(i%8+1)+'@example.invalid',displayName:'ฝ่ายขายตัวอย่าง '+(i%8+1)}},createdDateTime:created,lastModifiedDateTime:uiDate(i%9),fields});
 const sub=SUBORD[i%SUBORD.length];uiTracking.push({id:'track-'+id,fields:{ProjectItemId:Number(id),TrackVersion:1,Payload:JSON.stringify({version:1,engineer:Hd[i%Hd.length],channelId:'channel-'+id,teamId:'mock-team',channelUrl:'https://example.invalid/teams/'+id,stage:approval==='Approved'?'approved':'pending',pstat:{s:state,at:uiDate(10)},sub:{sub,at:uiDate(i%15)},nextAction:'ตรวจข้อมูลและประสานงานขั้นตอนถัดไป',updatedAt:uiDate(i%9),activities:Array.from({length:8},(_,n)=>({id:'mock-'+id+'-'+n,actor:'ผู้ใช้ตัวอย่าง',action:'บันทึกความคืบหน้า',note:'บันทึกงานตัวอย่าง '.repeat(8),createdAt:uiDate(n)}))})}});
}
const mockQuote=(id,authorId)=>({id:String(id),eTag:'"v1"',createdBy:{user:{displayName:authorId===11?'ผู้ใช้ทดสอบ':'ผู้ใช้คนอื่น'}},fields:{Title:'QX2610-'+String(id).padStart(6,'0'),AuthorLookupId:String(authorId),QuoteStatus:id%2?'ร่าง':'ส่งลูกค้าแล้ว',DocJson:JSON.stringify({date:dvToday(),cust:{name:'ลูกค้าทดสอบ '+id},maker:authorId===11?'ผู้ใช้ทดสอบ':'ผู้ใช้คนอื่น',job:'DEMO26'+id,jobDes:'ระบบเครือข่ายตัวอย่าง',items:[{code:'DEMO-'+id,desc:'สินค้าจำลองสำหรับทดสอบ',qty:2,unit:'ชุด',price:1250,cost:900}],vat:7,quotedBy:'ผู้ใช้ทดสอบ'})}});
let mockQuotes=[mockQuote(7,11),mockQuote(8,22),mockQuote(9,11)],mockPolicy={ReadSecurity:2,WriteSecurity:2,HasUniqueRoleAssignments:true,EffectiveBasePermissions:{Low:2048}},mockArchived=new Set(),mockArchiveChecks=new Map();
gAll=async url=>{UI_TEST.reads++;await new Promise(r=>setTimeout(r,UI_TEST.delay));if(url.includes('/lists/mock-projects/items'))return uiItems;if(url.includes('/lists/mock-tracking/items'))return uiTracking;if(url.includes('/lists?'))return[{id:'mock-quotes',displayName:'9D Quotations'}];if(url.includes('/lists/mock-quotes/items?')){if(url.includes('fields/Title'))return[];return mockQuotes}throw Error('Mock request not allowed: '+url)};
G=async(url,o)=>{if(url.includes('/mock-tracking/items/settings'))return{id:'settings',eTag:'"v'+uiSettingsVersion+'"',fields:{Payload:uiTracking[0].fields.Payload}};if(url.includes('/operations/')){let id=url.split('/').pop();mockArchiveChecks.set(id,(mockArchiveChecks.get(id)||0)+1);if(mockArchiveChecks.get(id)>1)mockArchived.add(id);return{status:mockArchived.has(id)?'succeeded':'running'}}if(url.includes('/channels/')){let id=decodeURIComponent(url.match(/channels\\/([^?]+)/)[1]);return{id,displayName:TS.all.find(r=>r.channelId===id)?.name||'โครงการตัวอย่าง '+id,webUrl:'https://example.invalid/teams/'+id,isArchived:mockArchived.has(id)}}if(url.includes('/mock-quotes/items/')){let id=url.match(/items\\/(\\d+)/)[1],r=mockQuotes.find(q=>q.id===id);if(o?.method==='PATCH'){Object.assign(r.fields,o.json);r.eTag='"v2"';return{}}return r}if(url.endsWith('/mock-quotes/items')&&o?.method==='POST'){let r=mockQuote(100+mockQuotes.length,11);r.fields={...o.json.fields,AuthorLookupId:'11'};mockQuotes.push(r);return r}throw Error('Mock Graph request not allowed: '+url)};
SP=async(url,o)=>{if(o)return{};if(url.includes('/currentuser'))return{Id:11,Email:M.profile.email};if(url.includes('/sitegroups'))return{value:[{Id:100,Title:'Workspace Owners'},{Id:200,Title:'Workspace Members'}]};if(url.includes('associatedmembergroup'))return{Id:200};if(url.includes('associatedownergroup'))return{Id:100};if(url.includes('/roledefinitions/'))return{Id:url.includes('getbytype(3)')?3:5};if(url.includes('/roleassignments?'))return{value:[{PrincipalId:100,RoleDefinitionBindings:[{Id:5}]}]};return mockPolicy};mInit=async()=>{};
mToken=async()=> 'mock';mHttp=async(url,o,kind)=>{if(kind==='spadmin')return SP(url.split('/_api')[1],o);if(!url.startsWith(M_GRAPH+'/teams/mock-team/channels/')||!url.endsWith('/archive'))throw Error('No real network');let id=decodeURIComponent(url.split('/channels/')[1].split('/archive')[0]);UI_TEST.archivePosts=(UI_TEST.archivePosts||0)+1;return{status:202,headers:{get:()=>'/teams/mock-team/operations/'+id}}};
mSpUserId=async()=>11;mSaveSettings=async(settings,guard={})=>{if(guard.etag&&guard.etag!=='"v'+uiSettingsVersion+'"')throw new PvErr('Mock conflict',412);uiTracking[0].fields.Payload=JSON.stringify(settings);uiSettingsVersion++;M.cache.settings=settings;M.cacheAt=0};
mSaveTrack=async p=>{let t=uiTracking.find(x=>x.fields.ProjectItemId===Number(p.listItemId)),track=JSON.parse(t.fields.Payload);track.channelArchive=p.channelArchive;t.fields.Payload=JSON.stringify(track);M.cache.track[Number(p.listItemId)].channelArchive=p.channelArchive};
TS.at=new Date().toISOString();TS.channels={};TS.all=Array.from({length:28},(_,i)=>{let days=Object.fromEntries([9,19,6,2,37,34,5].map((v,j)=>[dvDay(uiNow-(6-j)*864e5),Math.max(0,Math.round(v*(i%5+1)/28))]));let r={pid:'sp-'+(i+1),channelId:'channel-'+(i+1),teamId:'mock-team',name:'DEMO26'+(i+1)+'_งานตัวอย่าง',teamName:'ทีมขาย '+(i%4+1),url:'https://example.invalid/teams/'+(i+1),days,last:uiDate(i%10),lastBy:'ฝ่ายขายตัวอย่าง',lastMent:['@ทั้ง Channel'],eng:{[Hd[i%3]]:{days}},recent:[{id:'m'+i,text:'ข้อความจำลองประสานงานโครงการ',at:uiDate(i%10),by:'ผู้ใช้ตัวอย่าง'}]};TS.channels[r.pid]=r;return r});
TS.extra=Array.from({length:${orphans}},(_,i)=>({pid:'teams-extra-'+(i+1),teamId:'mock-team',channelId:'orphan-'+(i+1),name:i===0?'DEMO27001_งานจาก Teams เดิม':i===1?'งานออกแบบระบบตัวอย่าง':'DEMO27'+String(i+1).padStart(3,'0')+'_งานตัวอย่าง',teamName:i%2?'ทีมวิศวกรตัวอย่าง':'ทีมขายตัวอย่าง',url:'https://example.invalid/teams/orphan-'+(i+1),days:{},eng:{}}));TS.all.push(...TS.extra);TS.live=TS.all.map(r=>r.channelId);mTeamsSync=async()=>{TS.at=new Date().toISOString();UI_TEST.syncs=(UI_TEST.syncs||0)+1;if(typeof mApprovalImportsInject==='function')mApprovalImportsInject();return TS};
const uiOriginalState=mState;mState=async(...args)=>{UI_TEST.stateCalls++;return uiOriginalState(...args)};
const uiOriginalRender=dvRender;dvRender=async(...args)=>{UI_TEST.renders++;return uiOriginalRender(...args)};
const uiExtra=async()=>{await new Promise(r=>setTimeout(r,UI_TEST.extraDelay));return[]};mLoans=uiExtra;mSvcItems=uiExtra;mCerts=uiExtra;
const originalQuotes=mQuotes;mQuotes=async(...args)=>{await new Promise(r=>setTimeout(r,80));return originalQuotes(...args)};
PV.projects=[];PV.activities=[];PV.accounts=[];PV.session={userId:'mock-ui',name:M.profile.name,email:M.profile.email,role:'${role}'};PV_PROFILE.name=M.profile.name;PV_PROFILE.email=M.profile.email;
window.__uiTestState=async()=>({page:DV.page,readQueue:!!M.loadPending,renderBusy:DV.busy,active:[...document.querySelectorAll('.sidebar .nav-item.active')].map(x=>x.textContent.trim()),stateCalls:UI_TEST.stateCalls,reads:UI_TEST.reads,renders:UI_TEST.renders});
const uiMO=window.MutationObserver;window.MutationObserver=class extends uiMO{constructor(fn){super((records,observer)=>{UI_TEST.observers++;fn(records,observer)})}};
async function uiStart(){await mLoad(true);document.getElementById('gate').style.display='none';const bar=document.querySelector('.offline-notice');bar.textContent='ข้อมูลจำลองสำหรับทดสอบ UI · ${baseline?'ก่อนแก้ v16.34':'v16.39 ปุ่มและรายการจาก Teams'} · ไม่เชื่อมระบบบริษัท';bar.style.display='block';
 (0,og.createRoot)(document.getElementById('root')).render((0,sg.jsx)(Xi,{}));
 ${match[0]}
 setTimeout(()=>{mNavInject();dvSync()},100);
 const stats=document.createElement('div');stats.id='ui-test-info';stats.style.cssText='position:fixed;right:8px;bottom:72px;z-index:9000;background:#e8f1fb;color:#23405e;border:1px solid #b8cbe4;border-radius:5px;padding:6px 9px;font:11px Tahoma;pointer-events:none;max-width:95vw';document.body.appendChild(stats);
 setInterval(()=>{stats.textContent='ข้อมูลทดสอบ ${count} งาน · อ่าน '+UI_TEST.reads+' คำขอ · วาด '+UI_TEST.renders+' รอบ · เมนูเลือก '+document.querySelectorAll('.sidebar .nav-item.active').length+' รายการ'},500);
}uiStart();
`;
 return html.replace('boot();})();',hook+'})();');
}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:");
 res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/'||u.pathname==='/before'){
  try{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page(u.pathname==='/before'?before:fs.readFileSync(root+'/index.html','utf8'),Math.max(20,Math.min(2000,Number(u.searchParams.get('n'))||360)),u.pathname==='/before',['admin','engineer','sales','viewer'].includes(u.searchParams.get('role'))?u.searchParams.get('role'):'admin',Math.max(0,Math.min(2000,Number(u.searchParams.get('people'))||120)),Math.max(0,Math.min(500,Number(u.searchParams.get('orphans')??2)||0))))}catch(e){res.writeHead(500).end(e.message)}return;
 }
 if(u.pathname.startsWith('/api/')){res.writeHead(403).end('mock only');return}
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
});
const uiTestPort=Number(process.env.UI_TEST_PORT)||8771;
server.listen(uiTestPort,'127.0.0.1',()=>console.log('UI mock preview http://127.0.0.1:'+uiTestPort+'/ · baseline /before'));
