// v16.76 ชุดสีขั้นตอนงาน/กราฟ ในตั้งค่า Workspace
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const seg=html.slice(html.indexOf('var M_COL_UP='),html.indexOf('function mWfApply(s){'));
function ctx(){const c={STEPCOL:{recv:'#2B5FB4',sales:'#3A8FD0',sent:'#A85A28',delivered:'#A85A28',closed:'#4A5263',custom1:'#123456'},SB_SEG:[['delivered','x','#A85A28']]};c.STEPCOL0={...c.STEPCOL};vm.createContext(c);vm.runInContext(seg+';this.STEP_PALS=STEP_PALS;this.STEPCOL_WF=STEPCOL_WF;',c);return c}
test('เลือกชุดสี + ปรับเองทีละขั้น + สีที่ตั้งเองใน Workflow',()=>{const c=ctx();
 c.mStepColApply({palette:'deep',stepColors:{}});assert.equal(c.STEPCOL.recv,'#1F4A8C');assert.equal(c.STEPCOL.delivered,c.STEPCOL.sent);assert.equal(c.SB_SEG[0][2],c.STEPCOL.sent);assert.equal(c.STEPCOL.custom1,'#123456');
 c.mStepColApply({palette:'muted',stepColors:{sales:'#FF00AA'}});assert.equal(c.STEPCOL.sales,'#FF00AA');assert.equal(c.STEPCOL.recv,'#2B5FB4');
 c.STEPCOL_WF.recv='#005CB9';c.mStepColApply({palette:'soft'});assert.equal(c.STEPCOL.recv,'#5B8BD9','สีมาตรฐานเดิมใน Workflow ใช้ชุดสีที่เลือก');
 c.STEPCOL_WF.recv='#112233';c.mStepColApply({palette:'soft'});assert.equal(c.STEPCOL.recv,'#112233','สีที่ตั้งเองใน Workflow คงไว้');
 c.mStepColApply(null);assert.equal(c.STEPCOL.sales,'#3A8FD0')});
test('ตรวจค่าธีม: ชุดสี/สีขั้นตอน + หน้า ตั้งค่า มีส่วนเลือกสี',()=>{
 assert.match(html,/palette:'muted',stepColors:\{\}/);assert.match(html,/if\(!\['muted','soft','deep','vivid'\]\.includes\(t\.palette\)\)throw/);
 assert.match(html,/function wsPalPanel\(d\)/);assert.match(html,/data-stepcol=/);assert.match(html,/onclick="wsColorSettings\(\)">เปลี่ยนสี/);
 assert.match(html,/if\(input\.afterTitle==='หลังส่งงาน'\)input=\{\.\.\.input,afterTitle:'ปิดโครงการ'\}/)});
