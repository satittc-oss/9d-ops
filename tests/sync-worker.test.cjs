const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  W = require("../sync-worker/worker.cjs"),
  F = require("./sync-fixture.js");
test("ไม่มีใครเปิดเว็บ: Node worker ประมวลผลคิวจาก Sales และคำสั่ง Teams สำเร็จ", async () => {
  let f = F.create(),
    sales = f.makeClient(f.users[2]);
  await sales.engine.enqueue(
    await sales.request("sp-1", "status", { value: "lost" }),
  );
  let r = await W.runOnce({ client: f.client, apply: true, scan: 3 });
  assert.equal(r.processed, 1);
  assert.equal(
    JSON.parse(f.lists.directory[0].fields.DirectoryJson).pstat.s,
    "lost",
  );
  assert.ok((await f.client.health()).data.workerAt);
  f.addMessage("channel-1", "#WIN");
  await W.runOnce({ client: f.makeClient(f.actor), apply: true, scan: 3 });
  assert.equal(
    JSON.parse(f.lists.directory[0].fields.DirectoryJson).pstat.s,
    "won",
  );
});
test("worker check เป็น read-only ไม่มี heartbeat หรือคำสั่งเขียน", async () => {
  let f = F.create();
  let r = await W.runOnce({ client: f.client });
  assert.equal(r.mode, "check");
  assert.equal(
    f.calls.some((c) => c.method !== "GET"),
    false,
  );
});
test("worker retry GET ที่ 429; POST timeout ไม่ retry และไม่เผย token", async () => {
  let calls = [],
    tokens = [],
    sleep = [];
  let transport = W.createTransport(
    { siteHost: "tenant.sharepoint.com", sitePath: "/sites/test" },
    async (r) => {
      tokens.push(r);
      return "secret-test";
    },
    {
      sleep: async (ms) => sleep.push(ms),
      fetch: async (u, o) => {
        calls.push({ u, o });
        if (o.method === "POST") throw Error("secret-test");
        return new Response(JSON.stringify({ value: [] }), {
          status: calls.length === 1 ? 429 : 200,
          headers: { "Retry-After": "2" },
        });
      },
    },
  );
  await transport.graph("/sites/test");
  assert.equal(calls.length, 2);
  assert.deepEqual(sleep, [2000]);
  await assert.rejects(
    transport.graph("/sites/test", { method: "POST", json: {} }),
    (e) => e.status === 504 && !e.message.includes("secret-test"),
  );
  assert.equal(calls.length, 3);
  await transport.sp("/web");
  assert.equal(tokens.at(-1), "sharepoint");
});
test("worker ปฏิเสธ URL ต่างโดเมนและ CLI/config ผิด โดยไม่เรียก Microsoft", async () => {
  let t = W.createTransport(
    { siteHost: "tenant.sharepoint.com", sitePath: "/sites/test" },
    async () => {
      throw Error("must not run");
    },
  );
  await assert.rejects(t.graph("https://evil.invalid/a"));
  await assert.rejects(t.sp("//evil.invalid"));
  assert.throws(() => W.args(["--apply"]));
  assert.throws(() => W.config({ v: 1, siteHost: "evil.invalid" }));
  assert.equal(W.args(["--config", "/tmp/test.json"]).apply, false);
});
