// ตัวอย่างสำหรับตรวจ UI เท่านั้น ไม่เข้าสู่ระบบหรือเรียก Microsoft 365 จริง
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),before=cp.execFileSync('git',['show','bebf7362d5e131fecfec82ffd67f9949eef4e9e3:index.html'],{cwd:root,encoding:'utf8',maxBuffer:5e6});
function page(html,count,baseline){
 const match=html.match(/new MutationObserver\([\s\S]*?\)\.observe\(document\.getElementById\("root"\),\{childList:!0,subtree:!0\}\);/);
 if(!match)throw Error('UI observer not found');
 html=html.replace(/clientId:"[0-9a-f-]{36}"/,'clientId:"11111111-1111-1111-1111-111111111111"').replace(/<link[^>]+href="https:\/\/fonts\.googleapis\.com[^"\n]*"[^>]*>/g,'');
 const hook=`
// ข้อมูลสมมติใช้ตรวจความเสถียรหน้าจอ ไม่มีสิทธิ์เขียนข้อมูลจริง
const UI_TEST={reads:0,stateCalls:0,renders:0,observers:0,delay:180,extraDelay:80,quoteDelay:2000};window.__uiTest=UI_TEST;
Hd.splice(0,Hd.length,'วิศวกรตัวอย่าง ก.','วิศวกรตัวอย่าง ข.','วิศวกรตัวอย่าง ค.');
CFG.engineers={'วิศวกรตัวอย่าง ก.':'engineer@example.invalid'};M.profile={oid:'mock-ui',name:'วิศวกรตัวอย่าง ก.',email:'engineer@example.invalid'};M.role='engineer';M.isApprover=false;M.isAdmin=false;
M.sid='mock-site';M.lid='mock-projects';M.tl='mock-tracking';M.listWebUrl='https://example.invalid/projects/AllItems.aspx';M.trackErr='';
M.cols=Object.fromEntries(Object.entries(M_COLS).map(([key,[label,name,type]])=>[key,{name,type,readOnly:false}]));
const uiNow=Date.now(),uiDate=d=>new Date(uiNow-d*864e5).toISOString(),put=(f,k,v)=>{if(M.cols[k])f[M.cols[k].name]=v};
const uiItems=[],uiTracking=[{id:'settings',fields:{ProjectItemId:0,Payload:JSON.stringify({accounts:{},members:[{name:M.profile.name,email:M.profile.email,role:'engineer'}],settings:{}})}}];
for(let i=0;i<${count};i++){
 const id=String(i+1),state=i%19===0?'won':i%11===0?'delivered':'active',approval=i%9===0?'Pending':'Approved',created=uiDate(i%70+1),fields={Title:'โครงการทดสอบ '+(i+1),Attachments:false};
 for(const[k,v]of Object.entries({code:'TST26'+String(i+1).padStart(4,'0'),name:'โครงการทดสอบ '+(i+1),client:'ลูกค้าตัวอย่าง '+(i%7+1),approval,latest:state==='active'?'In Progress':'Finish',winLoss:state==='won'?'WIN':'Process',source:'อีเมล',brands:['แบรนด์ตัวอย่าง'],workTypes:['ออกแบบ'],notes:'รายละเอียดงานตัวอย่างสำหรับตรวจหน้าจอ',urgency:'ปกติ'}))put(fields,k,v);
 uiItems.push({id,webUrl:'https://example.invalid/project/'+id,createdBy:{user:{email:'sales'+(i%8+1)+'@example.invalid',displayName:'ฝ่ายขายตัวอย่าง '+(i%8+1)}},createdDateTime:created,lastModifiedDateTime:uiDate(i%9),fields});
 const sub=SUBORD[i%SUBORD.length];uiTracking.push({id:'track-'+id,fields:{ProjectItemId:Number(id),TrackVersion:1,Payload:JSON.stringify({version:1,engineer:Hd[i%Hd.length],stage:approval==='Approved'?'approved':'pending',pstat:{s:state,at:uiDate(10)},sub:{sub,at:uiDate(i%15)},nextAction:'ตรวจข้อมูลและประสานงานขั้นตอนถัดไป',updatedAt:uiDate(i%9),activities:Array.from({length:8},(_,n)=>({id:'mock-'+id+'-'+n,actor:'ผู้ใช้ตัวอย่าง',action:'บันทึกความคืบหน้า',note:'บันทึกงานตัวอย่าง '.repeat(8),createdAt:uiDate(n)}))})}});
}
gAll=async url=>{UI_TEST.reads++;await new Promise(r=>setTimeout(r,UI_TEST.delay));if(url.includes('/lists/mock-projects/items'))return uiItems;if(url.includes('/lists/mock-tracking/items'))return uiTracking;throw Error('Mock request not allowed: '+url)};
G=async()=>{throw Error('ไม่มีคำสั่ง Microsoft จริงในตัวอย่างนี้')};SP=G;mInit=async()=>{};
const uiOriginalState=mState;mState=async(...args)=>{UI_TEST.stateCalls++;return uiOriginalState(...args)};
const uiOriginalRender=dvRender;dvRender=async(...args)=>{UI_TEST.renders++;return uiOriginalRender(...args)};
const uiExtra=async()=>{await new Promise(r=>setTimeout(r,UI_TEST.extraDelay));return[]};mLoans=uiExtra;mSvcItems=uiExtra;mCerts=uiExtra;
mQuotes=async()=>{await new Promise(r=>setTimeout(r,UI_TEST.quoteDelay));QT.items=[];return[]};
PV.projects=[];PV.activities=[];PV.accounts=[];PV.session={userId:'mock-ui',name:M.profile.name,email:M.profile.email,role:'engineer'};PV_PROFILE.name=M.profile.name;PV_PROFILE.email=M.profile.email;
window.__uiTestState=async()=>({page:DV.page,readQueue:!!M.loadPending,renderBusy:DV.busy,active:[...document.querySelectorAll('.sidebar .nav-item.active')].map(x=>x.textContent.trim()),stateCalls:UI_TEST.stateCalls,reads:UI_TEST.reads,renders:UI_TEST.renders});
const uiMO=window.MutationObserver;window.MutationObserver=class extends uiMO{constructor(fn){super((records,observer)=>{UI_TEST.observers++;fn(records,observer)})}};
async function uiStart(){await mLoad(true);document.getElementById('gate').style.display='none';const bar=document.querySelector('.offline-notice');bar.textContent='ข้อมูลจำลองสำหรับทดสอบ UI · ${baseline?'ก่อนแก้ v16.34':'ฉบับปรับความเสถียร'} · ไม่เชื่อมระบบบริษัท';bar.style.display='block';
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
  try{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page(u.pathname==='/before'?before:fs.readFileSync(root+'/index.html','utf8'),Math.max(20,Math.min(2000,Number(u.searchParams.get('n'))||360)),u.pathname==='/before'))}catch(e){res.writeHead(500).end(e.message)}return;
 }
 if(u.pathname.startsWith('/api/')){res.writeHead(403).end('mock only');return}
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
});
const uiTestPort=Number(process.env.UI_TEST_PORT)||8769;
server.listen(uiTestPort,'127.0.0.1',()=>console.log('UI mock preview http://127.0.0.1:'+uiTestPort+'/ · baseline /before'));
