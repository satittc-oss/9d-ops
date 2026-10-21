// ข้อมูลจำลองเท่านั้น: เรียก adapter ตัวจริงผ่าน HTTP fixture ที่ไม่มี network
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  F = require("./sync-fixture.js"),
  M = require("../sync-m365.js");
const data = (f) =>
  JSON.parse(
    f.lists.directory.find((r) => r.fields.ProjectRef === 1).fields
      .DirectoryJson,
  );
const done = async (f, kind, values, client = f.client, extra = {}) => {
  let r = await client.request("sp-1", kind, values, extra),
    q = await client.engine.enqueue(r);
  return f.client.engine.process(q.id);
};
test("web → SharePoint read-back → Teams read-back โดย adapter จริง", async () => {
  let f = F.create(),
    r = await done(f, "status", { value: "delivered" });
  assert.equal(r.job.state, "complete");
  assert.equal(f.lists.projects[0].fields.latest, "Finish");
  assert.equal(data(f).pstat.s, "delivered");
  assert.equal(f.messages.get("channel-1").length, 1);
  assert.ok(
    f.calls
      .filter((c) => c.method === "PATCH")
      .every((c) => c.options.headers["If-Match"] && c.options.noRetry),
  );
});
test("Sales ส่งคำสั่งงานตนเองเข้าคิว; Admin ตรวจผู้สร้างที่ Microsoft ยืนยัน", async () => {
  let f = F.create(),
    sales = f.makeClient(f.users[2]),
    r = await done(f, "status", { value: "won" }, sales);
  assert.equal(r.job.state, "complete");
  assert.equal(data(f).syncHistory[0].by, "Sales A");
});
test("Sales อ่าน/แก้ของคนอื่นไม่ได้; Viewer อ่านของตนได้แต่เขียนโครงการไม่ได้", async () => {
  let f = F.create(),
    sales = f.makeClient(f.users[2]),
    viewer = f.makeClient(f.users[4]);
  await assert.rejects(sales.context("sp-2"));
  await assert.rejects(sales.request("sp-2", "status", { value: "won" }));
  assert.equal((await viewer.context("sp-3")).owner, f.users[4].email);
  await assert.rejects(
    viewer.engine.enqueue(
      await viewer.request("sp-3", "status", { value: "won" }),
    ),
    (e) => e.status === 403,
  );
});
test("Engineer ไม่แก้ข้อมูล Admin แม้ปลอม payload; แก้คำขอไม่มอบหมาย Engineer", async () => {
  let f = F.create(),
    engineer = f.makeClient(f.users[1]);
  await assert.rejects(
    engineer.engine.enqueue(
      await engineer.request("sp-1", "edit", { name: "forged" }),
    ),
    (e) => e.status === 403,
  );
  f.lists.projects[0].fields.approval = "Pending";
  let r = await done(f, "request", { engineer: "Engineer A" }, engineer);
  assert.equal(r.job.targets.sharepoint.state, "blocked");
  assert.equal(f.messages.get("channel-1").length, 0);
});
test("ตรวจบทบาทใหม่หลังเข้าคิว ป้องกันสิทธิ์เก่าผ่าน cache", async () => {
  let f = F.create(),
    sales = f.makeClient(f.users[2]),
    req = await sales.request("sp-1", "status", { value: "won" }),
    q = await sales.engine.enqueue(req);
  await f.client.settings();
  f.setRole(f.users[2].email, "viewer");
  let r = await f.client.engine.process(q.id);
  assert.equal(r.job.targets.sharepoint.state, "blocked");
  assert.equal(data(f).pstat.s, "active");
});
test("คิว own-item ไม่อ่านคำสั่งผู้อื่น; non-Admin ไม่ประมวลผลแม้เรียกตรง", async () => {
  let f = F.create(),
    q = await f.client.engine.enqueue(
      await f.client.request("sp-1", "status", { value: "won" }),
    ),
    sales = f.makeClient(f.users[2]);
  await assert.rejects(sales.loadJob(q.id), (e) => e.status === 403);
  await assert.rejects(sales.engine.process(q.id), (e) => e.status === 403);
});
test("physical ACL และ unique key ไม่พร้อม ต้องหยุดก่อนเขียน", async () => {
  for (let flag of ["badPolicy", "badIndex"]) {
    let f = F.create();
    f.faults[flag] = true;
    await assert.rejects(f.client.ready(), (e) => e.status === 403);
    assert.equal(f.calls.filter((c) => c.method === "POST").length, 0);
  }
});
test("Teams source ใช้ตัวตนข้อความจริง ไม่รับ actor ปลอมใน payload", async () => {
  let f = F.create(),
    m = f.addMessage("channel-1", "#WIN", "other-uid"),
    r = await done(f, "status", { value: "won" }, f.client, {
      source: {
        kind: "teams",
        teamId: "team",
        channelId: "channel-1",
        rootId: m.id,
        messageId: m.id,
      },
      actor: { email: "admin@example.invalid" },
    });
  assert.equal(r.job.targets.sharepoint.state, "blocked");
  assert.equal(data(f).pstat.s, "active");
});
test("คำสั่ง Teams ของเจ้าของ → SharePoint → เว็บ; reply ตรวจต้นทางเดิม", async () => {
  let f = F.create(),
    root = f.addMessage("channel-1", "ติดตามงาน", "sales-uid");
  f.addMessage("channel-1", "#WIN", "sales-uid", root.id);
  let r = await f.client.scanProject("sp-1", 8);
  assert.equal(data(f).pstat.s, "won");
  assert.equal(data(f).syncHistory[0].source, "teams");
  assert.equal(r.messages, 1);
  await f.client.scanProject("sp-1", 8);
  assert.equal(data(f).syncHistory.length, 1);
  assert.equal(
    f.messages
      .get("channel-1")
      .filter((m) => m.body.content.includes("9D Sync ·")).length,
    1,
  );
});
test("Teams source คนละ Channel และคำสั่งกำกวม/ข้อความระบบถูกปฏิเสธ", async () => {
  let f = F.create(),
    m = f.addMessage("channel-1", "#WIN", "sales-uid"),
    r = await done(f, "status", { value: "won" }, f.client, {
      source: {
        kind: "teams",
        teamId: "team",
        channelId: "channel-2",
        rootId: m.id,
        messageId: m.id,
      },
    });
  assert.equal(r.job.targets.sharepoint.state, "blocked");
  for (let t of ["#WIN #LOSS", "[9D] #WIN", "9D Sync · #WIN"])
    assert.equal(M.command(t), null);
});
test("SharePoint เปลี่ยนโดยตรง → Directory และ Teams โดยไม่มีวงจรซ้ำ", async () => {
  let f = F.create();
  f.lists.projects[0].fields.name = "แก้ใน Lists";
  f.lists.projects[0].lastModifiedBy = { user: { id: "admin-uid" } };
  f.lists.projects[0].eTag = '"v2"';
  await f.client.scanProject("sp-1");
  assert.equal(data(f).name, "แก้ใน Lists");
  assert.equal(data(f).syncHistory[0].source, "sharepoint");
  await f.client.scanProject("sp-1");
  assert.equal(data(f).syncHistory.length, 1);
});
test("แก้ชื่อใน Lists ไม่เปลี่ยนยกเลิกเป็น LOSS; เปลี่ยน Engineer lookup อย่างมีสิทธิ์", async () => {
  let f = F.create(),
    row = f.lists.directory[0],
    d = data(f);
  d.pstat.s = "cancelled";
  row.fields.DirectoryJson = JSON.stringify(d);
  f.lists.projects[0].fields.name = "ใหม่";
  f.lists.projects[0].lastModifiedBy = { user: { id: "admin-uid" } };
  f.lists.projects[0].fields.engineerLookupId = "12";
  f.lists.projects[0].eTag = '"v2"';
  await f.client.scanProject("sp-1");
  assert.equal(data(f).pstat.s, "cancelled");
  assert.equal(data(f).engineer, "Engineer A");
});
test("SP/Teams ล้มเหลวบางส่วนแล้วสร้าง client ใหม่ ทำต่อเฉพาะที่ค้าง", async () => {
  let f = F.create();
  f.faults.postAfter = true;
  let r = await done(f, "status", { value: "won" });
  assert.equal(r.job.state, "uncertain");
  f.faults.postAfter = false;
  let c = f.makeClient(f.actor);
  r = await c.engine.process(r.id);
  assert.equal(r.job.state, "complete");
  assert.equal(f.messages.get("channel-1").length, 1);
  assert.equal(data(f).syncHistory.length, 1);
});
test("eTag และ revision เก่า ไม่ทับค่าใหม่", async () => {
  let f = F.create(),
    req = await f.client.request("sp-1", "status", { value: "won" });
  f.lists.projects[0].fields.name = "ผู้อื่นแก้";
  f.lists.projects[0].eTag = '"v2"';
  let q = await f.client.engine.enqueue(req),
    r = await f.client.engine.process(q.id);
  assert.equal(r.job.state, "conflict");
  assert.equal(f.lists.projects[0].fields.winLoss, "Process");
});
test("Flow ปิดคำสั่งทั้งเว็บ/Teams และสื่อ Teams ปิดมีเหตุผล N/A ที่ตรงกัน", async () => {
  let f = F.create(),
    s = JSON.parse(f.lists.tracking[0].fields.Payload);
  s.workflowPolicy.disabled = ["status:won"];
  f.lists.tracking[0].fields.Payload = JSON.stringify(s);
  let r = await done(f, "status", { value: "won" });
  assert.equal(r.job.state, "failed");
  s.workflowPolicy.disabled = [];
  s.workflowPolicy.notify = false;
  f.lists.tracking[0].fields.Payload = JSON.stringify(s);
  r = await done(f, "status", { value: "lost" });
  assert.equal(r.job.state, "complete");
  assert.match(r.job.targets.teams.note, /ปิดการแจ้ง/);
  assert.equal(f.messages.get("channel-1").length, 0);
});
test("วันที่ผิดและฟิลด์ที่นอก mapping ถูกปฏิเสธ", async () => {
  let f = F.create();
  let r = await done(f, "edit", { due: "2026-02-30" });
  assert.notEqual(r.job.state, "complete");
  r = await done(f, "edit", { permissions: "admin" });
  assert.notEqual(r.job.state, "complete");
  assert.equal(data(f).permissions, undefined);
});
test("ไม่เชื่อสถานะสำเร็จ/evidence/audit ที่ผู้ส่งคิวปลอมเอง ต้องประมวลผลและอ่านยืนยันใหม่", async () => {
  let f = F.create(),
    sales = f.makeClient(f.users[2]),
    q = await sales.engine.enqueue(
      await sales.request("sp-1", "status", { value: "won" }),
    ),
    raw = f.lists.queue[0],
    job = JSON.parse(raw.fields.JobJson);
  job.state = "complete";
  job.targets = {
    sharepoint: { state: "verified" },
    teams: { state: "verified" },
  };
  job.audit = { actor: { name: "forged" }, before: { fake: true } };
  raw.fields.JobJson = JSON.stringify(job);
  assert.equal((await f.client.jobs())[0].job.state, "pending");
  await f.client.cycle({ scan: 0 });
  let r = await f.client.loadJob(q.id);
  assert.equal(r.job.state, "complete");
  assert.equal(r.job.audit.actor.name, "Sales A");
  assert.equal(f.lists.projects[0].fields.winLoss, "WIN");
  assert.equal(f.messages.get("channel-1").length, 1);
});
test("เจ้าของแก้ receipt หลัง Teams timeout ไม่ทำให้ worker POST ซ้ำ", async () => {
  let f = F.create(),
    sales = f.makeClient(f.users[2]);
  f.faults.postAfter = true;
  let r = await done(f, "status", { value: "won" }, sales),
    raw = f.lists.queue[0],
    job = JSON.parse(raw.fields.JobJson);
  job.targets.teams = { state: "pending" };
  raw.fields.JobJson = JSON.stringify(job);
  raw.lastModifiedBy = { user: { id: "sales-uid" } };
  f.faults.postAfter = false;
  r = await f.makeClient(f.actor).engine.process(r.id);
  assert.equal(r.job.state, "complete");
  assert.equal(f.messages.get("channel-1").length, 1);
});
test("แก้ due/nextAction ในทะเบียน SharePoint โดยตรง → Teams และไม่มี sync loop", async () => {
  let f = F.create();
  await done(f, "note", { note: "เริ่มติดตาม" });
  let row = f.lists.directory[0],
    d = data(f);
  d.due = "2026-11-12";
  d.nextAction = "ตรวจรับงาน";
  row.fields.DirectoryJson = JSON.stringify(d);
  row.eTag = '"v100"';
  let before = f.messages.get("channel-1").length;
  await f.client.scanProject("sp-1");
  assert.equal(f.messages.get("channel-1").length, before + 1);
  assert.match(f.messages.get("channel-1").at(-1).body.content, /2026-11-12/);
  await f.client.scanProject("sp-1");
  assert.equal(f.messages.get("channel-1").length, before + 1);
});
test("เตือนตามกติกากลางวันละครั้ง ผ่านคิวและอ่านยืนยัน", async () => {
  let f = F.create(),
    row = f.lists.directory[0],
    d = data(f);
  d.sub = { sub: "design", at: "2026-10-10T00:00:00Z" };
  d.pstat.at = "2026-10-09T00:00:00Z";
  row.fields.DirectoryJson = JSON.stringify(d);
  await f.client.scanProject("sp-1");
  assert.equal(f.messages.get("channel-1").length, 1);
  assert.match(
    f.messages.get("channel-1")[0].body.content,
    /ติดตามงานเกินเกณฑ์/,
  );
  await f.client.scanProject("sp-1");
  assert.equal(f.messages.get("channel-1").length, 1);
});
test("อ่านรอบ Teams แบบ bounded ไม่โหลดทะเบียนซ้ำสำหรับข้อความสนทนาปกติ", async () => {
  let f = F.create();
  for (let i = 0; i < 40; i++) f.addMessage("channel-1", "คุยงานทั่วไป " + i);
  await f.client.scanProject("sp-1", 3);
  assert.ok(f.calls.filter((c) => !c.sp).length < 20);
  let d = data(f);
  assert.ok(d.syncSource.pending.length > 0);
  assert.ok(d.syncSource.lastAttemptAt);
});
test("ตรวจ scope ก่อนอ่าน project body/Tracking ของผู้อื่น แม้ Microsoft Main List อนุญาตอ่าน", async () => {
  let f = F.create(),
    sales = f.makeClient(f.users[2]);
  await assert.rejects(sales.context("sp-2"));
  assert.equal(
    f.calls.some(
      (c) =>
        c.url?.includes("/projects/items/2?") &&
        c.url.includes("$expand=fields"),
    ),
    false,
  );
  assert.equal(
    f.calls.some(
      (c) =>
        c.url?.includes("/tracking/items?") &&
        c.url.includes("ProjectItemId eq 2"),
    ),
    false,
  );
});
test("Engineer อัปเดตงานโครงการทีมได้ พร้อม validation ขั้นทำงานและ Engineer Lookup", async () => {
  let f = F.create(),
    engineer = f.makeClient(f.users[1]),
    r = await done(
      f,
      "work",
      {
        engineer: "Engineer A",
        stage: "working",
        outcome: "open",
        nextAction: "ตรวจแบบ",
        followup: "2026-11-01",
      },
      engineer,
    );
  assert.equal(r.job.state, "complete");
  assert.equal(data(f).stage, "working");
  assert.equal(f.lists.projects[0].fields.engineerLookupId, "12");
  r = await done(f, "work", { stage: "delivered", summary: "" }, engineer);
  assert.notEqual(r.job.state, "complete");
});
test("คำสั่งแรกเตรียมทะเบียนปลอดภัยจากข้อมูล Main และให้เจ้าของอ่านเฉพาะรายการ", async () => {
  let f = F.create();
  f.lists.directory = f.lists.directory.filter(
    (r) => r.fields.ProjectRef !== 1,
  );
  let sales = f.makeClient(f.users[2]),
    r = await done(f, "status", { value: "won" }, sales);
  assert.equal(r.job.state, "complete");
  assert.equal(data(f).owner, "sales@example.invalid");
  assert.equal(r.job.targets.teams.state, "not_applicable");
  assert.ok(
    f.calls.some(
      (c) => c.sp && c.path.includes("/roleassignments/addroleassignment"),
    ),
  );
});
test("ไม่เชื่อ binding เก่าใน Tracking ที่ไม่ตรงรหัส จน Admin ตรวจยืนยัน", async () => {
  let f = F.create();
  f.lists.directory = f.lists.directory.filter(
    (r) => r.fields.ProjectRef !== 1,
  );
  f.lists.tracking.push({
    id: "old",
    eTag: '"v1"',
    fields: {
      ProjectItemId: 1,
      Payload: JSON.stringify({ teamId: "team", channelId: "channel-9" }),
    },
  });
  let sales = f.makeClient(f.users[2]),
    r = await done(f, "status", { value: "won" }, sales);
  assert.notEqual(r.job.state, "complete");
  assert.equal(
    f.lists.directory.some((r) => r.fields.ProjectRef === 1),
    false,
  );
  r = await done(f, "register", {}, f.client, {
    reviewedChannel: { teamId: "team", channelId: "channel-9" },
  });
  assert.equal(r.job.state, "complete");
  assert.equal(data(f).channelId, "channel-9");
});
test("มีคนแก้ Directory ระหว่าง PATCH Main ไม่ทับค่าใหม่หรือแจ้ง Teams จาก snapshot เก่า", async () => {
  let f = F.create({
      onProjectPatch: (lists) => {
        let row = lists.directory.find((r) => r.fields.ProjectRef === 1),
          d = JSON.parse(row.fields.DirectoryJson);
        d.due = "2026-12-20";
        row.fields.DirectoryJson = JSON.stringify(d);
        row.eTag = '"v999"';
      },
    }),
    r = await done(f, "status", { value: "won" });
  assert.equal(r.job.state, "conflict");
  assert.equal(data(f).due, "2026-12-20");
  assert.equal(f.messages.get("channel-1").length, 0);
});
test("แก้ Directory หลังโพสต์แต่ก่อน cleanup ไม่ถูก mark ว่า Teams เห็นค่าใหม่แล้ว", async () => {
  let once = true,
    f = F.create({
      onPostMessage: (lists) => {
        if (!once) return;
        once = false;
        let row = lists.directory.find((r) => r.fields.ProjectRef === 1),
          d = JSON.parse(row.fields.DirectoryJson);
        d.due = "2026-12-21";
        row.fields.DirectoryJson = JSON.stringify(d);
        row.eTag = '"v999"';
      },
    }),
    r = await done(f, "status", { value: "won" });
  assert.equal(r.job.state, "complete");
  assert.equal(data(f).due, "2026-12-21");
  assert.notEqual(data(f).syncPublished.due, "2026-12-21");
  await f.client.scanProject("sp-1");
  assert.equal(data(f).syncPublished.due, "2026-12-21");
  assert.equal(f.messages.get("channel-1").length, 2);
});
test("SharePoint source ต้องตรวจบทบาท/เจ้าของผู้แก้จริงก่อนกระจายไป Directory/Teams", async () => {
  let f = F.create();
  f.lists.projects[0].fields.winLoss = "WIN";
  f.lists.projects[0].lastModifiedBy = { user: { id: "other-uid" } };
  f.lists.projects[0].eTag = '"v9"';
  await f.client.scanProject("sp-1");
  assert.equal(data(f).pstat.s, "active");
  assert.equal(f.messages.get("channel-1").length, 0);
  assert.equal(
    (await f.client.jobs())[0].job.targets.sharepoint.state,
    "blocked",
  );
});
