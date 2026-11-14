// v16.63 หน้า "โครงการ" รวม (สถานะ + ทะเบียน) และแผงงาน "คุยในทีม" (ข้อมูลสมมติ)
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const panel=html.slice(html.indexOf('/* ===== v16.63 แผงงานด้านข้าง'),html.indexOf('var dvOver=L=>'));
function ctx(TS,seen){const c={TS,M:{profile:{}},mT:v=>Date.parse(v||0)||0,mEsc:v=>String(v??''),localStorage:{getItem:()=>JSON.stringify(seen||{}),setItem(){}},console,Date};c.window=c;vm.createContext(c);vm.runInContext(panel,c);return c}
test('สถานะโครงการรวมเข้าหน้า "โครงการ" (เมนูเดียว) และลิงก์เดิม status ยังพาไปหน้าเดียวกัน',()=>{
 assert.match(html,/if\(DV\.page==="status"\)DV\.page="projects";let page=DV\.page;/);
 assert.match(html,/if\(page==="projects"\)\{\/\* v16\.63[^}]*\*\/if\(DV\.stv==="table"\)await dvProjectsPage\(host,id\);else await dvStatusPage\(host,id\);return\}/);
 assert.match(html,/let want=\[\["city","ศูนย์ข้อมูลงาน"\],/);assert.ok(!html.includes('let want=[["status","สถานะโครงการ"]'));
 assert.match(html,/\["list","ตามสถานะ"\],\["board","บอร์ด"\],\["table","ทะเบียนทั้งหมด \(รวมรออนุมัติ\)"\]/)});
test('จุด "ใหม่": มีข้อความหลังเปิดดูครั้งล่าสุด / ยังไม่เคยเปิดนับเฉพาะ 24 ชม.',()=>{const now=Date.now(),iso=d=>new Date(now-d).toISOString();
 const TS={channels:{},all:[{pid:'sp-1',teamId:'t',channelId:'c1',last:iso(6e4)},{pid:'sp-2',teamId:'t',channelId:'c2',last:iso(3*864e5)},{pid:'sp-3',teamId:'t',channelId:'c3',last:iso(6e4)}]};
 const c=ctx(TS,{c3:iso(1e3)});assert.equal(c.dvUnread({id:'sp-1'}),true);assert.equal(c.dvUnread({id:'sp-2'}),false);assert.equal(c.dvUnread({id:'sp-3'}),false);assert.equal(c.dvUnread({id:'sp-9'}),false)});
test('หา Channel ของงานจากข้อมูลงาน หรือจากรายการ Channel ที่จับคู่ไว้',()=>{const c=ctx({channels:{'sp-1':{teamId:'T',channelId:'C',url:'https://teams/x'}},all:[]});
 assert.deepEqual(JSON.parse(JSON.stringify(c.pnlChan({id:'sp-1'}))),{teamId:'T',channelId:'C',url:'https://teams/x',last:''});assert.equal(c.pnlChan({id:'sp-2',teamId:'A',channelId:'B'}).channelId,'B')});
test('ส่งข้อความ: ตอบในเธรดไปที่ /replies · แท็กคนเป็น mentions · ข้อความผู้ใช้ถูก escape',async()=>{const c=ctx({channels:{},all:[]}),calls=[];c.M_GRAPH='https://graph';c.mEsc=v=>String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 c.mHttp=async(u,o,k)=>{calls.push({u,o,k});return{}};c.PNL.reply={id:'m1'};c.PNL.ments=[{id:'u1',name:'คุณ A'}];c.PNL.files=[{name:'a.pdf',webUrl:'https://sp/a.pdf'}];
 await c.pnlSend({teamId:'t',channelId:'c'},'<b>hi</b>\nบรรทัด 2');const x=calls[0];assert.equal(x.k,'teams');assert.match(x.u,/\/channels\/c\/messages\/m1\/replies$/);
 assert.match(x.o.json.body.content,/^<at id="0">คุณ A<\/at> &lt;b&gt;hi&lt;\/b&gt;<br>บรรทัด 2<br>📎 <a href="https:\/\/sp\/a\.pdf">a\.pdf<\/a>$/);assert.equal(x.o.json.mentions[0].mentioned.user.id,'u1')});
test('ข้อความจาก Teams ไม่ฝัง HTML ตรง ๆ: ตัด script/รูป/ลิงก์ที่ไม่ใช่ https',()=>{assert.match(panel,/if\(t==="script"\|\|t==="style"/);assert.match(panel,/if\(\/\^https:\\\/\\\/\/i\.test\(h\)\)/);assert.match(panel,/\[รูปภาพ — เปิดดูใน Teams\]/)});
