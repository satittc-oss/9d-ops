// v16.77 แผนภาพ Flow แบบโหนด ในหน้า ตั้งค่า Workflow
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const seg=html.slice(html.indexOf('/* ===== v16.77 แผนภาพ Flow'),html.indexOf('var WFD=null;'));
function ctx(){const c={mEsc:s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])),STEPCOL:{},WF_TRIG:{approved:'อนุมัติคำขอ',stuck:'ค้างในขั้นตอนเกิน N วัน'},WF_ACT:{teams:'โพสต์ข้อความใน Teams Channel'},mPStatName:k=>k,innerWidth:1440,
 mPStat:p=>p.s,mSubOf:p=>p.b};vm.createContext(c);vm.runInContext(seg+';this.flwMain=flwMain;this.flwRules=flwRules;this.flwMapHtml=flwMapHtml;this.flwStats=flwStats;',c);return c}
const steps=[{k:'recv',t:'รับงานแล้ว',who:'เรา',color:'#2B5FB4'},{k:'design',t:'ทำ BOM',who:'เรา'},{k:'sent',t:'ส่งงานแล้ว',who:'ทีมขาย',tag:'#ส่งงานแล้ว'}];
const st={projects:[{id:'sp-1',s:'active',b:{sub:'design',over:1}},{id:'sp-2',s:'active',b:{sub:'design'}},{id:'sp-3',s:'pending'},{id:'sp-4',s:'won'},{id:'sp-5',s:'active',b:{sub:'sent',held:{}}}]};
test('นับงานต่อโหนด + เส้นทางหลักครบ',()=>{const c=ctx(),s=c.flwStats(st);assert.equal(s.step.design,2);assert.equal(s.over.design,1);assert.equal(s.pending,1);assert.equal(s.won,1);assert.equal(s.held.sent,1);
 const m=c.flwMain(steps,st),ids=m.nodes.map(n=>n.id);for(const k of['trig','wait','gate','rej','chan','s:recv','s:design','s:sent','close','c:won','c:lost','c:cancelled'])assert.ok(ids.includes(k),k);
 assert.ok(m.edges.some(e=>e.back&&e.from==='s:sent'&&e.to==='s:design'),'เส้นส่งกลับมาแก้');
 const d=m.nodes.find(n=>n.id==='s:design');assert.equal(d.n,2);assert.equal(d.warn,true);assert.equal(d.go,'step:design')});
test('กฎ: เมื่อ → ถ้า → ให้ทำ · กฎปิดจาง',()=>{const c=ctx(),r=c.flwRules([{name:'A',on:false,trigger:{type:'approved'},cond:{brand:'CommScope'},actions:[{type:'teams',text:'x'},{type:'teams'}]}],steps);
 assert.equal(r.nodes.filter(n=>n.id.startsWith('a0_')).length,2);assert.ok(r.nodes.find(n=>n.id==='c0'));assert.ok(r.nodes.every(n=>n.off));assert.ok(r.edges.every(e=>e.dim));
 const h=c.flwMapHtml(steps,[],st);assert.match(h,/flw-wrap/);assert.match(h,/ยังไม่มีกฎอัตโนมัติ/);assert.doesNotMatch(h,/<script/)});
test('หน้า Workflow มีแท็บแผนภาพเป็นแท็บแรก',()=>{assert.match(html,/let tabs=\[\["map","แผนภาพ Flow"\]/);assert.match(html,/flwWire\(host,g=>/);assert.match(html,/<style id="v1677">/)});
