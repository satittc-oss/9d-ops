// v16.70 สแกนด้วย ZXing-C++ (wasm) + Tesseract โฮสต์เอง · แบ่งสต็อกตามแบรนด์ · เอาเมืองจำลองออก · ฟอนต์ IBM Plex Sans Thai
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const part=html.slice(html.indexOf('/* ===== v16.60 สต็อกสินค้า Demo'),html.indexOf('var dvOver=L=>'));
const c={M:{stock:[]},mEsc:v=>String(v??''),mT:v=>Date.parse(v||0)||0,PvErr:Error,window:{},document:{},navigator:{},console,location:{href:'https://x.invalid/9d-ops/'}};vm.createContext(c);vm.runInContext(part,c);
test('เดาประเภทรหัสจากรูปแบบ',()=>{const g=v=>c.scanGuess(v);
 assert.equal(g('A0B1C2D3E4F5'),'mac');assert.equal(g('00:1A:1E:12:34:56'),'mac');assert.equal(g('FOC2345X1AB'),'sn');assert.equal(g('SG12KXZ4AB'),'sn');assert.equal(g('Q2XN-ABCD-1234'),'sn');
 assert.equal(g('JL678A'),'pn');assert.equal(g('R8N85A'),'pn');assert.equal(g('C9200L-24T-4G'),'model');assert.equal(g('FG100FTK22012345'),'sn');assert.equal(g('0889296123456'),'barcode')});
test('เดายี่ห้อจาก S/N · P/N · รุ่น',()=>{assert.equal(c.scanBrand({sn:'FOC2345X1AB'}),'Cisco');assert.equal(c.scanBrand({pn:'JL678A'}),'HPE Aruba');assert.equal(c.scanBrand({sn:'FG100FTK22012345'}),'Fortinet');assert.equal(c.scanBrand({model:'RG-NBS3100-24GT4SFP'}),'Ruijie');assert.equal(c.scanBrand({sn:'XYZ'}),'')});
test('ชื่อแบรนด์มาตรฐาน (ตัวพิมพ์/ชื่อเรียกต่างกันรวมเป็นกลุ่มเดียว)',()=>{assert.equal(c.stkBrandN('cisco'),'Cisco');assert.equal(c.stkBrandN('FORTINET'),'Fortinet');assert.equal(c.stkBrandN('aruba'),'HPE Aruba');assert.equal(c.stkBrandN('',{name:'Aruba 6000 12G'}),'HPE Aruba');assert.equal(c.stkBrandN('Acme  Labs'),'Acme Labs');
 const g=c.stkBrandsOf([{brand:'cisco'},{brand:'Cisco'},{brand:''},{brand:'Fortinet'}]);assert.equal(JSON.stringify(g),JSON.stringify([['Cisco',2],['Fortinet',1],['',1]]))});
test('บาร์โค้ดที่ไม่มีหัวข้อ → ใส่ช่องตามประเภท + ยี่ห้อ, QR/DataMatrix ที่ใช้แล้วไม่ซ้ำเป็นชิป',()=>{let r=c.stkFuse([{v:'SG12KXZ4AB',f:'CODE128'},{v:'JL678A',f:'CODE128'},{v:'001A1E123456',f:'CODE128'}],'');
 assert.equal(r.f.sn,'SG12KXZ4AB');assert.equal(r.f.pn,'JL678A');assert.equal(r.f.mac,'00:1A:1E:12:34:56');assert.equal(r.f.brand,'HPE Aruba');
 assert.equal(c.stkUsed('[)>\x1e06\x1d1PR8N85A\x1dSCN12345678\x1e\x04',{pn:'R8N85A',sn:'CN12345678'}),true);assert.equal(c.stkUsed('001A1E123456',{mac:'00:1A:1E:12:34:56'}),true);assert.equal(c.stkUsed('ZZZ999',{sn:'X'}),false);
 assert.equal(c.scanTxt('[)>␞06␝1PX'),'[)>\x1e06\x1d1PX')});
test('ไลบรารีสแกนโฮสต์เองใน vendor/scan (ไม่พึ่ง CDN)',()=>{for(const f of['zxing-reader.js','zxing_reader.wasm','tesseract.min.js','worker.min.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-lstm.wasm.js','lang/eng.traineddata.gz'])assert.ok(fs.existsSync(__dirname+'/../vendor/scan/'+f),f);
 assert.match(html,/var SCAN_BASE="vendor\/scan\/"/);assert.match(html,/async function stkBarcodes\(cv,fast\)\{try\{return await scanCodes\(cv,fast\)\}/);assert.match(html,/async function stkWorker\(\)\{return scanOcrWorker\(\);/)});
test('เอาเมืองจำลองออก · ฟอนต์ IBM Plex Sans Thai · โลโก้เล็กลง',()=>{assert.ok(!html.includes('["city","เมืองจำลอง 3D"]'));assert.match(html,/if\(DV\.rkv==="city"\)DV\.rkv=/);
 assert.match(html,/family=IBM\+Plex\+Sans\+Thai/);assert.ok(!html.includes('family=Noto+Sans+Thai'));assert.ok(!html.includes('family=Mitr'));assert.match(html,/<style id="v1670">[\s\S]*--ibm:'IBM Plex Sans Thai'[\s\S]*\.sidebar \.brand-logo-frame\{width:108px!important/)});
