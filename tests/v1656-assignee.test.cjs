// v16.56 ข้อความเปิดงานแท็ก Engineer ผู้รับมอบหมาย + สร้าง Channel อัตโนมัติเฉพาะผู้รับมอบหมาย (ข้อมูลสมมติ)
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(a,b){let i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j)}
function setup(prof){let posted=[];const c={console,String,Array,JSON,M:{profile:prof},CFG:{engineers:{NUTSARUN:'nut@x.invalid',SATIT:'sat@x.invalid'}},M_GRAPH:'g',posted,
 mEsc:x=>String(x),mNorm:x=>String(x).toLowerCase().replace(/\s+/g,''),mEngName:n=>/^nut/i.test(n)?'NUTSARUN':/^sat/i.test(n)?'SATIT':'',
 mChanFiles:async()=>({copied:[],notes:[],ok:true}),mHttp:async(u,o)=>{posted.push(o.json);return{}},G:async()=>({value:[]})};
 vm.createContext(c);vm.runInContext(between('async function mChannelSetup(','return notes.join(" · ")}')+'return notes.join(" · ")}',c);return c}
const members=[{displayName:'Satit T.',email:'sat@x.invalid',userId:'u-sat'},{displayName:'Nutsarun Sirima',email:'nut@x.invalid',userId:'u-nut'},{displayName:'Asmaporn',email:'asm@x.invalid',userId:'u-asm'}];
test('คนอื่นสร้างแทน → แท็ก Engineer ผู้รับมอบหมาย และบอกว่าสร้างแทน',async()=>{let c=setup({name:'Satit T.',email:'sat@x.invalid',oid:'u-sat'});
 await c.mChannelSetup({code:'ASP1',engineer:'NUTSARUN'},{teamId:'t',channelId:'c',members,skipFiles:1},{email:'asm@x.invalid',name:'Asmaporn'},{name:'Satit T.',email:'sat@x.invalid'});
 let j=c.posted[0];assert.match(j.body.content,/Engineer ผู้รับผิดชอบ: <at id="\d">Nutsarun Sirima<\/at>/);assert.match(j.body.content,/สร้าง Channel แทนโดย Satit T\./);assert.ok(j.mentions.some(m=>m.mentioned.user.id==='u-nut'))});
test('ผู้รับมอบหมายสร้างเอง → ไม่มีคำว่าแทน',async()=>{let c=setup({name:'Nutsarun Sirima',email:'nut@x.invalid',oid:'u-nut'});
 await c.mChannelSetup({code:'ASP2',engineer:'NUTSARUN'},{teamId:'t',channelId:'c',members,skipFiles:1},{email:'asm@x.invalid',name:'Asmaporn'},{name:'Nutsarun Sirima',email:'nut@x.invalid'});
 let t=c.posted[0].body.content;assert.match(t,/Engineer ผู้รับผิดชอบ: <at/);assert.ok(!/แทนโดย/.test(t))});
test('สร้างอัตโนมัติเฉพาะผู้รับมอบหมาย (รอ 30 นาทีก่อนให้คนอื่นสร้างแทน)',()=>{assert.ok(html.includes('return a?(a===meE||age>g):(!!M.isApprover||age>Math.min(g,15*6e4))'))});
