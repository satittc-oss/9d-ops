// v16.67 แจ้งเตือนเมื่อมีคนแท็กเราใน Teams Channel (ข้อมูลสมมติ)
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const part=html.slice(html.indexOf('/* ===== v16.67 แจ้งเตือนเมื่อมีคนแท็กเรา'),html.indexOf('var mUiFrame=0;function mUiSchedule('));
const ME='aaaa-me',now=Date.now(),iso=ms=>new Date(now-ms).toISOString();
function ctx(all,store){const ls={...(store||{})},toasts=[];const c={console,Date,JSON,Object,Set,String,Math,
 localStorage:{getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=v}},document:{hidden:false,querySelectorAll:()=>[],getElementById:()=>null},window:{},
 M:{profile:{oid:ME,tid:'t1'}},TS:{all},mT:v=>Date.parse(v||0)||0,mToast:(m,e,a)=>toasts.push(m),mEsc:s=>String(s),dvAgo:()=>'1 นาที'};
 c.window=c;vm.createContext(c);vm.runInContext(part,c);c.toasts=toasts;c.ls=ls;return c}
const msg=(id,from,ments)=>({id,from:{user:{id:from}},mentions:ments.map(u=>({mentioned:{user:{id:u}}}))});
test('ตรวจว่าข้อความแท็กเรา (ไม่นับข้อความของเราเอง / แท็กคนอื่น)',()=>{const c=ctx([]);
 assert.equal(c.mentIsMe(msg('1','bob',[ME.toUpperCase()]),ME),true);
 assert.equal(c.mentIsMe(msg('2',ME,[ME]),ME),false);
 assert.equal(c.mentIsMe(msg('3','bob',['other']),ME),false);
 assert.equal(c.mentIsMe(msg('4','bob',[]),''),false)});
const ch=ments=>[{channelId:'c1',teamId:'t',name:'ASP26061',pid:'sp-1',ments}];
test('ครั้งแรก: ไม่เด้งย้อนหลัง, แท็กเก่ากว่า 2 วันนับว่าอ่านแล้ว',()=>{const c=ctx(ch([{id:'a',at:iso(5*864e5),by:'Bob',text:'x'},{id:'b',at:iso(36e5),by:'Ann',text:'y'}]));
 assert.equal(c.mentNotify(),0);assert.equal(c.toasts.length,0);assert.equal(c.mentUnread().map(x=>x.id).join(),'b')});
test('รอบถัดไป: แท็กใหม่เด้งแจ้งเตือนครั้งเดียว และเปิดแผงคุยในทีมแล้วนับว่าอ่าน',()=>{const c=ctx(ch([]));c.mentNotify();
 c.TS.all=ch([{id:'n1',at:iso(6e4),by:'Bob',text:'ช่วยดูราคา'}]);assert.equal(c.mentNotify(),1);assert.match(c.toasts[0],/Bob แท็กคุณใน ASP26061/);
 assert.equal(c.mentNotify(),0);assert.equal(c.mentUnread().length,1);c.mentSeenChan('c1',new Date().toISOString());assert.equal(c.mentUnread().length,0);
 const c2=ctx(ch([{id:'n1',at:iso(6e4),by:'Bob',text:'x'}]),c.ls);assert.equal(c2.mentUnread().length,0)});
test('หลายข้อความใหม่พร้อมกัน → แจ้งรวมครั้งเดียว · เก่ากว่า 30 วันไม่แสดง · ลิงก์เปิดข้อความใน Teams',()=>{const c=ctx(ch([]));c.mentNotify();
 c.TS.all=ch([{id:'m1',at:iso(6e4),by:'A',text:''},{id:'m2',at:iso(12e4),by:'B',text:'',root:'m0'},{id:'old',at:iso(40*864e5),by:'C',text:''}]);
 assert.equal(c.mentNotify(),2);assert.match(c.toasts[0],/2 ข้อความใหม่/);assert.equal(c.mentList().length,2);
 assert.match(c.mentLink(c.mentList()[1]),/l\/message\/c1\/m2\?groupId=t&parentMessageId=m0&tenantId=t1/)});
test('ซิงค์ Teams เก็บแท็กไว้ใน ments และใช้ผลเดิมเมื่อ Channel ไม่มีข้อความใหม่',()=>{assert.match(html,/"fullExp","ments"\]/);assert.match(html,/mentIsMe\(x,M\.profile\?\.oid\)\)r\.ments\.push/);assert.match(html,/mTsSave\(\);try\{typeof mentNotify==="function"&&mentNotify\(\)/)});
