// v16.35 ทดสอบด้วย Playwright + Chromium และข้อมูลสมมติ ปิดกั้นคำขอภายนอกทั้งหมด
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),outputs=process.env.FLOW3D_ARTIFACTS||fs.mkdtempSync(path.join(require('node:os').tmpdir(),'9d-flow3d-'));
const now=Date.now(),ago=days=>new Date(now-days*86400000).toISOString();
const defs=[['pending','recv'],['active','design'],['active','sup'],['active','price'],['active','buy'],['active','sales'],['active','cust'],['active','quote'],['delivered','recv'],['won','recv'],['lost','recv'],['cancelled','recv'],['rejected','recv']];
const projects=defs.map(([state,sub],i)=>({id:'sp-'+(i+1),listItemId:String(i+1),code:'TEST-'+String(i+1).padStart(3,'0'),name:'โครงการทดสอบ '+(i+1),client:'ลูกค้าทดสอบ '+(i%3+1),accountId:i===12?'acc-other@example.invalid':'acc-user@example.invalid',engineer:i===0?'':'วิศวกร '+(i%2?'ก.':'ข.'),priority:i===2?'urgent':'normal',listApproval:state==='pending'?'pending':state==='rejected'?'rejected':'approved',pstat:{s:state,at:ago(6)},sub:{sub,at:ago(i%4+1)},nextAction:'ตรวจข้อมูลและประสานงานขั้นตอนถัดไป',createdAt:ago(10),updatedAt:ago(i/10)}));
const st={projects,accounts:[{id:'acc-user@example.invalid',name:'ฝ่ายขายตัวอย่าง'},{id:'acc-other@example.invalid',name:'ฝ่ายขายอื่น'}],activities:[],syncJobs:[]};
let app=fs.readFileSync(root+'/index.html','utf8').replace(/clientId:"[0-9a-f-]{36}"/,'clientId:"11111111-1111-1111-1111-111111111111"').replace(/<link[^>]+href="https:\/\/fonts\.googleapis\.com[^"\n]*"[^>]*>/g,'');
const hook=`
window.__flowTest={async start(role='engineer'){
 M.profile={name:'วิศวกรตัวอย่าง',email:'user@example.invalid'};M.role=role;M.isAdmin=role==='admin';M.cache={items:[],track:{},settings:{}};
 window.testState=${JSON.stringify(st)};window.testFail=false;mLoad=async()=>M.cache;mState=async()=>{if(window.testFail)throw Error('mock offline');return window.testState};
 mPStat=p=>p.listApproval==='pending'?'pending':p.listApproval==='rejected'?'rejected':p.pstat.s;
 mSubOf=p=>{const m=SUBST[p.sub.sub],days=Math.floor((Date.now()-Date.parse(p.sub.at))/864e5);return{...p.sub,m,days,over:m.warn>0&&days>=m.warn}};
 document.body.innerHTML='<nav class="sidebar"><button class="nav-item">ภาพรวม</button><button class="nav-item">รออนุมัติ</button></nav><main class="main-content" style="margin-left:260px;max-width:calc(100% - 260px);padding:24px"><section id="dashv"></section></main>';
 document.body.classList.add('dv-on','dv-page');dvNav([...document.querySelectorAll('.sidebar .nav-item')]);DV.page='flow3d';DV.stAt=0;await dvRender();
 },send:refresh=>dvFlowSend(refresh),role:r=>{M.role=r},page:()=>DV.page,stop:()=>dvFlowStop(),timer:()=>DV.flowTm,state:()=>window.testState};
`;
assert.ok(app.includes('boot();})();'));app=app.replace('boot();})();',hook+'})();');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/integration.html'){res.setHeader('Content-Type','text/html');res.end(app);return}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/flow3d.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':'application/octet-stream');let body=fs.readFileSync(file);if(file.endsWith('/flow3d.html'))body=body.toString().replace('return{update,highlight,resize,draw,dispose};','window.__flowSceneTest={tokens,renderer,camera,scene,jobs:()=>tokenJobs};return{update,highlight,resize,draw,dispose};');res.end(body)}catch{res.writeHead(404).end()}
});
(async()=>{
 fs.mkdirSync(outputs,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const errors=[],external=[],writes=[];
 async function context(options={}){const c=await browser.newContext(options);await c.route('**/*',r=>{const u=new URL(r.request().url());if(!u.href.startsWith(base+'/')){external.push(u.href);return r.abort()}if(r.request().method()!=='GET')writes.push(r.request().url());return r.continue()});c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c}
 try{
  const c=await context({viewport:{width:1600,height:1100}}),p=await c.newPage();await p.goto(base+'/flow3d.html');await p.waitForSelector('.node-label');await p.waitForFunction(()=>document.getElementById('total').textContent==='14');
  assert.equal(await p.locator('#view3d').isDisabled(),false);assert.match(await p.locator('#mode').innerText(),/ข้อมูลตัวอย่าง/);assert.ok(await p.locator('.node-label').count()===7);assert.equal(await p.evaluate(()=>document.querySelector('#canvas').getContext('webgl2')!==null||document.querySelector('#canvas').getContext('webgl')!==null),true);
  await p.locator('#filter').selectOption('all');await p.waitForTimeout(500);
  const color=await p.evaluate(()=>{const d=__flowSceneTest,i=d.jobs().findIndex(j=>j.over),m=new THREE.Matrix4(),v=new THREE.Vector3(),size=new THREE.Vector2(),pixel=new Uint8Array(4);d.tokens.getMatrixAt(i,m);v.setFromMatrixPosition(m);v.project(d.camera);d.renderer.getDrawingBufferSize(size);d.renderer.render(d.scene,d.camera);const gl=d.renderer.getContext();gl.readPixels(Math.floor((v.x*.5+.5)*size.x),Math.floor((v.y*.5+.5)*size.y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return{pixel:Array.from(pixel),capacity:d.tokens.instanceColor.count,count:d.tokens.count}});
  assert.equal(color.capacity,84);assert.ok(color.pixel[0]>200&&color.pixel[1]>100&&color.pixel[2]<180,JSON.stringify(color));console.log('PASS rendered overdue marker is amber; instance color buffer supports every stage');await p.screenshot({path:outputs+'/flow3d-desktop.png',fullPage:true});
  const before=await p.locator('#canvas').screenshot();await p.locator('#rotateRight').click();await p.waitForTimeout(100);const after=await p.locator('#canvas').screenshot();assert.notDeepEqual(before,after);
  await p.locator('#motion').click();await p.locator('#search').fill('DEMO-005');await p.waitForFunction(()=>document.querySelectorAll('.job-list li').length===1);await p.locator('[data-job="sp-5"]').click();assert.match(await p.locator('.job-detail').innerText(),/ซัพพลายเออร์/);assert.equal(await p.locator('#openProject').isDisabled(),true);
  await p.locator('#clearSelection').click();await p.locator('#clearSelection').click();await p.locator('#search').fill('ไม่พบแน่');assert.equal(await p.locator('#empty').isVisible(),true);await p.locator('#search').fill('');
  await p.locator('#viewList').click();assert.equal(await p.locator('#scene').isVisible(),false);assert.equal(await p.locator('.job-list li').count(),14);await p.locator('#view3d').click();assert.equal(await p.locator('#scene').isVisible(),true);
  console.log('PASS standalone: WebGL, controls, search, detail, empty, list fallback');
  const mobile=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),mp=await mobile.newPage();await mp.goto(base+'/flow3d.html');await mp.waitForFunction(()=>document.getElementById('total').textContent==='14');await mp.screenshot({path:outputs+'/flow3d-mobile.png',fullPage:true});assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mp.locator('#search').fill('DEMO-004');await mp.locator('[data-job="sp-4"]').click();assert.equal(await mp.locator('.job-detail').isVisible(),true);await mp.locator('#zoomIn').click();await mp.locator('#topView').click();console.log('PASS mobile 390: no page overflow, search, detail and controls');
  const rc=await context({viewport:{width:1280,height:900},reducedMotion:'reduce'}),rp=await rc.newPage();await rp.goto(base+'/flow3d.html');await rp.waitForSelector('.node-label');assert.equal(await rp.locator('#motion').getAttribute('aria-pressed'),'true');console.log('PASS reduced motion');
  const noGL=await context({viewport:{width:1000,height:800}});await noGL.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/i.test(t)?null:get.call(this,t,...a)}});const np=await noGL.newPage();await np.goto(base+'/flow3d.html');await np.waitForFunction(()=>document.getElementById('total').textContent==='14');assert.equal(await np.locator('#view3d').isDisabled(),true);assert.match(await np.locator('#notice').innerText(),/แสดงผล 3D ไม่ได้/);await np.locator('#filter').selectOption('closed');assert.equal(await np.locator('.job-list li').count(),3);console.log('PASS no WebGL: usable list and filters');
  const ip=await c.newPage();await ip.goto(base+'/integration.html');await ip.evaluate(()=>window.__flowTest.start());await ip.waitForSelector('#dvnav-flow3d');const frame=ip.frameLocator('.dv-flowf');await frame.locator('#total').waitFor();await ip.waitForFunction(()=>document.querySelector('.dv-flowf')?.contentDocument?.getElementById('total')?.textContent==='13');assert.match(await frame.locator('#mode').innerText(),/เชื่อมต่อข้อมูลแล้ว/);assert.equal(await ip.locator('#dvnav-city').count(),1);assert.equal(await ip.locator('#dvnav-flow3d').count(),1);assert.equal(await frame.locator('[data-stage="supplier"] b').innerText(),'2');
  await ip.locator('.dv-hact button').click();assert.equal(await ip.locator('body').evaluate(e=>e.classList.contains('dv-flowfull')),true);await frame.locator('#canvas').press('Escape');await ip.waitForFunction(()=>!document.body.classList.contains('dv-flowfull'));
  await frame.locator('#search').fill('TEST-003');await frame.locator('[data-job="sp-3"]').click();assert.equal(await frame.locator('#openProject').isEnabled(),true);assert.match(await frame.locator('.job-detail').innerText(),/ซัพพลายเออร์/);
  await ip.evaluate(()=>{testState.projects[2].sub={sub:'buy',at:new Date().toISOString()};return __flowTest.send(true)});await frame.locator('.detail-stage').getByText('ประสานจัดซื้อ').waitFor();assert.equal(await frame.locator('#panelTitle').innerText(),'TEST-003');
  await ip.evaluate(()=>{testFail=true;return __flowTest.send(true)});await frame.locator('#mode').getByText('โหลดข้อมูลไม่ได้').waitFor();assert.equal(await frame.locator('#panelTitle').innerText(),'TEST-003');
  await ip.evaluate(()=>{testFail=false;return __flowTest.send(true)});await frame.locator('#mode').getByText('เชื่อมต่อข้อมูลแล้ว').waitFor();
  await ip.evaluate(()=>{testState.projects[2].name='<img src=x onerror="window.__bad=1">';return __flowTest.send(true)});assert.equal(await frame.locator('.job-detail img').count(),0);assert.match(await frame.locator('.job-detail h3').innerText(),/<img src=x/);
  await frame.locator('#openProject').click();await ip.waitForFunction(()=>__flowTest.page()==='projects');assert.equal(await ip.locator('.dv-flowf').count(),0);assert.equal(await ip.evaluate(()=>__flowTest.timer()),0);console.log('PASS app: separate nav, state mapping, snapshot refresh, error/recovery, XSS escaping, open project and cleanup');
  const sp=await c.newPage();await sp.goto(base+'/integration.html');await sp.evaluate(()=>__flowTest.start('sales'));await sp.waitForFunction(()=>document.querySelector('.dv-flowf')?.contentDocument?.getElementById('total')?.textContent==='12');const sf=sp.frameLocator('.dv-flowf');assert.match(await sf.locator('#scope').innerText(),/เฉพาะโครงการของคุณ/);await sf.locator('#filter').selectOption('all');assert.equal(await sf.locator('[data-job="sp-13"]').count(),0);console.log('PASS Sales privacy: other department/account project excluded');
  assert.equal(writes.length,0);assert.equal(errors.length,0,errors.join('\n'));assert.equal(external.length,0,external.join('\n'));console.log('PASS no external requests or writes; no page errors');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
