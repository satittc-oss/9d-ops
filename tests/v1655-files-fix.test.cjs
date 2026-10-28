// v16.55 ซ่อม Channel ที่แท็บ Files ขึ้น 404 (ข้อมูลสมมติ)
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function between(a,b){let i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j)}
function setup(okIds){const c={console,Date,Math,JSON,Set,Promise,String,Number,Array,Object,encodeURIComponent,calls:{saves:[],posts:[],toasts:[]}};
 c.M={tl:'trk',cache:{track:{}}};c.mIsEng=()=>true;c.pvNow=()=>'2026-10-28T03:00:00Z';c.pvUid=()=>'u';c.mEsc=x=>String(x);c.mKey=x=>String(x).toLowerCase().replace(/\s+/g,'');c.mChanName=p=>p.code+'_'+p.name;c.mPStat=()=>'active';
 c.G=async u=>{let id=decodeURIComponent(u.split('/channels/')[1].split('/')[0]);if(okIds.includes(id))return{parentReference:{driveId:'d'}};let e=Error('404');e.status=404;throw e};
 c.gAll=async()=>[{id:'A',displayName:'CHW261009_UTP Cable',webUrl:'https://a'},{id:'B',displayName:'CHW261009_UTP Cable',webUrl:'https://b'},{id:'C',displayName:'Other'}];
 c.mSaveTrack=async(p,acts)=>{c.calls.saves.push({p,acts})};c.mChanPost=async(t,ch,h)=>{c.calls.posts.push(ch)};c.mToast=m=>c.calls.toasts.push(m);
 c.mState=async()=>({projects:[{id:'sp-1',listItemId:'1',code:'CHW261009',name:'UTP Cable',teamId:'T',channelId:'A'}]});
 vm.createContext(c);vm.runInContext(between('async function mChanFilesFix(){','async function mChanVerify(){'),c);return c}
test('Channel เดิม Files ใช้ได้ → จด filesOkAt ไม่ย้าย',async()=>{let c=setup(['A','B']);await c.mChanFilesFix();assert.equal(c.calls.saves[0].p.channelId,'A');assert.ok(c.calls.saves[0].p.filesOkAt);assert.equal(c.calls.posts.length,0)});
test('Files 404 + มี Channel ซ้ำที่ใช้ได้ → ย้ายไป B และแจ้งใน A',async()=>{let c=setup(['B']);await c.mChanFilesFix();let s=c.calls.saves[0];assert.equal(s.p.channelId,'B');assert.equal(s.p.channelUrl,'https://b');assert.deepEqual(c.calls.posts,['A']);assert.match(s.acts[0].action,/ย้าย/)});
test('ไม่มีอันไหนใช้ได้ → จดจำนวนครั้ง',async()=>{let c=setup([]);await c.mChanFilesFix();assert.equal(c.calls.saves[0].p.filesTry.n,1);assert.equal(c.calls.saves[0].p.channelId,'A')});
test('จอง Channel 2 จังหวะ + keep list',()=>{assert.ok(html.includes('"chanClaim","filesOkAt","filesTry","reqCancel"'));assert.ok(html.includes('อีกเครื่องกำลังสร้าง Channel ของงานนี้อยู่'))});
