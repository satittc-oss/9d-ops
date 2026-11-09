// v16.62 คนที่กดอนุมัติงานเท่านั้นที่สร้าง Channel ได้ (ข้อมูลสมมติ)
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const part=html.slice(html.indexOf('M.apv=M.apv||{};'),html.indexOf('async function mAutoChannels(){'));
function ctx(alog,versions,me){const c={M:{alog,profile:me,lid:'L',cols:{approval:{name:'RequestStatus'}}},console,mT:v=>Date.parse(v||0)||0,mNorm:s=>String(s||'').toLowerCase().replace(/[\s_·.\-\/]/g,''),calls:0};
 c.SP=async()=>{c.calls++;return{value:versions}};vm.createContext(c);vm.runInContext(part,c);return c}
const sat={name:'Satit T.',email:'satit@x.invalid'},sut={name:'Sutee K.',email:'sutee@x.invalid'};
test('อนุมัติผ่านเว็บ → ใช้ผู้อนุมัติจากประวัติ 9D และเฉพาะคนนั้นที่เป็น "ฉัน"',async()=>{const c=ctx({7:[{d:'approved',by:'Sutee K.',email:'SUTEE@x.invalid',at:'2026-11-09T03:00:00Z'}]},[],sat);
 const a=await c.mApproverOf({listItemId:7});assert.equal(a.email,'sutee@x.invalid');assert.equal(c.mIsMe(a),false);c.M.profile=sut;assert.equal(c.mIsMe(a),true);assert.equal(c.calls,0)});
test('อนุมัติใน Microsoft Lists โดยตรง → หาคนที่เปลี่ยน Request Status เป็น Approved จากประวัติเวอร์ชัน',async()=>{const v=[{VersionId:512,RequestStatus:'Pending',Editor:{LookupValue:'Asmaporn',Email:'asm@x.invalid'}},{VersionId:1024,RequestStatus:'Approved',Editor:{LookupValue:'Sutee K.',Email:'sutee@x.invalid'},Created:'2026-11-09T03:30:00Z'},{VersionId:1536,RequestStatus:'Approved',Editor:{LookupValue:'Satit T.',Email:'satit@x.invalid'}}];
 const c=ctx({},v,sat);const a=await c.mApproverOf({listItemId:8});assert.equal(a.name,'Sutee K.');assert.equal(a.how,'Microsoft Lists');assert.equal(c.mIsMe(a),false)});
test('ประวัติย้อนหลังที่ตั้งโดยระบบ (backfill) ไม่นับเป็นผู้อนุมัติ',async()=>{const c=ctx({9:[{d:'approved',by:'Satit T.',email:'satit@x.invalid',via:'backfill'}]},[],sat);assert.equal(await c.mApproverOf({listItemId:9}),null)});
test('สร้างเอง (ปุ่ม) ถูกกันด้วยกฎเดียวกัน',()=>{assert.match(html,/let apv=await mApproverOf\(p0\);if\(apv&&!mIsMe\(apv\)\)throw new PvErr\("สร้าง Channel ได้เฉพาะคนที่กดอนุมัติงานนี้/)});
