// v16.59 อนุญาตบัญชี @afternine.co.th เข้าสู่ระบบ
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('CFG อนุญาตทั้ง ninedistribution.com และ afternine.co.th',()=>{
 let m=html.match(/var CFG=Object\.assign\(\{[^]*?allowedDomains:(\[[^\]]*\])/);assert.ok(m);let d=JSON.parse(m[1]);
 assert.ok(d.includes('ninedistribution.com'));assert.ok(d.includes('afternine.co.th'));
 assert.ok(html.includes('dom=String(pr.email.split("@")[1]||"").toLowerCase()'))});
