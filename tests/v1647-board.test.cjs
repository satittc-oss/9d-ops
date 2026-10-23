// v16.47 บอร์ดลากวาง + donut + หน้าภาพรวม (ข้อมูลสมมติ)
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(a,b){let i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j)}
const c={};vm.createContext(c);vm.runInContext(between('function dvBoardAction(c,t,o){','function dvAsk('),c);
const steps=['recv','design','price'],A=(card,t,o)=>JSON.parse(JSON.stringify(c.dvBoardAction(card,t,{steps,...o})??null));
test('ลากข้ามขั้นตอน = psub · คอลัมน์เดิม = ไม่ทำอะไร',()=>{
 assert.deepEqual(A({s:'active',sub:'recv'},'design',{eng:true}),{action:'psub',sub:'design'});
 assert.equal(A({s:'active',sub:'design'},'design',{eng:true}),null);
 assert.equal(A({s:'active',sub:''},'recv',{eng:true}),null);
});
test('ส่งงานแล้ว เฉพาะ Engineer · ปิดงานต้องยืนยัน · เปิดงานใหม่ต้องยืนยัน',()=>{
 assert.deepEqual(A({s:'active',sub:'recv'},'delivered',{eng:true}),{action:'pstatus',status:'delivered',ask:'deliver'});
 assert.match(A({s:'active',sub:'recv'},'delivered',{own:true}).err,/Engineer/);
 for(let t of ['won','lost','cancelled'])assert.deepEqual(A({s:'delivered'},t,{own:true}),{action:'pstatus',status:t,ask:'close'});
 assert.deepEqual(A({s:'delivered'},'design',{eng:true}),{action:'pstatus',status:'active',ask:'reopen'});
 assert.match(A({s:'won'},'lost',{eng:true}).err,/ปิดแล้ว/);
 assert.match(A({s:'active'},'closed',{eng:true}).err,/ชนะ/);
});
test('สิทธิ์: viewer และเซลส์ที่ไม่ใช่เจ้าของงานลากไม่ได้',()=>{
 assert.match(A({s:'active',sub:'recv'},'design',{role:'viewer',eng:true}).err,/สิทธิ์/);
 assert.match(A({s:'active',sub:'recv'},'design',{role:'sales'}).err,/สิทธิ์/);
 assert.deepEqual(A({s:'active',sub:'recv'},'design',{role:'sales',own:true}),{action:'psub',sub:'design'});
});
test('บอร์ดผูกกับ dvPost เดิม · ผิดพลาดแล้วการ์ดกลับที่เดิม · ยกเลิก dialog แล้วไม่บันทึก',()=>{
 let d=between('async function dvBoardDrop(','\n/*')||'';
 assert.ok(d.includes('dvPost({action:"psub"'));assert.ok(d.includes('dvPost({action:"pstatus"'));assert.ok(d.includes('home.insertBefore(c'));assert.ok(d.includes('if(!r)return;'));
 assert.ok(html.includes('function dvStatusWire(host){try{dvBoardDnD(host)}'));
});
test('หน้าภาพรวม: ไม่มี "รอ Engineer ตอบ" และมีแผนภูมิภาพรวมงานก่อนส่วน Teams',()=>{
 assert.ok(!html.includes('dvIcon.warn+" รอ Engineer ตอบ"'));assert.ok(html.includes('host.innerHTML=head+dvOvTop(st,keys,rl,staff,half,tplot)+teams'));
});
