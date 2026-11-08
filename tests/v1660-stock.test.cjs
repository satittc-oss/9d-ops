// v16.60 สต็อกสินค้า Demo: อ่าน/เทียบรหัสจากภาพ และบันทึกแบบไม่ต้องเพิ่ม List ใหม่
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const part=html.slice(html.indexOf('/* ===== v16.60 สต็อกสินค้า Demo'),html.indexOf('var dvOver=L=>'));
function ctx(stock=[]){const calls=[],server=JSON.parse(JSON.stringify(stock));const c={M:{stock,role:'engineer',sid:'s',tl:'t',profile:{name:'วิศวกร ก.'}},mIsEng:()=>true,PvErr:class extends Error{constructor(m,s){super(m);this.status=s}},
 mT:v=>Date.parse(v||0)||0,pvNow:()=>'2026-11-09T03:00:00.000Z',mEsc:v=>String(v??''),mFsName:v=>String(v),mDrivePath:v=>v,M_GRAPH:'https://graph',calls,
 G:async(u,o)=>{calls.push([u,o]);if(o?.method==='POST')return{id:'99'};if(!o)return{fields:{Payload:JSON.stringify(server.find(x=>u.includes('/items/'+x.row))||{})}};return{}},
 mHttp:async(u,o)=>{calls.push([u,o]);return{name:'a.jpg',webUrl:'https://sp/a.jpg',id:'d1'}},window:{},document:{},console};
 vm.createContext(c);vm.runInContext(part,c);return c}
const items=[{id:'DM2611-AAAA',name:'Aruba CX 6100',model:'JL678A',sn:'SG12KL0ABC',barcode:'',status:'ready',sigs:['f0f0f0f0f0f0f0f0.'+'8'.repeat(48)],updatedAt:'2026-11-01T00:00:00Z',row:'5'},
 {id:'DM2611-BBBB',name:'FortiGate 40F',model:'FG-40F',sn:'FGT40FTK2209XYZ',barcode:'6900000000012',status:'out',updatedAt:'2026-11-02T00:00:00Z',row:'6'},
 {id:'DM2611-CCCC',name:'เครื่องที่ซ่อนแล้ว',sn:'HIDDEN123',deleted:true,row:'7'}];
test('อ่าน S/N และ P/N จากข้อความ OCR บนฉลาก',()=>{const c=ctx();const r=c.stkParse('HPE Aruba\nP/N: JL678A\nS/N: SG12KL0ABC\nMade in China');assert.deepEqual([...r.sn],['SG12KL0ABC']);assert.deepEqual([...r.pn],['JL678A'])});
test('S/N หรือบาร์โค้ดตรง = มีในระบบแล้ว; รุ่นตรงอย่างเดียวไม่นับเป็นเครื่องเดียวกัน; รายการที่ซ่อนไม่ถูกนับ',()=>{const c=ctx(items);
 let m=c.stkMatch({codes:['sg12-kl0abc']});assert.equal(m[0].it.id,'DM2611-AAAA');assert.equal(m[0].unit,true);
 m=c.stkMatch({codes:['6900000000012']});assert.equal(m[0].it.id,'DM2611-BBBB');assert.equal(m[0].unit,true);
 m=c.stkMatch({codes:['JL678A']});assert.equal(m[0].unit,false);
 m=c.stkMatch({text:'xx FGT40FTK2209XYZ yy'});assert.equal(m[0].it.id,'DM2611-BBBB');m=c.stkMatch({text:'S/N: SG12KLOABC'});assert.equal(m[0].it.id,'DM2611-AAAA');m=c.stkMatch({codes:['SN-FGT40FTK2209XYZ']});assert.equal(m[0].it.id,'DM2611-BBBB');
 assert.equal(c.stkMatch({codes:['HIDDEN123']}).length,0)});
test('เทียบภาพ: ลายเซ็นเหมือนกันได้ 100% และใช้แนะนำรายการ',()=>{const c=ctx(items);assert.equal(c.stkSim(items[0].sigs[0],items[0].sigs[0]),1);assert.ok(c.stkSim(items[0].sigs[0],'0f0f0f0f0f0f0f0f.'+'0'.repeat(48))<.5);
 const m=c.stkMatch({sig:items[0].sigs[0]});assert.equal(m[0].it.id,'DM2611-AAAA');assert.match(m[0].why.join(),/ภาพคล้าย 100%/)});
test('กัน S/N ซ้ำ และรวมแถวซ้ำโดยใช้ฉบับล่าสุด',()=>{const c=ctx(items);assert.equal(c.stkDup({id:'new',sn:'sg12kl0abc'}).o.id,'DM2611-AAAA');assert.equal(c.stkDup({id:'DM2611-AAAA',sn:'SG12KL0ABC'}),null);
 const r=c.stkMerge([{id:'A',name:'old',updatedAt:'2026-01-01'},{id:'A',name:'new',updatedAt:'2026-02-01'},{name:'no id'}]);assert.equal(r.length,1);assert.equal(r[0].name,'new')});
test('บันทึกเป็นแถว Tracking (ProjectItemId พิเศษ) และตรวจว่ามีคนแก้ก่อนหรือไม่',async()=>{const c=ctx(JSON.parse(JSON.stringify(items)));
 const n=await c.mStockSave({id:'DM2611-NEW1',name:'AP'});const post=c.calls.find(x=>x[1]?.method==='POST');assert.equal(post[1].json.fields.ProjectItemId,-9.5e9);assert.equal(post[1].json.fields.Title,'stock:DM2611-NEW1');assert.equal(n.row,'99');assert.equal(c.M.stock[0].id,'DM2611-NEW1');
 c.M.stock[1].updatedAt='2026-10-01T00:00:00Z';await assert.rejects(c.mStockSave({...c.M.stock[1],name:'x'}),/แก้ไขรายการนี้ไปก่อน/)});
test('โหลดแถวสต็อกใน mLoadData · หน้า stock เฉพาะ Engineer · ตัวอ่านภายนอกตรึงเวอร์ชันพร้อม SRI',()=>{assert.match(html,/else if\(pid===-9\.5e9\)stk\.push/);assert.match(html,/if\(\['loans','service','stock'\]\.includes\(key\)/);
 assert.match(html,/@zxing\/library@0\.21\.3\/umd\/index\.min\.js","sha384-/);assert.match(html,/tesseract\.js@5\.1\.1\/dist\/tesseract\.min\.js","sha384-/)});
