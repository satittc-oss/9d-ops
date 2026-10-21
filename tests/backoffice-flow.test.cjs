// ฟอร์มหลังบ้านจำลอง: ยืนยัน/ยกเลิก/ข้อมูลขัดแย้ง โดยไม่มี DOM หรือ Microsoft จริง
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  M365 = require("../sync-m365.js");
const html = fs.readFileSync(
  require("node:path").join(__dirname, "../index.html"),
  "utf8",
);
function source(a, b) {
  let i = html.indexOf(a),
    j = html.indexOf(b, i);
  assert.ok(i >= 0 && j > i);
  return html.slice(i, j);
}
function formFixture() {
  let settings = { workflowPolicy: M365.workflow() },
    writes = 0,
    rendered = 0,
    confirmation = true,
    error = { textContent: "" },
    button = { disabled: false };
  const values = {
      enabled: true,
      notify: true,
      pollSeconds: "45",
      commandDays: "30",
      ...Object.fromEntries(
        Object.keys(M365.STEPS).map((k) => ["warn-" + k, "5"]),
      ),
    },
    allow = [
      ...Object.keys(M365.STEPS).map((k) => "step:" + k),
      ...Object.keys(M365.STATUS).map((k) => "status:" + k),
    ];
  const form = {
      querySelector: (s) => (s === "[type=submit]" ? button : error),
    },
    root = { querySelector: (s) => (s === ".bo-flow-form" ? form : null) },
    c = {
      BO: { tab: "flow" },
      M: { cache: { settings } },
      PSTAT: M365.STATUS,
      SUBST: M365.STEPS,
      NineSyncM365: M365,
      PvErr: require("../sync-core.js").SyncError,
      FormData: class {
        get(k) {
          return values[k];
        }
        getAll() {
          return allow;
        }
        has(k) {
          return !!values[k];
        }
      },
      confirm: () => confirmation,
      boFlowBackupWire() {},
      mToast() {},
      wsAudit: () => [],
      wsSettingsEdit: async (fn) => {
        settings = await fn(settings);
        writes++;
      },
      dvRender: () => rendered++,
    };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(source("function boWire(host)", "async function boCycle"), c);
  c.boWire({ querySelector: () => root });
  return {
    c,
    form,
    button,
    error,
    values,
    getSettings: () => settings,
    writes: () => writes,
    rendered: () => rendered,
    confirm: (v) => (confirmation = v),
  };
}
test("Flow ยืนยันก่อนเขียน ตรวจ schema และคง backup รุ่นก่อน", async () => {
  let f = formFixture();
  await f.form.onsubmit({ preventDefault() {} });
  assert.equal(f.writes(), 1);
  assert.equal(f.getSettings().workflowPolicy.pollSeconds, 45);
  assert.equal(f.getSettings().workflowPrevious.pollSeconds, 60);
  assert.equal(f.button.disabled, false);
  assert.equal(f.rendered(), 1);
});
test("Flow ยกเลิกยืนยันไม่เขียน; ค่าผิดแสดงในฟอร์มและไม่โยน rejection ที่ค้าง", async () => {
  let f = formFixture();
  f.confirm(false);
  await f.form.onsubmit({ preventDefault() {} });
  assert.equal(f.writes(), 0);
  f.confirm(true);
  f.values.pollSeconds = "1000";
  await f.form.onsubmit({ preventDefault() {} });
  assert.equal(f.writes(), 0);
  assert.ok(f.error.textContent);
  assert.equal(f.button.disabled, false);
});
test("Flow มี Admin อีกคนแก้ค่าระหว่างเปิดฟอร์ม จะไม่ทับค่ากลาง", async () => {
  let f = formFixture();
  f.getSettings().workflowPolicy.pollSeconds = 300;
  await f.form.onsubmit({ preventDefault() {} });
  assert.equal(f.writes(), 0);
  assert.match(f.error.textContent, /Admin/);
  assert.equal(f.getSettings().workflowPolicy.pollSeconds, 300);
});
test("ปรับ ACL ให้ผู้ดูแลมี Full Control ก่อนนำสิทธิ์กลุ่มเดิมออก และไม่ตัดสิทธิ์ตัวเอง", async () => {
  let calls = [],
    c = {
      mQtAdminSP: async (p, o) => {
        if (o) {
          calls.push({ p, o });
          return {};
        }
        if (p.includes("roledefinitions"))
          return { Id: p.includes("(5)") ? 5 : p.includes("(2)") ? 2 : 3 };
        if (p.includes("/roleassignments?"))
          return {
            value: [
              { PrincipalId: 1, RoleDefinitionBindings: [{ Id: 2 }] },
              { PrincipalId: 2, RoleDefinitionBindings: [{ Id: 3 }] },
            ],
          };
        return { HasUniqueRoleAssignments: true };
      },
    };
  vm.createContext(c);
  vm.runInContext(
    source("async function boSecureScope", "async function boAlignScopes"),
    c,
  );
  await c.boSecureScope("/scope", [1], [3], [4]);
  assert.match(calls[0].p, /addroleassignment\(principalid=1,roledefid=5\)/);
  assert.equal(
    calls.some((c) => /getbyprincipalid\(1\)/.test(c.p)),
    false,
  );
  assert.ok(calls.some((c) => /getbyprincipalid\(2\)/.test(c.p)));
});
