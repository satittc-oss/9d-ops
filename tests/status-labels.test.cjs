// v16.42 ตรวจตัวแปลชื่อขั้นตอน/สถานะในเบราว์เซอร์ (mCardName/mPStatName) ด้วยข้อมูลจำลองเท่านั้น
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const line = (re) => {
  let m = html.match(re);
  assert.ok(m, re);
  return m[0];
};
function setup(cards) {
  const ctx = { PSTAT: null, SUBST: null };
  ctx.wsUi = () => ({ status: { cards: cards || {} } });
  vm.createContext(ctx);
  vm.runInContext(line(/^var PSTAT=\{active.*?\};$/m), ctx);
  vm.runInContext(line(/^var SUBST=\{recv.*?\};$/m), ctx);
  vm.runInContext(line(/^function mCardName\(k\)\{let c=wsUi.*?\}$/m), ctx);
  vm.runInContext(line(/^var mPStatName=s=>.*?;$/m), ctx);
  return ctx;
}
test("ใช้ชื่อ/ผู้รับผิดชอบที่ Admin เผยแพร่เมื่อมีค่า", () => {
  let c = setup({
    buy: { label: "ประสานจัดซื้อ (รอราคาทุน)", who: "จัดซื้อ/บัญชี" },
    delivered: { label: "ส่งมอบงานแล้ว" },
  });
  assert.equal(c.mCardName("buy").label, "ประสานจัดซื้อ (รอราคาทุน)");
  assert.equal(c.mCardName("buy").who, "จัดซื้อ/บัญชี");
  assert.equal(c.mPStatName("delivered"), "ส่งมอบงานแล้ว");
});
test("ไม่มีค่ากลาง → fallback เป็นค่าเริ่มต้นจาก SUBST/PSTAT", () => {
  let c = setup(null);
  assert.equal(c.mCardName("buy").label, c.SUBST.buy.t);
  assert.equal(c.mCardName("buy").who, c.SUBST.buy.who);
  assert.equal(c.mPStatName("won"), c.PSTAT.won.t);
  assert.equal(c.mPStatName("delivered"), c.PSTAT.delivered.t);
});
test("who ว่างได้ และรหัสสถานะปิด (won/lost) ไม่ดึงจาก cards", () => {
  let c = setup({ sup: { label: "รอสเปก", who: "" } });
  assert.equal(c.mCardName("sup").who, "");
  assert.equal(c.mPStatName("won"), c.PSTAT.won.t);
});
