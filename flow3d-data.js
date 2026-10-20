/* v16.35 จัดข้อมูล Flow 3D ในหน่วยความจำ ใช้ข้อมูลที่ผู้ใช้เข้าถึงได้จากหน้าหลักเท่านั้น */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.Flow3DData=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const stages=Object.freeze([
  {id:"request",label:"รับคำขอ / รออนุมัติ",short:"รออนุมัติ",owner:"ผู้อนุมัติ",color:"#8ca8ff",x:-22,z:0},
  {id:"engineer",label:"ทีมวิศวกรรม",short:"ดำเนินงาน",owner:"Engineer",color:"#59bdff",x:-11,z:0},
  {id:"supplier",label:"ซัพพลายเออร์ / ราคา",short:"ซัพพลายเออร์",owner:"Supplier",color:"#b79bff",x:0,z:-10},
  {id:"purchase",label:"ประสานจัดซื้อ",short:"จัดซื้อ",owner:"จัดซื้อ",color:"#ffcb79",x:0,z:10},
  {id:"sales",label:"ประสานเซลส์",short:"เซลส์",owner:"Sales",color:"#fb98c3",x:11,z:10},
  {id:"customer",label:"ลูกค้า / ส่งมอบ",short:"ลูกค้า",owner:"ลูกค้า",color:"#67ded0",x:12,z:-3},
  {id:"closed",label:"ปิดงาน / ผลพิจารณา",short:"สิ้นสุด",owner:"ผลลัพธ์",color:"#8bdaa5",x:24,z:-3}
 ]);
 const states={pending:"รออนุมัติ",active:"กำลังทำ",delivered:"ส่งงานแล้ว · รอลูกค้า",won:"ปิด · WIN",lost:"ปิด · LOSS",cancelled:"ปิด · ยกเลิก",rejected:"ไม่อนุมัติ"};
 const steps={recv:"รับงานแล้ว · กำลังดำเนินการ",design:"ทำ BOM / ออกแบบ",sup:"รอซัพพลายเออร์",buy:"ประสานจัดซื้อ",price:"รอราคา",cust:"รอลูกค้า",sales:"รอเซลส์",quote:"ส่งราคาแล้ว"};
 const text=(v,n=240)=>typeof v==="string"?v.slice(0,n):"";
 const isClosed=j=>["won","lost","cancelled","rejected"].includes(j.state);
 function stageFor(j){if(j.state==="pending")return"request";if(isClosed(j))return"closed";if(j.state==="delivered")return"customer";return({sup:"supplier",price:"supplier",buy:"purchase",sales:"sales",cust:"customer",quote:"customer"})[j.stepKey]||"engineer"}
 function normalize(raw){
  if(!raw||!Array.isArray(raw.jobs))throw new Error("ข้อมูล Flow ไม่ครบ กรุณารีเฟรชอีกครั้ง");
  const seen=new Set(),jobs=[];
  for(const v of raw.jobs){
   if(!v||typeof v!=="object"||!/^sp-\d+$/.test(v.id)||!Object.prototype.hasOwnProperty.call(states,v.state)||seen.has(v.id))continue;
   seen.add(v.id);const stepKey=Object.prototype.hasOwnProperty.call(steps,v.stepKey)?v.stepKey:"recv";
   const j={id:v.id,code:text(v.code,100)||v.id,name:text(v.name),client:text(v.client),sales:text(v.sales,100),engineer:text(v.engineer,100),state:v.state,stepKey,
    days:typeof v.days==="number"&&Number.isFinite(v.days)&&v.days>=0?Math.floor(v.days):null,
    warn:typeof v.warn==="number"&&Number.isFinite(v.warn)&&v.warn>0?v.warn:0,
    owner:text(v.owner,100),next:text(v.next,500),since:text(v.since,50),updatedAt:text(v.updatedAt,50),priority:["urgent","high"].includes(v.priority)?v.priority:"normal"};
   j.stage=stageFor(j);j.stateLabel=states[j.state];j.stepLabel=j.state==="active"?steps[stepKey]:j.stateLabel;
   j.over=j.state==="active"&&j.days!==null&&j.warn>0&&j.days>=j.warn;
   jobs.push(j);
  }
  return{jobs,at:typeof raw.at==="number"&&Number.isFinite(raw.at)?raw.at:Date.now(),scope:raw.scope==="own"?"own":"team"};
 }
 function filter(jobs,options={}){
  const q=String(options.q||"").trim().toLocaleLowerCase(),mode=options.mode||"open";
  return jobs.filter(j=>(mode==="all"||mode==="closed"?mode==="all"||isClosed(j):mode==="over"?j.over:!isClosed(j))&&(!options.engineer||(options.engineer==="__none"?!j.engineer:j.engineer===options.engineer))&&(!q||[j.code,j.name,j.client,j.sales,j.engineer,j.stepLabel].some(v=>String(v||"").toLocaleLowerCase().includes(q))));
 }
 function summary(jobs){return{total:jobs.length,active:jobs.filter(j=>j.state==="active"||j.state==="delivered").length,over:jobs.filter(j=>j.over).length,closed:jobs.filter(isClosed).length,pending:jobs.filter(j=>j.state==="pending").length}}
 function sort(jobs){return[...jobs].sort((a,b)=>Number(b.over)-Number(a.over)||(["normal","high","urgent"].indexOf(b.priority)-["normal","high","urgent"].indexOf(a.priority))||(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||a.code.localeCompare(b.code,"th"))}
 return Object.freeze({stages,states,steps,stageFor,isClosed,normalize,filter,summary,sort});
});
