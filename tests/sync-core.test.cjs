// v16.41 ทดสอบคิวและการกู้คืนด้วยข้อมูลจำลอง ไม่มีการติดต่อ Microsoft
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  Core = require("../sync-core.js");
const clone = (x) => structuredClone(x),
  E = Core.SyncError;
function setup() {
  let time = Date.parse("2026-10-21T00:00:00Z"),
    serial = 0,
    jobs = new Map(),
    messages = new Map(),
    p = {
      etag: "p1",
      pid: "sp-1",
      data: {
        projectId: "sp-1",
        owner: "sales@example.invalid",
        code: "DEMO",
        syncRevision: 0,
        version: 1,
      },
    },
    list = { etag: "l1", fields: { Status: "active" } },
    calls = { patch: 0, post: 0, created: 0, verified: 0 },
    fault = {},
    isAdmin = true,
    authorised = true;
  const adapter = {
    ready: async () => {},
    requireAdmin: async () => {
      if (!isAdmin) throw new E("Admin only", 403);
    },
    preflight: async () => {
      if (!authorised) throw new E("Forbidden", 403);
    },
    findJob: async (key) =>
      clone([...jobs.values()].find((r) => r.job.request.key === key) || null),
    loadJob: async (id) => {
      let r = jobs.get(String(id));
      if (!r) throw new E("Missing", 404);
      return clone(r);
    },
    createJob: async (job) => {
      calls.created++;
      let r = { id: String(++serial), etag: "j1", job: clone(job) };
      jobs.set(r.id, r);
      if (fault.createAfter) throw new E("timeout", 504);
      return clone(r);
    },
    saveJob: async (r, job) => {
      let current = jobs.get(r.id);
      if (r.etag !== current.etag) throw new E("eTag", 412);
      if (fault.saveAfterPost && calls.post) {
        fault.saveAfterPost = false;
        throw new E("offline", 504);
      }
      let next = {
        id: r.id,
        etag: "j" + (Number(current.etag.slice(1)) + 1),
        job: clone(job),
      };
      jobs.set(r.id, next);
      return clone(next);
    },
    loadProject: async () => clone(p),
    saveProject: async (record, data) => {
      if (record.etag !== p.etag) throw new E("project eTag", 412);
      if (fault.release && !data.syncActive) {
        fault.release = false;
        throw new E("offline", 504);
      }
      p = {
        ...p,
        etag: "p" + (Number(p.etag.slice(1)) + 1),
        data: clone(data),
      };
      return clone(p);
    },
    plan: async (r) => {
      if (!authorised) throw new E("Forbidden", 403);
      return {
        intent: clone(r.job.request),
        actor: { name: "Admin ทดสอบ" },
        source: "web",
        before: { status: "active" },
        after: { status: r.job.request.values.status },
        track: { pstat: { s: r.job.request.values.status } },
        fields: { Status: r.job.request.values.status },
        channel: fault.noChannel
          ? null
          : { teamId: "team", channelId: "channel" },
        project: { code: "DEMO" },
      };
    },
    readList: async () => clone(list),
    fieldsEqual: (f, w) => Object.entries(w).every(([k, v]) => f[k] === v),
    observation: (x) => clone(x),
    patchList: async (_p, fields, etag) => {
      calls.patch++;
      if (fault.sp403) throw new E("Forbidden", 403);
      if (etag !== list.etag) throw new E("eTag", 412);
      if (!fault.patchBefore) {
        list.fields = { ...list.fields, ...fields };
        list.etag = "l" + (Number(list.etag.slice(1)) + 1);
      }
      if (fault.patchAfter || fault.patchBefore) throw new E("timeout", 504);
    },
    findMessage: async (_ch, key, id) => {
      if (fault.readMessage) throw new E("offline", 504);
      calls.verified++;
      return clone(
        id
          ? messages.get(id)
          : [...messages.values()].find((m) => m.key === key) || null,
      );
    },
    postMessage: async (_plan, key) => {
      calls.post++;
      if (fault.teams403) throw new E("Forbidden", 403);
      if (!fault.postBefore) {
        let msg = {
          id: "m" + calls.post,
          key,
          webUrl: "https://example.invalid/message",
        };
        messages.set(msg.id, msg);
      }
      if (fault.postAfter || fault.postBefore) throw new E("timeout", 504);
      return clone([...messages.values()].at(-1));
    },
  };
  const create = () =>
      Core.create(adapter, { now: () => time, uid: () => String(++serial) }),
    request = (key = "web:demo-0001", status = "delivered") => ({
      v: 1,
      key,
      kind: "status",
      projectId: "sp-1",
      values: { status },
      base: { revision: p.data.syncRevision || 0, listETag: list.etag },
    });
  return {
    adapter,
    engine: create(),
    create,
    request,
    jobs,
    messages,
    calls,
    fault,
    project: () => p,
    list,
    advance: (ms) => (time += ms),
    admin: (v) => (isAdmin = v),
    authorise: (v) => (authorised = v),
  };
}
test("ยืนยัน SharePoint และ Teams ก่อนรายงานสำเร็จ เก็บประวัติและปลดคิวโครงการ", async () => {
  let r = setup(),
    q = await r.engine.enqueue(r.request()),
    done = await r.engine.process(q.id);
  assert.equal(done.job.state, "complete");
  assert.equal(done.job.targets.sharepoint.state, "verified");
  assert.equal(done.job.targets.teams.state, "verified");
  assert.equal(r.calls.patch, 1);
  assert.equal(r.calls.post, 1);
  assert.equal(r.project().data.syncActive, undefined);
  assert.equal(r.project().data.syncHistory.length, 1);
  assert.equal(r.project().data.version, 2);
});
test("ปิดเว็บหลังล้มเหลว Teams แล้วเปิดใหม่ ทำต่อเฉพาะ Teams", async () => {
  let r = setup();
  r.fault.teams403 = true;
  let q = await r.engine.enqueue(r.request()),
    partial = await r.engine.process(q.id);
  assert.equal(partial.job.state, "partial");
  assert.equal(r.calls.patch, 1);
  r.fault.teams403 = false;
  let done = await r.create().process(q.id);
  assert.equal(done.job.state, "complete");
  assert.equal(r.calls.patch, 1);
  assert.equal(r.calls.post, 2);
  assert.equal(r.project().data.syncHistory.length, 1);
});
test("Teams timeout หลังส่ง: อ่าน marker ยืนยันบนรอบใหม่โดยไม่ POST ซ้ำ", async () => {
  let r = setup();
  r.fault.postAfter = true;
  let q = await r.engine.enqueue(r.request()),
    pending = await r.engine.process(q.id);
  assert.equal(pending.job.state, "uncertain");
  let done = await r.create().process(q.id);
  assert.equal(done.job.state, "complete");
  assert.equal(r.calls.post, 1);
});
test("Teams timeout ก่อนถึงปลายทาง: ยังไม่พบหลักฐานก็ไม่ส่งซ้ำ", async () => {
  let r = setup();
  r.fault.postBefore = true;
  let q = await r.engine.enqueue(r.request());
  await r.engine.process(q.id);
  await r.create().process(q.id);
  await r.create().process(q.id);
  assert.equal(r.calls.post, 1);
  assert.equal((await r.adapter.loadJob(q.id)).job.state, "uncertain");
});
test("PATCH timeout ที่สำเร็จแล้ว อ่านค่าจริงยืนยันและไม่เขียนซ้ำ", async () => {
  let r = setup();
  r.fault.patchAfter = true;
  let q = await r.engine.enqueue(r.request()),
    done = await r.engine.process(q.id);
  assert.equal(done.job.state, "complete");
  assert.equal(r.calls.patch, 1);
  assert.equal(r.calls.post, 1);
});
test("SharePoint 403: ไม่แจ้ง Teams และยังไม่เปลี่ยนข้อมูลหลัก", async () => {
  let r = setup();
  r.fault.sp403 = true;
  let q = await r.engine.enqueue(r.request()),
    blocked = await r.engine.process(q.id);
  assert.equal(blocked.job.targets.sharepoint.state, "blocked");
  assert.equal(r.calls.post, 0);
  assert.equal(r.project().data.pstat, undefined);
  r.fault.sp403 = false;
  await r.create().process(q.id);
  assert.equal(r.calls.post, 1);
});
test("eTag เก่าหรือ revision เก่าไม่เขียนทับข้อมูลใหม่", async () => {
  for (let kind of ["etag", "revision"]) {
    let r = setup(),
      input = r.request();
    if (kind === "etag") r.list.etag = "l-new";
    else r.project().data.syncRevision = 1;
    let q = await r.engine.enqueue(input),
      done = await r.engine.process(q.id);
    assert.equal(done.job.state, "conflict");
    assert.equal(r.calls.patch, 0);
    assert.equal(r.calls.post, 0);
  }
});
test("รับคำสั่งซ้ำคืนแถวเดิม และไม่รับ key เดิมกับรายละเอียดใหม่", async () => {
  let r = setup(),
    input = r.request(),
    a = await r.engine.enqueue(input),
    b = await r.engine.enqueue(input);
  assert.equal(a.id, b.id);
  assert.equal(r.calls.created, 1);
  await assert.rejects(
    r.engine.enqueue({ ...input, values: { status: "won" } }),
    /ข้อมูลอื่น/,
  );
});
test("POST คิว timeout แต่สร้างแล้ว ตรวจ OperationKey แล้วคืนแถวเดิม", async () => {
  let r = setup();
  r.fault.createAfter = true;
  let q = await r.engine.enqueue(r.request());
  assert.ok(q.id);
  assert.equal(r.calls.created, 1);
});
test("สอง worker หรือการกดพร้อมกันยึด eTag เดียวได้เพียงครั้งเดียว", async () => {
  let r = setup(),
    q = await r.engine.enqueue(r.request());
  await Promise.all([r.engine.process(q.id), r.create().process(q.id)]);
  assert.equal(r.calls.post, 1);
  assert.equal(r.calls.patch, 1);
});
test("สองคำสั่งใช้ revision เดิม คำสั่งที่ตามหลังไม่ทับงานแรก", async () => {
  let r = setup(),
    a = await r.engine.enqueue(r.request()),
    b = await r.engine.enqueue(r.request("web:demo-0002", "won"));
  await r.engine.process(a.id);
  let result = await r.engine.process(b.id);
  assert.equal(result.job.state, "conflict");
  assert.equal(r.calls.post, 1);
});
test("ถูกลดสิทธิ์ระหว่างเข้าคิว ปฏิเสธก่อนแก้ข้อมูลหรือส่ง Teams", async () => {
  let r = setup(),
    q = await r.engine.enqueue(r.request());
  r.authorise(false);
  let blocked = await r.engine.process(q.id);
  assert.equal(blocked.job.targets.sharepoint.state, "blocked");
  assert.equal(r.calls.patch, 0);
  assert.equal(r.calls.post, 0);
});
test("บันทึกเลขข้อความไม่สำเร็จ กู้จาก sending marker โดยไม่ส่งซ้ำ", async () => {
  let r = setup(),
    q = await r.engine.enqueue(r.request());
  r.fault.saveAfterPost = true;
  try {
    await r.engine.process(q.id);
  } catch {}
  await r.create().process(q.id);
  assert.equal(r.calls.post, 1);
  assert.equal((await r.adapter.loadJob(q.id)).job.state, "complete");
});
test("บันทึกเสร็จแต่ปลด active ไม่สำเร็จ รอบใหม่ซ่อมสถานะโดยไม่ส่งซ้ำ", async () => {
  let r = setup(),
    q = await r.engine.enqueue(r.request());
  r.fault.release = true;
  await r.engine.process(q.id);
  assert.ok(r.project().data.syncActive);
  await r.create().process(q.id);
  assert.equal(r.project().data.syncActive, undefined);
  assert.equal(r.calls.post, 1);
});
test("Admin ข้าม Teams ต้องมีเหตุผลและ SharePoint สำเร็จก่อน พร้อมสถานะ skipped", async () => {
  let r = setup();
  r.fault.postBefore = true;
  let q = await r.engine.enqueue(r.request());
  await r.engine.process(q.id);
  await assert.rejects(r.engine.finish(q.id, "skip_teams", ""), /เหตุผล/);
  let result = await r.engine.finish(
    q.id,
    "skip_teams",
    "ตรวจใน Teams แล้ว ขอข้ามครั้งนี้",
  );
  assert.equal(result.job.state, "skipped");
  assert.equal(result.job.targets.teams.state, "skipped");
  assert.equal(r.project().data.syncActive, undefined);
  await r.engine.process(q.id);
  assert.equal(r.calls.post, 1);
});
test("คนที่ไม่ใช่ Admin ยกเลิกหรือข้ามคิวไม่ได้", async () => {
  let r = setup(),
    q = await r.engine.enqueue(r.request());
  r.admin(false);
  await assert.rejects(
    r.engine.finish(q.id, "cancel", "test"),
    (e) => e.status === 403,
  );
});
test("โครงการไม่มี Channel ระบุ not_applicable แยกจากการโพสต์สำเร็จ", async () => {
  let r = setup();
  r.fault.noChannel = true;
  let q = await r.engine.enqueue(r.request()),
    done = await r.engine.process(q.id);
  assert.equal(done.job.state, "complete");
  assert.equal(done.job.targets.teams.state, "not_applicable");
  assert.equal(r.calls.post, 0);
});
