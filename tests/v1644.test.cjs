// v16.44 ข้อมูลสมมติทั้งหมด: เงื่อนไข System Warranty ต่อบริษัท + round-trip นำเข้า/ส่งออกใบเสนอราคา (Excel) + แท็บ AEM
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(a,b){let i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j)}
class PvErr extends Error{constructor(m,s){super(m);this.status=s}}
function ctx(values,source){let c={console,Date,Math,Map,Set,Promise,JSON,Number,String,Array,Object,parseFloat,isFinite,...values};c.window=c;vm.createContext(c);vm.runInContext(source,c);return c}

// ---- ข้อ 3: เงื่อนไข System Warranty ต่อบริษัท (นับเฉพาะใบที่ยังไม่หมดอายุ) ----
function certCtx(){return ctx({PvErr,M:{cache:{settings:{}}},dvToday:()=> '2026-10-22'},between('var CERT_COURSES=','var CERT_COLS='));}
const cert=(code,expiry)=>({code,expiry});
test('Netconnect ครบเมื่อ ACT I×2 ACT II×2 ACT III×1 จากใบที่ยังไม่หมดอายุ',()=>{
 let c=certCtx(),recs=[cert('ND3801','2027-01-01'),cert('ND3801','2027-01-01'),cert('ND3802','2027-01-01'),cert('ND3802','2027-01-01'),cert('ND3803','2027-01-01')];
 let w=c.mCertQualify(recs);assert.equal(w.NETCONNECT.met,true);assert.equal(w.NETCONNECT.any,true);assert.equal(w.SYSTIMAX.any,false);assert.equal(c.mCertCompliant(recs),true);
});
test('ใบ ACT II ที่หมดอายุไม่ถูกนับ ทำให้ยังไม่ครบ และบอกจำนวนที่ขาด',()=>{
 let c=certCtx(),recs=[cert('ND3801','2027-01-01'),cert('ND3801','2027-01-01'),cert('ND3802','2027-01-01'),cert('ND3802','2020-01-01'),cert('ND3803','2027-01-01')];
 let w=c.mCertQualify(recs);assert.equal(w.NETCONNECT.met,false);
 let miss=w.NETCONNECT.missing.find(m=>m.t==='ACT2');assert.equal(miss.short,1);assert.equal(miss.have,1);assert.equal(c.mCertCompliant(recs),false);
});
test('Systimax: SP3351 (Recert) นับได้ทั้ง I&M และ D&E',()=>{
 let c=certCtx();
 // I&M ต้อง 3, D&E ต้อง 1 — ใช้ I&M 2 ใบ + SP3351 1 ใบ (เติม I&M ใบที่ 3 และ D&E ใบเดียว)
 let recs=[cert('ND3361','2027-01-01'),cert('ND3361','2027-01-01'),cert('SP3351','2027-01-01')];
 let w=c.mCertQualify(recs);assert.equal(w.SYSTIMAX.have.IM,3);assert.equal(w.SYSTIMAX.have.DE,1);assert.equal(w.SYSTIMAX.met,true);
});
test('ไม่มีใบของแบรนด์ = any:false จึงไม่ met และไม่ถือว่า compliant',()=>{
 let c=certCtx(),w=c.mCertQualify([cert('ND3361','2027-01-01')]);
 assert.equal(w.NETCONNECT.any,false);assert.equal(w.NETCONNECT.met,false);
 assert.equal(c.mCertCompliant([cert('ND3361','2027-01-01')]),false);// Systimax ยังไม่ครบ (ขาด I&M/D&E)
});

// ---- ข้อ 1: แท็บ "ยังไม่ครบกำหนด" ----
test('หน้า AEM Calibration มีตัวกรองและแท็บ ยังไม่ครบกำหนด (st==="ok")',()=>{
 assert.ok(html.includes('notdue:u=>u.st==="ok"'));
 assert.ok(html.includes('["notdue","ยังไม่ครบกำหนด"'));
});

// ---- ข้อ 2: Export Template + Import ใบเสนอราคา (Excel) round-trip ----
const XLSX=require(path.join(__dirname,'../vendor/xlsx.full.min.js'));
function qtCtx(){return ctx({PvErr,XLSX,document:{createElement:()=>({}),head:{appendChild(){}}},mEsc:v=>String(v??'')},between('var qtN=','window.dvQtForm='));}
test('นำเข้า Excel อ่านหัวใบเสนอราคาและรายการตาม key/คอลัมน์ ถูกต้อง',async()=>{
 let c=qtCtx();
 // สร้างไฟล์ตามโครงสร้าง Template: ชีต "หัวใบเสนอราคา" (key,label,value) + ชีต "รายการ"
 let head=[['key','ฟิลด์','ค่า'],['job','x','P-001'],['cust.name','x','บริษัท ทดสอบ จำกัด'],['cust.tel','x','021234567'],['validDays','x','45'],['vat','x','0'],['date','x','2026-10-22']];
 let items=[['รหัส','รายละเอียด','จำนวน','หน่วย','ราคา','ส่วนลด','ต้นทุน'],['A1','สายแลน',2,'ชุด',100,10,60],['B2','หัวต่อ',5,'ตัว',20,0,8]];
 let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(head),'หัวใบเสนอราคา');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(items),'รายการ');
 let buf=XLSX.write(wb,{type:'array',bookType:'xlsx'}),file={arrayBuffer:async()=>buf};
 let data=await c.qtXlRead(file);
 assert.equal(data.job,'P-001');assert.equal(data.cust.name,'บริษัท ทดสอบ จำกัด');assert.equal(data.cust.tel,'021234567');
 assert.equal(data.validDays,45);assert.equal(data.vat,0);assert.equal(data.date,'2026-10-22');
 assert.equal(data.items.length,2);assert.deepEqual(JSON.parse(JSON.stringify(data.items[0])),{code:'A1',desc:'สายแลน',qty:2,unit:'ชุด',price:100,disc:10,cost:60});
 assert.equal(data.items[1].qty,5);assert.equal(data.items[1].price,20);
});
test('Template ที่ส่งออกอ่านกลับได้ค่าเดิม (round-trip) ผ่าน qtXlRead',async()=>{
 let c=qtCtx(),captured;
 // แทน writeFile เพื่อจับ workbook แล้วเขียนเป็น buffer อ่านกลับ
 let realWrite=XLSX.writeFile;XLSX.writeFile=(wb)=>{captured=wb};
 try{await c.qtXlTemplate({no:'QX2610-000001',job:'JOB9',cust:{name:'ลูกค้า A',email:'a@x.co'},validDays:30,vat:7,items:[{code:'C1',desc:'ของ',qty:3,unit:'ชุด',price:50,disc:5,cost:30}]});}
 finally{XLSX.writeFile=realWrite}
 assert.ok(captured,'qtXlTemplate ต้องเรียก writeFile');
 let buf=XLSX.write(captured,{type:'array',bookType:'xlsx'}),data=await c.qtXlRead({arrayBuffer:async()=>buf});
 assert.equal(data.job,'JOB9');assert.equal(data.cust.name,'ลูกค้า A');assert.equal(data.cust.email,'a@x.co');assert.equal(data.vat,7);
 assert.equal(data.items.length,1);assert.deepEqual(JSON.parse(JSON.stringify(data.items[0])),{code:'C1',desc:'ของ',qty:3,unit:'ชุด',price:50,disc:5,cost:30});
});
