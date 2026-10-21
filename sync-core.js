/* v16.41 คิวซิงก์ถาวร ใช้เครื่องเดียวกันทั้งเว็บและ worker — ไม่มี token หรือข้อมูลบริษัทในโมดูลนี้ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NineSync = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  class SyncError extends Error {
    constructor(message, status = 409) {
      super(message);
      this.status = status;
    }
  }
  const clone = (x) => JSON.parse(JSON.stringify(x)),
    terminal = (s) => ["complete", "skipped", "cancelled"].includes(s);
  const stable = (x) =>
    JSON.stringify(x, function (k, v) {
      return v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, v[k]]),
          )
        : v;
    });
  const same = (a, b) => stable(a) === stable(b),
    safeError = (e) =>
      String(e?.message || e || "ไม่ทราบข้อผิดพลาด").slice(0, 600);
  const target = (state = "pending", note = "") => ({ state, note, at: "" });
  function summary(job) {
    if (!job) return "legacy";
    if (["cancelled", "skipped"].includes(job.state)) return job.state;
    let t = Object.values(job.targets || {});
    if (t.some((x) => x.state === "uncertain" || x.state === "sending"))
      return "uncertain";
    if (t.some((x) => x.state === "conflict")) return "conflict";
    if (t.every((x) => ["verified", "not_applicable"].includes(x.state)))
      return "complete";
    if (t.some((x) => x.state === "skipped")) return "skipped";
    if (t.some((x) => x.state === "failed" || x.state === "blocked"))
      return t.some((x) => x.state === "verified") ? "partial" : "failed";
    return "pending";
  }
  function create(adapter, options = {}) {
    const now = options.now || (() => Date.now()),
      uid = options.uid || (() => crypto.randomUUID()),
      leaseMs = options.leaseMs || 300000,
      flights = new Map();
    const stamp = () => new Date(now()).toISOString();
    async function save(record, job) {
      job.updatedAt = stamp();
      job.state = summary(job);
      return adapter.saveJob(record, job);
    }
    async function enqueue(request) {
      await adapter.ready();
      if (
        !request ||
        request.v !== 1 ||
        typeof request.key !== "string" ||
        !/^[a-zA-Z0-9:_.,{}"\-]{8,240}$/.test(request.key)
      )
        throw new SyncError("รหัสคำสั่งไม่ถูกต้อง", 400);
      if (new TextEncoder().encode(JSON.stringify(request)).length > 24000)
        throw new SyncError("ข้อมูลคำสั่งใหญ่เกินกำหนด", 400);
      let previous = await adapter.findJob(request.key);
      if (previous) {
        if (!same(previous.job.request, request))
          throw new SyncError("รหัสคำสั่งนี้ถูกใช้กับข้อมูลอื่นแล้ว");
        return previous;
      }
      await adapter.preflight(request);
      let job = {
        v: 1,
        request: clone(request),
        createdAt: stamp(),
        updatedAt: stamp(),
        state: "pending",
        targets: { sharepoint: target(), teams: target() },
        attempts: 0,
        lease: null,
        history: [],
      };
      try {
        return await adapter.createJob(job);
      } catch (e) {
        if (!e.status || [409, 503, 504].includes(e.status)) {
          let found = await adapter.findJob(request.key);
          if (found && same(found.job.request, request)) return found;
        }
        throw e;
      }
    }
    async function process(id) {
      if (flights.has(String(id))) return flights.get(String(id));
      let task = run(String(id));
      flights.set(String(id), task);
      try {
        return await task;
      } finally {
        flights.delete(String(id));
      }
    }
    async function release(id, job) {
      let p = await adapter.loadProject(job.request.projectId);
      if (p.data.syncActive?.jobId === String(id)) {
        let next = {
          ...p.data,
          ...(adapter.publication
            ? { syncPublished: job.publication || adapter.publication(p.data) }
            : {}),
          syncLast: {
            jobId: String(id),
            key: job.request.key,
            state: summary(job),
            targets: clone(job.targets),
            at: stamp(),
          },
        };
        delete next.syncActive;
        await adapter.saveProject(p, next);
      }
    }
    async function run(id) {
      await adapter.ready();
      await adapter.requireAdmin();
      let record = await adapter.loadJob(id),
        job = clone(record.job);
      if (adapter.isTrusted && !(await adapter.isTrusted(record))) {
        job = {
          v: 1,
          request: job.request,
          createdAt: record.raw.createdDateTime || stamp(),
          updatedAt: stamp(),
          state: "pending",
          targets: { sharepoint: target(), teams: target() },
          attempts: 0,
          lease: null,
          history: [],
        };
        try {
          let p = await adapter.loadProject(job.request.projectId, record);
          if (p.data.syncActive?.jobId === id && p.data.syncActive.applied)
            job.targets.teams = target("uncertain");
        } catch (e) {
          job.targets.sharepoint = target(
            [409, 412].includes(e.status)
              ? "conflict"
              : [401, 403].includes(e.status)
                ? "blocked"
                : "failed",
            safeError(e),
          );
          job.targets.sharepoint.at = stamp();
          return save(record, job);
        }
      }
      if (terminal(job.state)) {
        await release(id, job);
        return record;
      }
      if (job.lease && Date.parse(job.lease.until) > now()) return record;
      let token = uid();
      job.lease = { token, until: new Date(now() + leaseMs).toISOString() };
      job.attempts = (job.attempts || 0) + 1;
      try {
        record = await save(record, job);
      } catch (e) {
        if (e.status === 412 || e.status === 409) return adapter.loadJob(id);
        throw e;
      }
      let project, plan;
      const update = async () => {
        job.lease.until = new Date(now() + leaseMs).toISOString();
        record = await save(record, job);
      };
      const fail = async (destination, e, state) => {
        let t = job.targets[destination];
        t.state =
          state ||
          ([409, 412].includes(e.status)
            ? "conflict"
            : [401, 403].includes(e.status)
              ? "blocked"
              : "failed");
        t.note = safeError(e);
        t.at = stamp();
        await update();
      };
      try {
        project = await adapter.loadProject(job.request.projectId, record);
        plan = await adapter.plan(record, project);
        let digest = stable(plan.intent),
          active = project.data.syncActive,
          expected = adapter.publication
            ? adapter.publication({
                ...project.data,
                ...(project.data.syncActive?.applied ? {} : plan.track || {}),
              })
            : null;
        if (expected) {
          if (active?.publication && !same(active.publication, expected))
            throw new SyncError("ข้อมูลทะเบียนเปลี่ยนระหว่างคำสั่งซิงก์");
          job.publication = active?.publication || expected;
        }
        if (!job.audit) {
          job.audit = {
            at: stamp(),
            actor: {
              oid: plan.actor.originOid || plan.actor.oid || "",
              name: plan.actor.name,
            },
            source: plan.source,
            before: clone(plan.before || {}),
            after: clone(plan.after || {}),
          };
          await update();
        }
        if (active && active.jobId !== id)
          throw new SyncError(
            "โครงการมีคำสั่งก่อนหน้าค้างอยู่ ให้ตรวจหรือจบคำสั่งนั้นก่อน",
          );
        if (active && active.digest !== digest)
          throw new SyncError(
            "รายละเอียดคำสั่งเปลี่ยนหลังรับเข้าคิว ต้องยกเลิกแล้วสร้างคำสั่งใหม่",
          );
        if (!active) {
          if (
            Number(job.request.base?.revision || 0) !==
            Number(project.data.syncRevision || 0)
          )
            throw new SyncError(
              "มีข้อมูลโครงการใหม่หลังเปิดฟอร์ม กรุณาโหลดข้อมูลล่าสุด",
            );
          let next = {
            ...project.data,
            syncRevision: Number(project.data.syncRevision || 0) + 1,
            syncActive: {
              jobId: id,
              digest,
              at: stamp(),
              ...(job.publication ? { publication: job.publication } : {}),
            },
          };
          project = await adapter.saveProject(project, next);
        }
        if (job.targets.sharepoint.state !== "verified") {
          try {
            let current = await adapter.readList(project),
              fields = plan.fields || {};
            if (
              Object.keys(fields).length &&
              !adapter.fieldsEqual(current.fields, fields)
            ) {
              if (current.etag !== job.request.base?.listETag)
                throw new SyncError(
                  "รายการ SharePoint ถูกแก้ไขแล้ว กรุณาตรวจค่าปัจจุบันก่อนทำต่อ",
                );
              job.targets.sharepoint = target(
                "sending",
                "กำลังเขียนและตรวจผลใน SharePoint",
              );
              await update();
              try {
                await adapter.patchList(project, fields, current.etag);
              } catch (e) {
                if (e.status && ![503, 504].includes(e.status)) throw e;
                current = await adapter.readList(project);
                if (!adapter.fieldsEqual(current.fields, fields)) {
                  await fail("sharepoint", e, "uncertain");
                  return record;
                }
              }
              current = await adapter.readList(project);
              if (!adapter.fieldsEqual(current.fields, fields)) {
                await fail(
                  "sharepoint",
                  new SyncError("ยังอ่านยืนยันค่าที่เขียนใน SharePoint ไม่ได้"),
                  "uncertain",
                );
                return record;
              }
            }
            project = await adapter.loadProject(job.request.projectId);
            if (
              project.data.syncActive?.jobId !== id ||
              project.data.syncActive.digest !== digest
            )
              throw new SyncError("สิทธิ์ครอบครองงานซิงก์เปลี่ยนแล้ว");
            if (!project.data.syncActive.applied) {
              if (
                adapter.publication &&
                plan.guard &&
                !same(adapter.publication(project.data), plan.guard)
              )
                throw new SyncError(
                  "ทะเบียนถูกแก้ระหว่างเขียน SharePoint ต้องตรวจค่าล่าสุด",
                );
              let patch = clone(plan.track || {}),
                history = [
                  {
                    id: job.request.key,
                    at: stamp(),
                    by: plan.actor.name,
                    source: plan.source,
                    before: plan.before,
                    after: plan.after,
                  },
                  ...(project.data.syncHistory || []),
                ].slice(0, 16);
              let activity = {
                id: job.request.key,
                actor: plan.actor.name,
                action: "ซิงก์ข้อมูลโครงการ",
                note: Object.entries(plan.after || {})
                  .map(
                    ([k, v]) =>
                      k +
                      ": " +
                      (typeof v === "object" ? JSON.stringify(v) : v),
                  )
                  .join(" · ")
                  .slice(0, 2000),
                createdAt: stamp(),
              };
              project = await adapter.saveProject(project, {
                ...project.data,
                ...patch,
                version: Number(project.data.version || 1) + 1,
                activities: [
                  activity,
                  ...(project.data.activities || []),
                ].slice(0, 80),
                syncActive: { ...project.data.syncActive, applied: true },
                syncObserved: adapter.observation(current),
                syncHistory: history,
                updatedAt: stamp(),
              });
            }
            job.targets.sharepoint = target(
              "verified",
              "อ่านยืนยันข้อมูลใน SharePoint แล้ว",
            );
            job.targets.sharepoint.at = stamp();
            await update();
          } catch (e) {
            await fail("sharepoint", e);
            return record;
          }
        }
        if (adapter.publication) {
          let fresh = await adapter.loadProject(job.request.projectId);
          if (!same(adapter.publication(fresh.data), job.publication))
            throw new SyncError(
              "ทะเบียนมีข้อมูลใหม่ก่อนแจ้ง Teams กรุณาตรวจผล",
            );
        }
        if (!plan.channel) {
          job.targets.teams = target(
            "not_applicable",
            plan.noTeamReason || "รายการนี้ไม่มี Channel ที่เชื่อมอยู่",
          );
          job.targets.teams.at = stamp();
          await update();
        } else if (job.targets.teams.state !== "verified") {
          let t = job.targets.teams;
          try {
            if (
              t.state === "sending" ||
              t.state === "uncertain" ||
              t.messageId
            ) {
              let found = await adapter.findMessage(
                plan.channel,
                job.request.key,
                t.messageId,
              );
              if (!found) {
                await fail(
                  "teams",
                  new SyncError(
                    "ยังไม่พบหลักฐานข้อความเดิม จึงไม่ส่งซ้ำ กรุณาตรวจผลหรือให้ Admin ข้ามการแจ้งครั้งนี้",
                  ),
                  "uncertain",
                );
                return record;
              }
              t.messageId = found.id;
              t.url = found.webUrl || "";
            } else {
              t.state = "sending";
              t.note = "กำลังส่งและตรวจข้อความใน Teams";
              t.at = stamp();
              await update();
              let posted;
              try {
                posted = await adapter.postMessage(plan, job.request.key);
              } catch (e) {
                await fail(
                  "teams",
                  e,
                  !e.status || [503, 504].includes(e.status)
                    ? "uncertain"
                    : "blocked",
                );
                return record;
              }
              t.messageId = posted?.id || "";
              if (!t.messageId) {
                await fail(
                  "teams",
                  new SyncError("Microsoft ไม่คืนเลขข้อความ จึงต้องตรวจผลก่อน"),
                  "uncertain",
                );
                return record;
              }
              await update();
              let verified = await adapter.findMessage(
                plan.channel,
                job.request.key,
                t.messageId,
              );
              if (!verified) {
                await fail(
                  "teams",
                  new SyncError("ส่งคำสั่งแล้ว แต่ยังอ่านยืนยันข้อความไม่ได้"),
                  "uncertain",
                );
                return record;
              }
              t.url = verified.webUrl || "";
            }
            t.state = "verified";
            t.note = "อ่านยืนยันข้อความใน Teams แล้ว";
            t.at = stamp();
            await update();
          } catch (e) {
            await fail(
              "teams",
              e,
              t.state === "sending" ? "uncertain" : undefined,
            );
            return record;
          }
        }
        job.history = [
          { at: stamp(), action: "verified", by: plan.actor.name },
          ...(job.history || []),
        ].slice(0, 16);
        job.lease = null;
        record = await save(record, job);
        await release(id, job);
        return record;
      } catch (e) {
        if (!terminal(job.state))
          await fail(
            job.targets.sharepoint.state === "verified"
              ? "teams"
              : "sharepoint",
            e,
          );
        return record;
      } finally {
        try {
          let latest = await adapter.loadJob(id);
          if (latest.job.lease?.token === token) {
            let next = clone(latest.job);
            next.lease = null;
            await save(latest, next);
          }
        } catch {}
      }
    }
    async function finish(id, action, reason) {
      await adapter.ready();
      await adapter.requireAdmin();
      if (
        !["skip_teams", "cancel"].includes(action) ||
        !String(reason || "").trim()
      )
        throw new SyncError("ระบุคำสั่งและเหตุผล", 400);
      let r = await adapter.loadJob(String(id)),
        job = clone(r.job);
      if (job.lease && Date.parse(job.lease.until) > now())
        throw new SyncError("งานกำลังประมวลผล กรุณารอแล้วตรวจอีกครั้ง");
      if (terminal(job.state)) return r;
      if (
        action === "skip_teams" &&
        job.targets.sharepoint.state !== "verified"
      )
        throw new SyncError("ต้องยืนยัน SharePoint สำเร็จก่อนข้าม Teams");
      if (action === "skip_teams") {
        job.targets.teams = target("skipped", String(reason).slice(0, 500));
        job.state = "skipped";
      } else job.state = "cancelled";
      job.history = [
        { at: stamp(), action, reason: String(reason).slice(0, 500) },
        ...(job.history || []),
      ].slice(0, 16);
      r = await adapter.saveJob(r, job);
      let p = await adapter.loadProject(job.request.projectId);
      if (p.data.syncActive?.jobId === String(id)) {
        let data = {
          ...p.data,
          ...(adapter.publication
            ? { syncPublished: job.publication || adapter.publication(p.data) }
            : {}),
          syncLast: {
            jobId: String(id),
            key: job.request.key,
            state: job.state,
            targets: job.targets,
            at: stamp(),
          },
        };
        delete data.syncActive;
        await adapter.saveProject(p, data);
      }
      return r;
    }
    return { enqueue, process, finish };
  }
  return { SyncError, create, summary, stable, same, terminal };
});
