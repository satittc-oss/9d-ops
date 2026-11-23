// v16.78 ศูนย์ข้อมูลงาน แบบแผนผัง Flow (โหนด ไม่มีจุด)
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const seg=html.slice(html.indexOf('/* ===== v16.78 ศูนย์ข้อมูลงาน'),html.indexOf('function dvRkSeg(cur){'));
test('แผนผัง: คอลัมน์ เซลส์ → Engineer → รับงาน → ขั้นตอน → ปิดงาน และเส้นรวมจำนวนงาน',()=>{
 const c={Hd:['A','B'],SUBORD:['recv','design','sent'],SUBST:{recv:{},design:{z:'E'},sent:{z:'S'}},STEPCOL:{recv:'#1',design:'#2',sent:'#3'},RK_ZONE:{E:{who:'เรา'},S:{who:'Sales'}},FLW_STEPIC:{},mCardName:k=>({label:k,who:''})};vm.createContext(c);vm.runInContext(seg+';this.dvRkFlow=dvRkFlow',c);
 const j=(pid,sid,s,ei,st,over)=>({pid,sid,s,ei,st,over,col:'#c'});
 const J=[j('p1','a','pending',-2,''),j('p2','a','active',0,'design',true),j('p3','a','active',1,'sent')],D={sales:[{id:'a',name:'Ann@x',col:'#c',jobs:J}],jobs:J,closed:[{pid:'p4',sid:'a',s:'won'}]};
 const F=c.dvRkFlow(D),ids=F.nodes.map(n=>n.id);
 for(const k of['s:a','m:gate','m:e0','m:e1','z:recv','z:design','z:sent','z:CLS','c:won','c:lost'])assert.ok(ids.includes(k),k);
 assert.equal(F.nodes.find(n=>n.id==='s:a').t,'Ann');assert.ok(F.nodes.find(n=>n.id==='z:design').warn);
 const e=(a,b)=>F.edges.find(x=>x.from===a&&x.to===b);assert.ok(e('s:a','m:gate'));assert.equal(e('m:e0','z:recv').label,'1');assert.equal(e('z:recv','z:sent').label,'1');assert.ok(e('z:sent','z:CLS'));
 assert.ok(F.map['s:a'].has('p2'))});
test('ใช้เป็นมุมมองหลัก + พื้นเรียบไม่มีจุด',()=>{assert.match(html,/\[\["flow","แผนผัง Flow"\],\["3d"/);assert.match(html,/DV\.rkv=DV\.rkv\|\|"flow"/);assert.match(html,/\.flw-wrap\.plain \.flw-vp\{background-image:none/)});
