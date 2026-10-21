/* v16.41 Microsoft 365 adapter ร่วมเว็บ/worker: คิว own-items + ทะเบียนกลางที่ Admin เขียนได้ */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./sync-core.js"));
  else root.NineSyncM365 = factory(root.NineSync);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";
  const E = Core.SyncError,
    copy = (x) => JSON.parse(JSON.stringify(x)),
    enc = encodeURIComponent,
    esc = (x) =>
      String(x ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    email = (x) =>
      String(x || "")
        .trim()
        .toLowerCase();
  const STATUS = {
    active: { label: "กำลังทำ", latest: "In Progress", result: "Process" },
    delivered: {
      label: "ส่งงานแล้ว · รอลูกค้า",
      latest: "Finish",
      result: "Process",
    },
    won: { label: "ปิด · WIN", latest: "Finish", result: "WIN" },
    lost: { label: "ปิด · LOSS", latest: "Loss", result: "LOSS" },
    cancelled: { label: "ปิด · ยกเลิก", latest: "Loss", result: "LOSS" },
  };
  const STEPS = {
    recv: { label: "รับงานแล้ว · กำลังดำเนินการ", who: "เรา", days: 0 },
    design: { label: "ทำ BOM / ออกแบบ", who: "เรา", days: 3 },
    buy: { label: "ประสานจัดซื้อ", who: "จัดซื้อ", days: 7 },
    sup: { label: "รอซัพพลายเออร์", who: "Supplier", days: 7 },
    price: { label: "รอราคา", who: "Supplier / จัดซื้อ", days: 7 },
    sales: { label: "รอเซลส์", who: "Sales", days: 7 },
    quote: { label: "ส่งราคาแล้ว", who: "ลูกค้า", days: 14 },
    cust: { label: "รอลูกค้า", who: "ลูกค้า", days: 14 },
  };
  const REQUEST = {
    name: [200],
    client: [200],
    source: [200],
    brands: [200, true],
    workTypes: [200, true],
    notes: [4000],
    urgency: [200],
    closingChance: [200],
    assignedAt: [32],
    estimatedValue: [200],
  };
  const TRACK = {
    engineer: 100,
    due: 10,
    followup: 10,
    waitingOn: 100,
    nextAction: 1000,
    summary: 4000,
    priority: 12,
    salesSummary: 4000,
  };
  const QUEUE_NAME = "9D Sync Queue",
    DIRECTORY_NAME = "9D Sync Directory";
  function text(x, max, required = false) {
    if (
      typeof x !== "string" ||
      x.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x)
    )
      throw new E("ข้อความไม่ถูกต้องหรือยาวเกินกำหนด", 400);
    x = x.trim();
    if (required && !x) throw new E("กรอกข้อมูลที่จำเป็นให้ครบ", 400);
    return x;
  }
  function date(x, datetime = false) {
    if (!x) return "";
    let re = datetime
      ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
      : /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(x)) throw new E("รูปแบบวันที่ไม่ถูกต้อง", 400);
    let d = new Date(x + (datetime ? ":00+07:00" : "T00:00:00Z"));
    if (
      !isFinite(d.getTime()) ||
      new Date(x.slice(0, 10) + "T00:00:00Z").toISOString().slice(0, 10) !==
        x.slice(0, 10)
    )
      throw new E("วันที่ไม่ถูกต้อง", 400);
    return datetime ? d.toISOString() : x;
  }
  function json(s, label) {
    try {
      let x = typeof s === "string" ? JSON.parse(s) : s;
      if (!x || typeof x !== "object" || Array.isArray(x)) throw Error();
      return x;
    } catch {
      throw new E("อ่าน " + label + " ไม่สำเร็จ จึงยังไม่เขียนทับ");
    }
  }
  function fieldsEqual(actual, desired) {
    return Object.entries(desired)
      .filter(([k]) => !k.endsWith("@odata.type"))
      .every(([k, v]) => {
        let a = actual[k];
        if (a == null && v === "") return true;
        if (Array.isArray(v))
          return Array.isArray(a) && Core.same([...a].sort(), [...v].sort());
        return String(a ?? "") === String(v ?? "");
      });
  }
  function listStatus(fields, columns) {
    let v = (k) => fields[columns[k]?.name],
      w = String(v("winLoss") || "").toUpperCase(),
      l = String(v("latest") || "").toLowerCase();
    return w === "WIN"
      ? "won"
      : w === "LOSS" || l === "loss"
        ? "lost"
        : l === "finish"
          ? "delivered"
          : "active";
  }
  function command(t) {
    t = String(t || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ");
    if (t.includes("[9D]") || t.includes("9D Sync ·")) return null;
    let found = [];
    for (let [re, k] of [
      [/#(?:ส่งงานแล้ว|ส่งงาน|delivered)(?![a-z])/i, "delivered"],
      [/#(?:เปิดงานใหม่|reopen)(?![a-z])/i, "active"],
      [/#(?:win|ได้งาน)(?![a-z])/i, "won"],
      [/#(?:loss|lose|ไม่ได้งาน)(?![a-z])/i, "lost"],
      [/#(?:ยกเลิก|cancel)(?![a-z])/i, "cancelled"],
    ])
      if (re.test(t)) found.push({ kind: "status", value: k });
    for (let [re, k] of [
      [/#(?:ทำBOM|ออกแบบ)/i, "design"],
      [/#รอจัดซื้อ/, "buy"],
      [/#รอซัพ/, "sup"],
      [/#รอราคา/, "price"],
      [/#รอเซลส์/, "sales"],
      [/#ส่งราคา/, "quote"],
      [/#รอลูกค้า/, "cust"],
    ])
      if (re.test(t)) found.push({ kind: "step", value: k });
    return found.length === 1 ? found[0] : null;
  }
  function workflow(input) {
    let d = {
      v: 1,
      enabled: false,
      notify: true,
      pollSeconds: 60,
      warnDays: Object.fromEntries(
        Object.entries(STEPS).map(([k, s]) => [k, s.days]),
      ),
      disabled: [],
      commandDays: 30,
    };
    if (!input) return d;
    if (input.v !== 1) throw new E("รูปแบบ Flow ไม่รองรับ");
    for (let k of ["enabled", "notify"])
      if (input[k] !== undefined) {
        if (typeof input[k] !== "boolean")
          throw new E("ค่าเปิด/ปิด Flow ไม่ถูกต้อง", 400);
        d[k] = input[k];
      }
    for (let [k, min, max] of [
      ["pollSeconds", 30, 900],
      ["commandDays", 1, 90],
    ])
      if (input[k] !== undefined) {
        if (!Number.isInteger(input[k]) || input[k] < min || input[k] > max)
          throw new E("ช่วงเวลาของ Flow ไม่ถูกต้อง", 400);
        d[k] = input[k];
      }
    for (let [k, v] of Object.entries(input.warnDays || {})) {
      if (!STEPS[k] || !Number.isInteger(v) || v < 0 || v > 365)
        throw new E("จำนวนวันเตือนไม่ถูกต้อง", 400);
      d.warnDays[k] = v;
    }
    if (input.disabled !== undefined) {
      let keys = [
        ...Object.keys(STATUS).map((k) => "status:" + k),
        ...Object.keys(STEPS).map((k) => "step:" + k),
      ];
      if (
        !Array.isArray(input.disabled) ||
        input.disabled.some((k) => !keys.includes(k))
      )
        throw new E("กติกาเปลี่ยนขั้นตอนไม่ถูกต้อง", 400);
      d.disabled = [...new Set(input.disabled)];
    }
    return d;
  }
  function createClient(options) {
    const cfg = options.config,
      G = options.graph,
      SP = options.sp,
      profile = options.profile,
      clock = options.now || (() => Date.now());
    let cached = null,
      readyAt = 0,
      settingsCache = null;
    const users = new Map(),
      prefix = "/sites/" + enc(cfg.siteId) + "/lists/",
      now = () => new Date(clock()).toISOString();
    if (!cfg.siteId || !cfg.projectListId || !cfg.trackingListId)
      throw new E("ข้อมูลเชื่อมต่อ Workspace ไม่ครบ");
    const path = (list, id, fields = false) =>
      prefix +
      enc(list) +
      "/items" +
      (id ? "/" + enc(id) : "") +
      (fields ? "/fields" : "");
    async function all(url) {
      let out = [],
        seen = new Set();
      for (let n = 0; url; n++) {
        if (n >= 200 || seen.has(url))
          throw new E(
            "ข้อมูลมีมากเกินรอบอ่านหรือ nextLink วนซ้ำ กรุณาลดขอบเขตแล้วตรวจใหม่",
          );
        seen.add(url);
        if (
          url.startsWith("http") &&
          !url.startsWith("https://graph.microsoft.com/v1.0/")
        )
          throw new E("nextLink ไม่ใช่ Microsoft Graph");
        let r = await G(url);
        out.push(...(r.value || []));
        url = r["@odata.nextLink"];
      }
      return out;
    }
    async function settings(force = false) {
      if (settingsCache && !force && clock() - settingsCache.at < 10000)
        return settingsCache;
      let rows = cfg.settingsItemId
        ? [
            await G(
              path(cfg.trackingListId, cfg.settingsItemId) + "?$expand=fields",
            ),
          ]
        : await all(
            path(cfg.trackingListId) +
              "?$expand=fields&$filter=fields/ProjectItemId eq 0",
          );
      if (rows.length !== 1)
        throw new E("ต้องมีแถว settings กลางเพียงหนึ่งรายการ");
      let row = rows[0],
        data = json(row.fields?.Payload || "{}", "settings");
      settingsCache = { row, data, at: clock() };
      return settingsCache;
    }
    function role(s, e) {
      return (
        (s.members || []).find((m) => email(m.email) === email(e))?.role ||
        "viewer"
      );
    }
    async function current() {
      let me = await profile(),
        s = await settings();
      if (!me.oid || !me.email) throw new E("ยังไม่ยืนยันบัญชี Microsoft", 401);
      return { ...me, email: email(me.email), role: role(s.data, me.email) };
    }
    async function user(id) {
      if (users.has(id)) return users.get(id);
      let u = await G(
        "/users/" + enc(id) + "?$select=id,displayName,mail,userPrincipalName",
      );
      if (!u.id) throw new E("ยืนยันตัวตนผู้สั่งงานไม่ได้", 403);
      let v = {
        oid: u.id,
        name: u.displayName || "",
        email: email(u.mail || u.userPrincipalName),
      };
      users.set(id, v);
      return v;
    }
    async function author(record) {
      if (!record.raw.createdBy?.user?.id)
        throw new E("คำสั่งไม่มีผู้สร้างที่ Microsoft ยืนยัน", 403);
      let u = await user(record.raw.createdBy.user.id),
        s = await settings();
      return { ...u, role: role(s.data, u.email) };
    }
    async function policy(list) {
      return SP(
        `/web/lists(guid'${list}')?$select=ReadSecurity,WriteSecurity,HasUniqueRoleAssignments,EffectiveBasePermissions`,
      );
    }
    async function ready(force = false) {
      if (cached && !force && clock() - readyAt < 10000) return cached;
      let s = await settings(force),
        access = s.data.syncAccess;
      if (access?.v !== 1 || !access.queueId || !access.directoryId)
        throw new E("ให้ Admin เตรียมคิวและทะเบียนซิงก์ก่อน", 409);
      let [q, d, f, protectedSettings] = await Promise.all([
        policy(access.queueId),
        policy(access.directoryId),
        SP(
          `/web/lists(guid'${access.queueId}')/fields/getbyinternalnameortitle('OperationKey')?$select=Indexed,EnforceUniqueValues`,
        ),
        SP(
          `/web/lists(guid'${cfg.trackingListId}')/items(${s.row.id})?$select=HasUniqueRoleAssignments`,
        ),
      ]);
      let uniqueFields = await Promise.all(
        ["ProjectRef", "ChannelKey"].map((name) =>
          SP(
            `/web/lists(guid'${access.directoryId}')/fields/getbyinternalnameortitle('${name}')?$select=Indexed,EnforceUniqueValues`,
          ),
        ),
      );
      if (uniqueFields.some((f) => !f.Indexed || !f.EnforceUniqueValues))
        throw new E("ทะเบียนกลางยังไม่มี unique index ที่จำเป็น", 403);
      if (
        q.ReadSecurity !== 2 ||
        q.WriteSecurity !== 2 ||
        !q.HasUniqueRoleAssignments ||
        !d.HasUniqueRoleAssignments ||
        !f.Indexed ||
        !f.EnforceUniqueValues ||
        !protectedSettings.HasUniqueRoleAssignments
      )
        throw new E(
          "การป้องกันคิวหรือ settings ยังไม่ครบ ให้ Admin ตั้งสิทธิ์อีกครั้ง",
          403,
        );
      let me = await current();
      if (
        me.role === "admin" &&
        !(Number(q.EffectiveBasePermissions?.Low) & 2048)
      )
        throw new E(
          "Admin บัญชีนี้ยังจัดการคิว Microsoft ไม่ได้ ให้ตั้งสิทธิ์อีกครั้ง",
          403,
        );
      cached = { ...access, me, workflow: workflow(s.data.workflowPolicy) };
      readyAt = clock();
      return cached;
    }
    async function requireAdmin() {
      await settings(true);
      let me = await current();
      if (me.role !== "admin") throw new E("เฉพาะ Admin เท่านั้น", 403);
      return me;
    }
    function fromJob(raw) {
      let job = json(raw.fields?.JobJson, "คำสั่งซิงก์");
      if (
        job.v !== 1 ||
        raw.fields.OperationKey !== job.request?.key ||
        Number(raw.fields.ProjectRef) !==
          Number(String(job.request?.projectId).replace(/^sp-/, ""))
      )
        throw new E("รูปแบบคำสั่งซิงก์ไม่ตรงกับแถว Microsoft");
      return {
        id: String(raw.id),
        etag: raw.eTag || raw["@odata.etag"],
        job,
        raw,
      };
    }
    async function isTrusted(record) {
      let id =
        record.raw.lastModifiedBy?.user?.id || record.raw.createdBy?.user?.id;
      if (!id) return false;
      try {
        let u = await user(id),
          s = await settings();
        return role(s.data, u.email) === "admin";
      } catch {
        return false;
      }
    }
    async function jobs() {
      let a = await ready(),
        me = await current(),
        u = await SP("/web/currentuser?$select=Id"),
        filter =
          me.role === "admin"
            ? ""
            : `&$filter=fields/AuthorLookupId eq '${u.Id}'`;
      let records = (
        await all(
          path(a.queueId) +
            "?$expand=fields&$select=id,eTag,createdBy,lastModifiedBy,createdDateTime,lastModifiedDateTime&$top=200" +
            filter,
        )
      ).map(fromJob);
      for (let r of records) {
        r.trusted = await isTrusted(r);
        if (!r.trusted) {
          r.job.state = "pending";
          r.job.targets = {
            sharepoint: { state: "pending", note: "รอ worker ตรวจคำสั่ง" },
            teams: { state: "pending", note: "รอ worker ตรวจคำสั่ง" },
          };
        }
      }
      return records;
    }
    async function findJob(key) {
      let a = await ready(),
        rows = await all(
          path(a.queueId) +
            "?$expand=fields&$filter=fields/OperationKey eq '" +
            key.replace(/'/g, "''") +
            "'&$top=2",
        );
      if (rows.length > 1) throw new E("พบรหัสคำสั่งซ้ำในคิว");
      return rows[0] ? fromJob(rows[0]) : null;
    }
    async function loadJob(id) {
      let a = await ready();
      if (!/^\d+$/.test(String(id))) throw new E("เลขคำสั่งไม่ถูกต้อง", 400);
      return fromJob(
        await G(
          path(a.queueId, id) +
            "?$expand=fields&$select=id,eTag,createdBy,lastModifiedBy,createdDateTime,lastModifiedDateTime",
        ),
      );
    }
    function jobFields(job) {
      let value = JSON.stringify(job);
      if (new TextEncoder().encode(value).length > 50000)
        throw new E("ข้อมูลคิวมีขนาดใหญ่เกินกำหนด", 400);
      return {
        Title: String(job.request.projectId),
        OperationKey: job.request.key,
        ProjectRef: Number(job.request.projectId.slice(3)),
        JobJson: value,
        State: job.state,
        TargetSP: job.targets.sharepoint.state,
        TargetTeams: job.targets.teams.state,
      };
    }
    async function createJob(job) {
      let a = await ready(),
        r = await G(path(a.queueId), {
          method: "POST",
          noRetry: true,
          json: { fields: jobFields(job) },
        });
      if (!r.id) throw new E("Microsoft ยังไม่ยืนยันเลขคำสั่ง", 504);
      return loadJob(r.id);
    }
    async function saveJob(record, job) {
      if (!record.etag) throw new E("คำสั่งไม่มี eTag");
      let a = await ready(),
        f = jobFields(job);
      await G(path(a.queueId, record.id, true), {
        method: "PATCH",
        noRetry: true,
        headers: { "If-Match": record.etag },
        json: f,
      });
      let r = await loadJob(record.id);
      if (!Core.same(r.job, job))
        throw new E("ยังยืนยันค่าที่บันทึกในคิวไม่ได้");
      return r;
    }
    const itemId = (pid) => {
      if (!/^sp-[1-9]\d*$/.test(String(pid)))
        throw new E("เลขโครงการไม่ถูกต้อง", 400);
      return pid.slice(3);
    };
    async function listItem(pid) {
      return G(
        path(cfg.projectListId, itemId(pid)) +
          "?$expand=fields&$select=id,eTag,createdBy,lastModifiedBy,createdDateTime,lastModifiedDateTime,webUrl",
      );
    }
    async function legacy(pid) {
      let rows = await all(
        path(cfg.trackingListId) +
          `?$expand=fields&$filter=fields/ProjectItemId eq ${itemId(pid)}&$top=20`,
      );
      if (rows.length > 1)
        throw new E("พบ Tracking เดิมซ้ำ ให้ Admin ตรวจรายการก่อนเริ่มซิงก์");
      return rows[0]
        ? json(rows[0].fields.Payload || "{}", "Tracking เดิม")
        : {};
    }
    async function directoryRows() {
      let a = await ready();
      return all(
        path(a.directoryId) +
          "?$expand=fields&$select=id,eTag,createdBy&$top=200",
      );
    }
    async function directory(pid) {
      let a = await ready(),
        rows = await all(
          path(a.directoryId) +
            `?$expand=fields&$filter=fields/ProjectRef eq ${itemId(pid)}&$top=2`,
        );
      if (rows.length > 1) throw new E("ทะเบียนโครงการซ้ำ");
      return rows[0] || null;
    }
    async function initial(pid, requestRecord) {
      let a = await ready(),
        main = await listItem(pid),
        old = await legacy(pid),
        actor = requestRecord ? await author(requestRecord) : await current(),
        owner = email(
          main.createdBy?.user?.email ||
            (await user(main.createdBy?.user?.id)).email,
        );
      if (!["admin", "engineer"].includes(actor.role) && actor.email !== owner)
        throw new E("เข้าถึงได้เฉพาะโครงการของตัวเอง", 403);
      if (old.onBehalf?.email) {
        let approved = requestRecord?.job.request.approvedOwner;
        if (
          actor.role !== "admin" ||
          email(approved) !== email(old.onBehalf.email)
        )
          throw new E("โครงการคีย์แทนต้องให้ Admin ตรวจและยืนยันเจ้าของก่อน");
        owner = email(approved);
      }
      let c = cfg.columns || {},
        get = (k) => main.fields?.[c[k]?.name];
      for (let k of Object.keys(old)) if (k.startsWith("sync")) delete old[k];
      if (!old.pstat)
        old.pstat = {
          s: listStatus(main.fields, c),
          at: main.lastModifiedDateTime || now(),
          via: "sharepoint",
        };
      if (!STATUS[old.pstat.s])
        throw new E("สถานะใน Tracking เดิมไม่รองรับ ให้ Admin ตรวจข้อมูลก่อน");
      if (
        !old.engineer &&
        c.engineer &&
        main.fields[c.engineer.name + "LookupId"]
      ) {
        let u = await SP(
            "/web/getuserbyid(" +
              Number(main.fields[c.engineer.name + "LookupId"]) +
              ")?$select=Email,Title",
          ),
          s = await settings(),
          member = (s.data.members || []).find(
            (m) =>
              email(m.email) === email(u.Email) &&
              ["admin", "engineer"].includes(m.role),
          );
        if (!member)
          throw new E(
            "Engineer เดิมยังไม่มีบทบาทในทะเบียนผู้ใช้ ให้ Admin ตรวจ",
          );
        old.engineer = member.name;
      }
      if (requestRecord?.job.request.kind === "binding") {
        delete old.teamId;
        delete old.channelId;
        delete old.channelUrl;
      } else if (old.channelId && old.teamId) {
        let channel = await G(
            `/teams/${enc(old.teamId)}/channels/${enc(old.channelId)}`,
          ),
          review = requestRecord?.job.request.reviewedChannel,
          confirmed =
            actor.role === "admin" &&
            review?.teamId === old.teamId &&
            review?.channelId === old.channelId;
        if (
          channel.id !== old.channelId ||
          (!confirmed &&
            !String(channel.displayName || "")
              .toLowerCase()
              .replace(/\s/g, "")
              .startsWith(
                String(get("code") || "")
                  .toLowerCase()
                  .replace(/\s/g, ""),
              ))
        )
          throw new E(
            "Channel เดิมไม่ตรงรหัส ให้ Admin ตรวจและยืนยันผ่านการเตรียมทะเบียนหรือการเชื่อม Channel",
          );
        old.channelUrl = channel.webUrl || "";
      }
      let data = {
        ...old,
        v: 1,
        projectId: pid,
        owner,
        code: get("code") || "#" + itemId(pid),
        name: get("name") || get("code") || "",
        client: get("client") || "",
        syncRevision: 0,
        syncHistory: [],
        syncObserved: observation({
          fields: main.fields,
          etag: main.eTag,
          raw: main,
        }),
      };
      delete data.itemId;
      if (new TextEncoder().encode(JSON.stringify(data)).length > 62000)
        throw new E(
          "ข้อมูล Tracking เดิมใหญ่เกินทะเบียนกลาง ให้ Admin ตรวจโดยไม่ตัดข้อมูล",
        );
      let me = await current();
      if (me.role !== "admin")
        throw new E("คำสั่งรอ Admin หรือ worker เตรียมทะเบียนกลาง", 409);
      let row;
      try {
        row = await G(path(a.directoryId), {
          method: "POST",
          noRetry: true,
          json: {
            fields: {
              Title: data.code,
              ProjectRef: Number(itemId(pid)),
              DirectoryJson: "{}",
            },
          },
        });
      } catch (e) {
        row = await directory(pid);
        if (!row) throw e;
      }
      if (!row?.id) throw new E("ยังไม่ยืนยันทะเบียนกลาง", 504);
      await secureDirectoryItem(a.directoryId, row.id, owner);
      row = await G(path(a.directoryId, row.id) + "?$expand=fields");
      await G(path(a.directoryId, row.id, true), {
        method: "PATCH",
        noRetry: true,
        headers: { "If-Match": row.eTag },
        json: {
          DirectoryJson: JSON.stringify(data),
          ...(data.channelId && data.teamId
            ? { ChannelKey: data.teamId + ":" + data.channelId }
            : {}),
        },
      });
      return directory(pid);
    }
    async function secureDirectoryItem(list, id, owner) {
      let L = `/web/lists(guid'${list}')/items(${Number(id)})`,
        r = await SP(L + "?$select=HasUniqueRoleAssignments");
      if (!r.HasUniqueRoleAssignments)
        await SP(
          L +
            "/breakroleinheritance(copyRoleAssignments=true,clearSubscopes=false)",
          { method: "POST", noRetry: true },
        );
      let u = await SP("/web/ensureuser", {
          method: "POST",
          json: { logonName: "i:0#.f|membership|" + owner },
        }),
        reader = (await SP("/web/roledefinitions/getbytype(2)?$select=Id")).Id;
      await SP(
        L +
          `/roleassignments/addroleassignment(principalid=${Number(u.Id)},roledefid=${Number(reader)})`,
        { method: "POST", noRetry: true },
      );
    }
    async function loadProject(pid, record) {
      let raw = await directory(pid);
      if (!raw || json(raw.fields.DirectoryJson || "{}", "ทะเบียน").v !== 1) {
        if (!record) throw new E("โครงการยังไม่ได้เตรียมทะเบียนซิงก์");
        raw = await initial(pid, record);
      }
      let data = json(raw.fields.DirectoryJson, "ทะเบียนโครงการ");
      if (data.projectId !== pid) throw new E("ทะเบียนโครงการไม่ตรงกัน");
      let main = await listItem(pid);
      return {
        pid,
        rowId: String(raw.id),
        etag: raw.eTag || raw["@odata.etag"],
        data,
        main,
        directoryModifiedBy: raw.lastModifiedBy?.user,
      };
    }
    async function saveProject(p, data) {
      await requireAdmin();
      if (!p.etag || data.projectId !== p.pid)
        throw new E("ทะเบียนไม่มีเวอร์ชันหรือรหัสไม่ตรงกัน");
      let a = await ready(),
        value = JSON.stringify(data);
      if (new TextEncoder().encode(value).length > 62000)
        throw new E("ประวัติโครงการมีขนาดใหญ่เกินกำหนด");
      let fields = {
        DirectoryJson: value,
        Title: data.code || p.data.code,
        ChannelKey:
          data.teamId && data.channelId
            ? data.teamId + ":" + data.channelId
            : null,
      };
      await G(path(a.directoryId, p.rowId, true), {
        method: "PATCH",
        noRetry: true,
        headers: { "If-Match": p.etag },
        json: fields,
      });
      let fresh = await loadProject(p.pid);
      if (!Core.same(fresh.data, data))
        throw new E("ยังอ่านยืนยันทะเบียนโครงการไม่ได้");
      return fresh;
    }
    async function context(pid) {
      let me = await current(),
        raw = await directory(pid),
        data = raw ? json(raw.fields.DirectoryJson || "{}", "ทะเบียน") : null,
        owner = data?.v === 1 ? data.owner : "";
      if (!["admin", "engineer"].includes(me.role)) {
        if (!owner) {
          let meta = await G(
            path(cfg.projectListId, itemId(pid)) + "?$select=id,createdBy",
          );
          owner = email(
            meta.createdBy?.user?.email ||
              (await user(meta.createdBy?.user?.id)).email,
          );
        }
        if (me.email !== owner) throw new E("ไม่มีสิทธิ์เข้าถึงโครงการ", 403);
      }
      let main = await listItem(pid);
      if (!data) data = await legacy(pid);
      owner =
        data.v === 1
          ? data.owner
          : email(
              data.onBehalf?.email ||
                main.createdBy?.user?.email ||
                (await user(main.createdBy.user.id)).email,
            );
      if (!["admin", "engineer"].includes(me.role) && me.email !== owner)
        throw new E("ไม่มีสิทธิ์เข้าถึงโครงการ", 403);
      return {
        main,
        data,
        owner,
        base: {
          listETag: main.eTag || main["@odata.etag"],
          revision: Number(data.syncRevision || 0),
        },
        ready: data.v === 1,
      };
    }

    function observation(current) {
      let fields = {};
      for (let [key, c] of Object.entries(cfg.columns || {}))
        if (
          REQUEST[key] ||
          [
            "latest",
            "winLoss",
            "step",
            "engineer",
            "approval",
            "legacyApproval",
          ].includes(key)
        )
          fields[c.type === "user" ? c.name + "LookupId" : c.name] =
            current.fields[c.type === "user" ? c.name + "LookupId" : c.name] ??
            null;
      return {
        etag: current.etag || current.raw?.eTag,
        fields,
        modified: current.raw?.lastModifiedDateTime || now(),
      };
    }
    async function sourceActor(record, p) {
      let r = record.job.request;
      if (r.source?.kind !== "teams") return author(record);
      let d = p.data;
      if (!d.teamId || !d.channelId) throw new E("โครงการยังไม่เชื่อม Channel");
      if (r.source.teamId !== d.teamId || r.source.channelId !== d.channelId)
        throw new E("Channel ต้นทางไม่ตรงกับทะเบียนกลาง", 403);
      let root = String(r.source.rootId || r.source.messageId || ""),
        mid = String(r.source.messageId || "");
      if (!root || !mid) throw new E("ไม่มีเลขข้อความต้นทาง", 400);
      let m = await G(
        `/teams/${enc(d.teamId)}/channels/${enc(d.channelId)}/messages/${enc(root)}` +
          (mid !== root ? "/replies/" + enc(mid) : ""),
      );
      if (m.deletedDateTime || !m.from?.user?.id)
        throw new E("ข้อความต้นทางถูกลบหรือยืนยันผู้สั่งไม่ได้", 403);
      let cmd = command(m.body?.content),
        wanted = r.values?.value;
      if (cmd?.kind !== r.kind || cmd.value !== wanted)
        throw new E("คำสั่งไม่ตรงกับข้อความ Teams ล่าสุด");
      if (
        Date.parse(m.createdDateTime) <
        clock() - (await ready()).workflow.commandDays * 864e5
      )
        throw new E("ข้อความเกินช่วงเวลารับคำสั่ง");
      let u = await user(m.from.user.id),
        s = await settings();
      return { ...u, role: role(s.data, u.email), message: m };
    }
    function allowed(actor, p, kind, values) {
      let own = actor.email === p.data.owner,
        staff = ["admin", "engineer"].includes(actor.role);
      if (actor.role === "viewer")
        throw new E("บทบาท Viewer อ่านข้อมูลโครงการได้อย่างเดียว", 403);
      if (!staff && !own) throw new E("เข้าถึงได้เฉพาะโครงการของตัวเอง", 403);
      if (kind === "edit" && actor.role !== "admin")
        throw new E("แก้ข้อมูลผ่านหลังบ้านได้เฉพาะ Admin", 403);
      if (
        ["binding", "mirror", "register", "reminder", "directory"].includes(
          kind,
        ) &&
        actor.role !== "admin"
      )
        throw new E("จัดการการเชื่อมต่อได้เฉพาะ Admin", 403);
      if (kind === "bootstrap" && !staff)
        throw new E("เชื่อมครั้งแรกได้เฉพาะ Engineer/Admin", 403);
      if (
        kind === "status" &&
        !staff &&
        !["won", "lost", "cancelled", "active"].includes(values.value)
      )
        throw new E("ส่งงานได้เฉพาะ Engineer/Admin", 403);
    }
    function publication(data) {
      let keys = [
        "code",
        "name",
        "client",
        "engineer",
        "due",
        "followup",
        "waitingOn",
        "nextAction",
        "summary",
        "priority",
        "salesSummary",
        "stage",
        "outcome",
        "pstat",
        "sub",
        "teamId",
        "channelId",
      ];
      return Object.fromEntries(keys.map((k) => [k, data[k] ?? null]));
    }
    async function verifyMainEditor(p, w) {
      let old = p.data.syncObserved?.fields || {},
        c = cfg.columns || {},
        changed = Object.keys(c).filter(
          (k) =>
            !Core.same(
              old[c[k].type === "user" ? c[k].name + "LookupId" : c[k].name] ??
                null,
              p.main.fields[
                c[k].type === "user" ? c[k].name + "LookupId" : c[k].name
              ] ?? null,
            ),
        ),
        business = changed.filter(
          (k) =>
            REQUEST[k] || ["latest", "winLoss", "step", "engineer"].includes(k),
        );
      if (!business.length) return;
      let id = p.main.lastModifiedBy?.user?.id;
      if (!id)
        throw new E(
          "ต้องให้ Admin ตรวจผู้แก้ Main List ที่ยืนยันตัวตนไม่ได้",
          403,
        );
      let u = await user(id),
        s = await settings(),
        r = role(s.data, u.email),
        staff = ["admin", "engineer"].includes(r);
      if (!staff && (r !== "sales" || u.email !== p.data.owner))
        throw new E(
          "ผู้แก้ SharePoint ไม่มีบทบาทหรือไม่ใช่เจ้าของโครงการ",
          403,
        );
      if (!staff && changed.includes("engineer"))
        throw new E("มอบหมาย Engineer ได้เฉพาะ Engineer/Admin", 403);
      if (
        r !== "admin" &&
        business.some((k) => REQUEST[k]) &&
        (/^approv/i.test(String(old[c.approval?.name] || "")) ||
          Number(old[c.legacyApproval?.name]) === 3)
      )
        throw new E(
          "เจ้าของแก้คำขอได้เฉพาะรออนุมัติ ให้ Admin ตรวจข้อมูลใน Lists",
          403,
        );
      let state = listStatus(p.main.fields, c);
      if (changed.some((k) => ["latest", "winLoss"].includes(k))) {
        if (!staff && state === "delivered")
          throw new E("ส่งงานได้เฉพาะ Engineer/Admin", 403);
        if (w.disabled.includes("status:" + state))
          throw new E("Admin ปิดสถานะนี้ไว้");
      }
      if (changed.includes("step") && c.step) {
        let value = String(p.main.fields[c.step.name] || ""),
          step = Object.keys(STEPS).find((k) =>
            value.startsWith(STEPS[k].label),
          );
        if (step && w.disabled.includes("step:" + step))
          throw new E("Admin ปิดขั้นตอนนี้ไว้");
      }
    }
    async function plan(record, p) {
      await settings(true);
      cached = null;
      let r = record.job.request,
        actor = await sourceActor(record, p),
        values = r.values || {},
        a = await ready(),
        w = a.workflow,
        c = cfg.columns || {},
        f = {},
        track = {},
        before = {},
        after = {},
        source = r.source?.kind || "web",
        main = p.main;
      if (
        ![
          "edit",
          "request",
          "work",
          "sales",
          "status",
          "step",
          "note",
          "binding",
          "bootstrap",
          "mirror",
          "register",
          "reminder",
          "directory",
        ].includes(r.kind)
      )
        throw new E("ประเภทคำสั่งไม่รองรับ", 400);
      allowed(actor, p, r.kind, values);
      if (!w.enabled) throw new E("Admin ปิด Flow ซิงก์ไว้ชั่วคราว");
      let approval = String(main.fields?.[c.approval?.name] || ""),
        approved =
          /^approv/i.test(approval) ||
          (!approval && Number(main.fields[c.legacyApproval?.name]) === 3);
      if (["status", "step", "binding"].includes(r.kind) && !approved)
        throw new E("โครงการต้องอนุมัติก่อนเปลี่ยนสถานะหรือ Channel");
      let add = (k, v) => {
        let col = c[k];
        if (!col || col.readOnly)
          throw new E("คอลัมน์ " + k + " ยังไม่พร้อมหรืออ่านอย่างเดียว");
        f[col.name] = v;
      };
      if (["status", "step"].includes(r.kind)) {
        let k = text(values.value, 30, true),
          m = r.kind === "status" ? STATUS[k] : STEPS[k];
        if (!m || w.disabled.includes(r.kind + ":" + k))
          throw new E("ขั้นตอนนี้ยังไม่เปิดใช้งาน", 400);
        let current = p.data.pstat?.s || listStatus(main.fields, c);
        if (r.kind === "step" && current !== "active")
          throw new E("เปลี่ยนขั้นตอนได้เฉพาะงานกำลังทำ");
        let at = actor.message?.createdDateTime || record.job.createdAt;
        if (
          actor.message &&
          Date.parse(at) <=
            Math.max(
              Date.parse(p.data.pstat?.at || 0) || 0,
              r.kind === "step" ? Date.parse(p.data.sub?.at || 0) || 0 : 0,
            )
        )
          throw new E("มีสถานะใหม่กว่าคำสั่งนี้แล้ว");
        if (r.kind === "status") {
          before.status = current;
          after.status = k;
          track.pstat = {
            s: k,
            at,
            by: actor.name,
            via: source,
            msg: r.source?.messageId || "",
            prev: current,
          };
          add("latest", m.latest);
          add("winLoss", m.result);
          if (c.step && !c.step.readOnly)
            f[c.step.name] = k === "active" ? STEPS.recv.label : m.label;
        } else {
          before.step = p.data.sub?.sub || "recv";
          after.step = k;
          track.sub = {
            sub: k,
            at,
            by: actor.name,
            via: source,
            msg: r.source?.messageId || "",
          };
          if (c.step && !c.step.readOnly)
            f[c.step.name] = m.label + " · งานอยู่ที่ " + m.who;
        }
      }
      if (["edit", "request", "work"].includes(r.kind)) {
        for (let [k, v0] of Object.entries(values)) {
          if (REQUEST[k]) {
            if (r.kind === "work")
              throw new E("งาน Engineer ไม่แก้รายละเอียดคำขอ", 403);
            let [max, multi] = REQUEST[k],
              col = c[k];
            if (!col || col.readOnly)
              throw new E("ฟิลด์ " + k + " แก้ไขไม่ได้");
            let v = multi
              ? Array.isArray(v0) && v0.length <= 50
                ? [...new Set(v0.map((x) => text(x, max)))]
                : null
              : text(v0, max, col.required);
            if (v === null) throw new E("ตัวเลือกหลายค่าไม่ถูกต้อง", 400);
            if (col.required && Array.isArray(v) && !v.length)
              throw new E("กรอกข้อมูลที่จำเป็น");
            if (
              col.choices?.length &&
              !col.fill &&
              (multi ? v : [v]).some(
                (x) =>
                  x &&
                  !col.choices.includes(x) &&
                  !(
                    Array.isArray(main.fields[col.name])
                      ? main.fields[col.name]
                      : [main.fields[col.name]]
                  ).includes(x),
              )
            )
              throw new E("ค่าที่เลือกไม่ตรงตัวเลือก Microsoft Lists");
            if (k === "assignedAt") v = date(v, true);
            before[k] = main.fields[col.name] ?? "";
            after[k] = v;
            if (multi) f[col.name + "@odata.type"] = "Collection(Edm.String)";
            f[col.name] = v || (k === "assignedAt" ? null : "");
            if (k === "name" || k === "client") track[k] = v;
          } else if (TRACK[k]) {
            if (r.kind === "request")
              throw new E("แก้คำขอไม่เปลี่ยนข้อมูล Engineer", 403);
            let v = text(v0, TRACK[k]);
            if (["due", "followup"].includes(k)) date(v);
            if (k === "priority" && !["normal", "high", "urgent"].includes(v))
              throw new E("ระดับความสำคัญไม่ถูกต้อง");
            if (k === "engineer" && v) {
              let s = await settings(),
                member = (s.data.members || []).find(
                  (x) => x.name === v && ["admin", "engineer"].includes(x.role),
                );
              if (!member) throw new E("เลือก Engineer จากผู้ใช้ที่เปิดใช้งาน");
              if (c.engineer && !c.engineer.readOnly) {
                let u = await SP("/web/ensureuser", {
                  method: "POST",
                  json: {
                    logonName: "i:0#.f|membership|" + email(member.email),
                  },
                });
                f[c.engineer.name + "LookupId"] = String(u.Id);
              }
            }
            if (k === "engineer" && !v && c.engineer && !c.engineer.readOnly)
              f[c.engineer.name + "LookupId"] = null;
            before[k] = p.data[k] || "";
            after[k] = track[k] = v;
          } else if (r.kind === "work" && ["stage", "outcome"].includes(k)) {
          } else throw new E("ฟิลด์ " + k + " อยู่นอกขอบเขตแก้ไข", 400);
        }
      }
      if (
        r.kind === "request" &&
        (/^approv|reject/i.test(approval) ||
          Number(main.fields[c.legacyApproval?.name]) === 3)
      )
        throw new E("คำขอไม่ได้อยู่ระหว่างรออนุมัติแล้ว");
      if (r.kind === "work") {
        if (!["admin", "engineer"].includes(actor.role))
          throw new E("อัปเดตงานได้เฉพาะ Engineer/Admin", 403);
        if (!approved) throw new E("ต้องได้รับอนุมัติก่อนเริ่มงาน");
        let stage = values.stage || p.data.stage || "approved",
          out = values.outcome || p.data.outcome || "open";
        if (
          !["approved", "working", "review", "delivered", "closed"].includes(
            stage,
          ) ||
          !["open", "won", "lost"].includes(out)
        )
          throw new E("ขั้นตอนหรือผลโครงการไม่ถูกต้อง", 400);
        if (
          ["delivered", "closed"].includes(stage) &&
          !String(values.summary ?? p.data.summary ?? "").trim()
        )
          throw new E("กรอกสรุปส่งงานหรือปิดโครงการ");
        if (
          stage === "closed" &&
          p.data.stage !== "delivered" &&
          !p.data.closeRequestedAt &&
          p.data.stage !== "closed"
        )
          throw new E("ต้องส่งงานหรือมีคำขอปิดจากเซลส์ก่อน");
        if (stage === "closed" && out === "open")
          throw new E("ระบุ WIN หรือ LOSS ก่อนปิด");
        if (
          !["delivered", "closed"].includes(stage) &&
          (!String(values.nextAction ?? p.data.nextAction ?? "").trim() ||
            !(values.followup || p.data.followup))
        )
          throw new E("กรอกงานถัดไปและวันติดตาม");
        if (
          ["working", "review", "delivered"].includes(stage) &&
          !(values.engineer || p.data.engineer)
        )
          throw new E("มอบหมาย Engineer ก่อนเริ่มงาน");
        let state =
          stage === "closed"
            ? out
            : stage === "delivered"
              ? "delivered"
              : "active";
        if (w.disabled.includes("status:" + state))
          throw new E("Admin ปิดการเปลี่ยนสถานะนี้ไว้", 400);
        track.stage = stage;
        track.outcome = out;
        before.stage = p.data.stage || "approved";
        after.stage = stage;
        if (state !== (p.data.pstat?.s || listStatus(main.fields, c))) {
          track.pstat = {
            s: state,
            at: record.job.createdAt,
            by: actor.name,
            via: "web",
            prev: p.data.pstat?.s || "",
          };
          add("latest", STATUS[state].latest);
          add("winLoss", STATUS[state].result);
        }
      }
      if (r.kind === "sales") {
        let note = text(values.note, 4000, true),
          out = text(values.outcome || "open", 10);
        if (!["open", "won", "lost"].includes(out))
          throw new E("ผลลูกค้าไม่ถูกต้อง");
        let state = p.data.pstat?.s || listStatus(main.fields, c);
        if (
          values.mode === "request_close" &&
          (state !== "delivered" || out === "open")
        )
          throw new E("ขอปิดได้เมื่อส่งงานแล้วและระบุ WIN/LOSS");
        track.salesSummary = note;
        track.salesUpdatedAt = record.job.createdAt;
        track.outcome = out;
        track.followup = date(
          text(values.followup || p.data.followup || "", 10),
        );
        if (values.mode === "request_close") {
          track.closeRequestedAt = record.job.createdAt;
          track.closeRequestedBy = actor.name;
          track.nextAction = "ตรวจผลจากเซลส์และยืนยันปิดโครงการ";
        } else track.nextAction = text(values.nextAction, 1000, true);
        after.salesSummary = note;
        after.outcome = out;
      }
      if (r.kind === "note") {
        after.note = text(values.note, 4000, true);
      }
      if (["binding", "bootstrap"].includes(r.kind)) {
        let tid = text(values.teamId, 150, true),
          cid = text(values.channelId, 200, true),
          channel = await G(`/teams/${enc(tid)}/channels/${enc(cid)}`);
        if (
          r.kind === "bootstrap" &&
          ((p.data.channelId && p.data.channelId !== cid) ||
            !String(channel.displayName || "")
              .toLowerCase()
              .replace(/\s/g, "")
              .startsWith(String(p.data.code).toLowerCase().replace(/\s/g, "")))
        )
          throw new E("การเชื่อมครั้งแรกต้องเป็น Channel ของรหัสโครงการนี้");
        if (channel.id !== cid || channel.isArchived)
          throw new E("Channel ไม่ตรงหรือถูก Archive แล้ว");
        let rows = await directoryRows();
        if (
          rows.some(
            (row) =>
              String(row.fields.ProjectRef) !== itemId(p.pid) &&
              row.fields.ChannelKey === tid + ":" + cid,
          )
        )
          throw new E("Channel นี้เชื่อมกับโครงการอื่นแล้ว");
        Object.assign(track, {
          teamId: tid,
          channelId: cid,
          channelUrl: channel.webUrl || "",
        });
        before.channel = p.data.channelId || "";
        after.channel = cid;
      }
      if (r.kind === "mirror") {
        await verifyMainEditor(p, w);
        let modified = main.lastModifiedBy?.user;
        if (modified?.id) {
          let u = await user(modified.id);
          actor = { ...actor, name: u.name, originOid: u.oid };
        }
        if (!r.source?.etag || main.eTag !== r.source.etag)
          throw new E("ข้อมูล SharePoint เปลี่ยนหลังตรวจพบ ให้ตรวจใหม่");
        let state = listStatus(main.fields, c),
          old = p.data.syncObserved?.fields || {},
          statusChanged = ["latest", "winLoss"].some(
            (k) =>
              c[k] &&
              String(old[c[k].name] ?? "") !==
                String(main.fields[c[k].name] ?? ""),
          );
        if (statusChanged)
          track.pstat = {
            s: state,
            at: main.lastModifiedDateTime || now(),
            by: actor.name,
            via: "sharepoint",
            prev: p.data.pstat?.s || "",
          };
        if (
          c.approval &&
          old[c.approval.name] !== main.fields[c.approval.name]
        ) {
          if (approved && p.data.stage === "pending") track.stage = "approved";
          if (/^reject/i.test(approval)) track.stage = "rejected";
        }
        for (let k of ["name", "client"])
          if (c[k]) track[k] = main.fields[c[k].name] || "";
        let value = String(main.fields[c.step?.name] || ""),
          step = Object.keys(STEPS).find((k) =>
            value.startsWith(STEPS[k].label),
          );
        if (step && state === "active" && old[c.step.name] !== value)
          track.sub = {
            sub: step,
            at: main.lastModifiedDateTime || now(),
            by: actor.name,
            via: "sharepoint",
          };
        if (c.engineer) {
          let lookup = main.fields[c.engineer.name + "LookupId"];
          if (
            String(old[c.engineer.name + "LookupId"] ?? "") !==
            String(lookup ?? "")
          ) {
            if (!lookup) track.engineer = "";
            else {
              let u = await SP(
                  "/web/getuserbyid(" +
                    Number(lookup) +
                    ")?$select=Email,Title",
                ),
                s = await settings(),
                member = (s.data.members || []).find(
                  (m) =>
                    email(m.email) === email(u.Email) &&
                    ["admin", "engineer"].includes(m.role),
                );
              if (!member)
                throw new E(
                  "Engineer จาก Lists ยังไม่มีบทบาทในทะเบียนผู้ใช้",
                  403,
                );
              track.engineer = member.name;
            }
          }
        }
        before.sharepoint = old;
        after.sharepoint = observation({
          fields: main.fields,
          raw: main,
        }).fields;
      }
      if (
        Object.keys(f).length &&
        approved &&
        c.approval &&
        !c.approval.readOnly
      )
        f[c.approval.name] = approval || "Approved";
      if (r.kind === "directory") {
        for (let k of ["code", "name", "client"])
          if (
            c[k] &&
            String(p.data[k] ?? "") !== String(main.fields[c[k].name] ?? "")
          )
            throw new E("แก้ " + k + " ที่ All Projects List หรือหน้าหลังบ้าน");
        if (
          p.data.syncPublished &&
          (p.data.teamId !== p.data.syncPublished.teamId ||
            p.data.channelId !== p.data.syncPublished.channelId)
        )
          throw new E("เปลี่ยน Channel ผ่านหน้าหลังบ้านเพื่อตรวจผลกระทบก่อน");
        if (!Core.same(values.snapshot, publication(p.data)))
          throw new E("ทะเบียนกลางเปลี่ยนหลังตรวจพบ กรุณาตรวจค่าล่าสุด");
        for (let [k, max] of Object.entries(TRACK))
          if (p.data[k] != null) text(p.data[k], max);
        for (let k of ["due", "followup"]) if (p.data[k]) date(p.data[k]);
        let state = p.data.pstat?.s;
        if (state && !STATUS[state]) throw new E("รหัสสถานะในทะเบียนไม่รองรับ");
        if (p.data.sub?.sub && !STEPS[p.data.sub.sub])
          throw new E("รหัสขั้นตอนในทะเบียนไม่รองรับ");
        if (state) {
          add("latest", STATUS[state].latest);
          add("winLoss", STATUS[state].result);
        }
        if (c.step && !c.step.readOnly && p.data.sub?.sub)
          f[c.step.name] =
            state && state !== "active"
              ? STATUS[state].label
              : STEPS[p.data.sub.sub].label;
        if (c.engineer && !c.engineer.readOnly) {
          let member = (await settings()).data.members.find(
            (m) =>
              m.name === p.data.engineer &&
              ["admin", "engineer"].includes(m.role),
          );
          if (p.data.engineer && !member)
            throw new E("Engineer ในทะเบียนยังไม่มีบทบาท");
          f[c.engineer.name + "LookupId"] = member
            ? String(
                (
                  await SP("/web/ensureuser", {
                    method: "POST",
                    json: {
                      logonName: "i:0#.f|membership|" + email(member.email),
                    },
                  })
                ).Id,
              )
            : null;
        }
        if (p.data.channelId) {
          let ch = await G(
            `/teams/${enc(p.data.teamId)}/channels/${enc(p.data.channelId)}`,
          );
          if (ch.isArchived) throw new E("Channel ถูก Archive แล้ว");
          let rows = await directoryRows();
          if (
            rows.some(
              (row) =>
                Number(row.fields.ProjectRef) !== Number(itemId(p.pid)) &&
                row.fields.ChannelKey ===
                  p.data.teamId + ":" + p.data.channelId,
            )
          )
            throw new E("Channel เชื่อมกับโครงการอื่นแล้ว");
        }
        before.directory = p.data.syncPublished || {};
        after.directory = values.snapshot;
        if (p.directoryModifiedBy?.id) {
          let u = await user(p.directoryModifiedBy.id);
          actor = { ...actor, name: u.name, originOid: u.oid };
        }
      }
      if (r.kind === "reminder") {
        let sub = p.data.sub?.sub,
          since = Math.max(
            Date.parse(p.data.sub?.at || 0) || 0,
            Date.parse(p.data.pstat?.at || 0) || 0,
          ),
          days = w.warnDays[sub] || 0;
        if (
          !sub ||
          !days ||
          clock() - since < days * 864e5 ||
          (p.data.pstat?.s || listStatus(main.fields, c)) !== "active"
        )
          throw new E("โครงการยังไม่เข้าเกณฑ์เตือน");
        track.lastReminder = { key: r.key, at: now() };
        after.reminder =
          "ขั้นตอน " +
          STEPS[sub].label +
          " ค้าง " +
          Math.floor((clock() - since) / 864e5) +
          " วัน";
      }
      if (r.kind === "register") {
        after.registration = "เตรียมทะเบียนข้อมูลกลางแล้ว";
        before.registration = "ยังไม่มีทะเบียนกลาง";
      }
      let combined = { ...p.data, ...track },
        channel =
          combined.teamId && combined.channelId && w.notify
            ? {
                teamId: combined.teamId,
                channelId: combined.channelId,
                rootId:
                  r.source?.kind === "teams"
                    ? r.source.rootId || r.source.messageId
                    : "",
              }
            : null;
      return {
        guard: publication(p.data),
        noTeamReason: !w.notify ? "Admin ปิดการแจ้งข้อมูลใน Teams" : undefined,
        actor,
        source,
        fields: f,
        track,
        before,
        after,
        channel,
        intent: { request: r, author: actor.oid },
        note: after.note || after.reminder || "",
        project: {
          ...combined,
          code: main.fields[c.code?.name] || combined.code,
          name: track.name || main.fields[c.name?.name] || combined.name,
          client:
            track.client || main.fields[c.client?.name] || combined.client,
        },
        kind: r.kind,
      };
    }
    async function preflight(r) {
      await settings(true);
      let ctx = await context(r.projectId),
        me = await current();
      if (r.source?.kind === "teams" && me.role !== "admin")
        throw new E("นำคำสั่งจาก Teams เข้าคิวได้เฉพาะ Admin/worker", 403);
      if (
        [
          "edit",
          "binding",
          "mirror",
          "register",
          "reminder",
          "directory",
        ].includes(r.kind) &&
        me.role !== "admin"
      )
        throw new E("เฉพาะ Admin เท่านั้น", 403);
      if (me.role === "viewer")
        throw new E("บทบาท Viewer อ่านโครงการได้อย่างเดียว", 403);
      if (!["admin", "engineer"].includes(me.role) && me.email !== ctx.owner)
        throw new E("ทำรายการได้เฉพาะโครงการของตัวเอง", 403);
      if (!r.base?.listETag || !Number.isInteger(r.base.revision))
        throw new E("เปิดฟอร์มใหม่เพื่ออ่านเวอร์ชันข้อมูล");
      return ctx;
    }
    const readList = async (p) => {
      let raw = await listItem(p.pid);
      return { fields: raw.fields, etag: raw.eTag || raw["@odata.etag"], raw };
    };
    const patchList = (p, fields, etag) =>
      G(path(cfg.projectListId, itemId(p.pid), true), {
        method: "PATCH",
        noRetry: true,
        headers: { "If-Match": etag },
        json: fields,
      });
    function channelPath(ch) {
      return `/teams/${enc(ch.teamId)}/channels/${enc(ch.channelId)}/messages`;
    }
    async function findMessage(ch, key, id) {
      let mark = "9D Sync · " + key,
        base = channelPath(ch),
        url = ch.rootId ? base + "/" + enc(ch.rootId) + "/replies" : base;
      if (id) {
        try {
          let m = await G(url + "/" + enc(id));
          return !m.deletedDateTime &&
            String(m.body?.content || "").includes(mark)
            ? m
            : null;
        } catch (e) {
          if (e.status !== 404) throw e;
        }
      }
      let rows = await all(url + "?$top=50");
      return (
        rows.find(
          (m) =>
            !m.deletedDateTime && String(m.body?.content || "").includes(mark),
        ) || null
      );
    }
    async function postMessage(plan, key) {
      let p = plan.project,
        state = p.pstat?.s || "active",
        step = p.sub?.sub,
        m = STEPS[step],
        heading = {
          edit: "อัปเดตข้อมูลโครงการ",
          request: "แก้ไขคำขอ",
          work: "อัปเดตงาน",
          sales: "ผลจากลูกค้า",
          bootstrap: "เชื่อม Channel โครงการ",
          status: "อัปเดตสถานะ",
          step: "อัปเดตขั้นตอน",
          note: "บันทึกติดตาม",
          binding: "เชื่อม Channel",
          mirror: "ข้อมูลล่าสุดจาก SharePoint",
          register: "เริ่มติดตามโครงการผ่านทะเบียนกลาง",
          directory: "ข้อมูลล่าสุดจากทะเบียน SharePoint",
          reminder: "ติดตามงานเกินเกณฑ์",
        }[plan.kind],
        html = `<p><b>[9D] ${esc(p.code)} · ${esc(heading)}</b></p><p>${esc(p.name)}${p.client ? " · " + esc(p.client) : ""}</p><p>สถานะ: ${esc(STATUS[state]?.label || state)}${state === "active" && m ? " · " + esc(m.label) : ""}<br>Engineer: ${esc(p.engineer || "ยังไม่ระบุ")}${p.due ? "<br>กำหนดส่ง: " + esc(p.due) : ""}${p.nextAction ? "<br>ทำต่อ: " + esc(p.nextAction) : ""}${p.waitingOn ? "<br>งานอยู่ที่: " + esc(p.waitingOn) : ""}</p>${plan.note ? "<p>" + esc(plan.note) + "</p>" : ""}<p><small>โดย ${esc(plan.actor.name)} · ${esc(plan.source)}<br>9D Sync · ${esc(key)}</small></p>`;
      return G(
        channelPath(plan.channel) +
          (plan.channel.rootId
            ? "/" + enc(plan.channel.rootId) + "/replies"
            : ""),
        {
          method: "POST",
          noRetry: true,
          json: { body: { contentType: "html", content: html } },
        },
      );
    }
    const adapter = {
      publication,
      isTrusted,
      ready,
      requireAdmin,
      preflight,
      findJob,
      loadJob,
      createJob,
      saveJob,
      loadProject,
      saveProject,
      plan,
      readList,
      patchList,
      fieldsEqual,
      observation,
      findMessage,
      postMessage,
    };
    const engine = Core.create(adapter, { now: clock });
    async function request(pid, kind, values, extra = {}) {
      let ctx = await context(pid);
      return {
        v: 1,
        key: "web:" + crypto.randomUUID(),
        projectId: pid,
        kind,
        values,
        base: ctx.base,
        ...extra,
      };
    }
    async function hash(value) {
      let bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value),
      );
      return Array.from(new Uint8Array(bytes))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    }
    async function acceptMessage(p, m, root) {
      let cmd = command(m.body?.content);
      if (
        !cmd ||
        m.deletedDateTime ||
        !m.from?.user?.id ||
        Date.parse(m.createdDateTime) <
          clock() - (await ready()).workflow.commandDays * 864e5
      )
        return false;
      let floor = Math.max(
        Date.parse(p.data.pstat?.at || 0) || 0,
        cmd.kind === "step" ? Date.parse(p.data.sub?.at || 0) || 0 : 0,
      );
      if (Date.parse(m.createdDateTime) <= floor) return false;
      let source = {
          kind: "teams",
          messageId: String(m.id),
          rootId: String(root || m.id),
          teamId: p.data.teamId,
          channelId: p.data.channelId,
        },
        key =
          "teams:" +
          (await hash(
            p.pid +
              "|" +
              source.teamId +
              "|" +
              source.channelId +
              "|" +
              source.rootId +
              "|" +
              source.messageId,
          ));
      let r = await request(
          p.pid,
          cmd.kind,
          { value: cmd.value },
          { key, source },
        ),
        fake = {
          job: { request: r },
          raw: { createdBy: { user: { id: (await current()).oid } } },
        },
        actor = await sourceActor(fake, p);
      allowed(actor, p, cmd.kind, r.values);
      let queued = await engine.enqueue(r);
      await engine.process(queued.id);
      return true;
    }
    async function remind(p) {
      let w = (await ready()).workflow,
        sub = p.data.sub?.sub,
        since = Math.max(
          Date.parse(p.data.sub?.at || 0) || 0,
          Date.parse(p.data.pstat?.at || 0) || 0,
        ),
        days = w.warnDays[sub] || 0;
      if (
        !w.enabled ||
        !w.notify ||
        !p.data.channelId ||
        !days ||
        p.data.pstat?.s !== "active" ||
        p.data.syncActive ||
        clock() - since < days * 864e5
      )
        return;
      let key =
        "remind:" +
        (await hash(
          p.pid + "|" + sub + "|" + since + "|" + now().slice(0, 10),
        ));
      if (p.data.lastReminder?.key === key) return;
      let req = await request(p.pid, "reminder", {}, { key }),
        job = await engine.enqueue(req);
      await engine.process(job.id);
    }
    async function scanProject(pid, budget = 8) {
      await requireAdmin();
      let p = await loadProject(pid),
        seen = 0,
        notes = [],
        at = now(),
        current = await readList(p),
        observed = observation(current),
        old = p.data.syncObserved;
      if (
        old &&
        !Core.same(old.fields, observed.fields) &&
        !p.data.syncActive
      ) {
        let r = await request(
          pid,
          "mirror",
          {},
          {
            key: "sp:" + (await hash(pid + "|" + current.etag)),
            source: { kind: "sharepoint", etag: current.etag },
          },
        );
        let q = await engine.enqueue(r);
        await engine.process(q.id);
        p = await loadProject(pid);
      }
      if (
        !p.data.syncActive &&
        p.data.syncPublished &&
        !Core.same(p.data.syncPublished, publication(p.data))
      ) {
        let snapshot = publication(p.data),
          req = await request(
            pid,
            "directory",
            { snapshot },
            {
              key: "directory:" + (await hash(pid + "|" + p.etag)),
              source: { kind: "sharepoint-directory" },
            },
          ),
          job = await engine.enqueue(req);
        await engine.process(job.id);
        p = await loadProject(pid);
      }
      if (p.data.syncActive)
        return {
          projectId: pid,
          complete: false,
          messages: 0,
          notes: ["มีคำสั่งซิงก์ก่อนหน้าค้างอยู่"],
        };
      if (!p.data.teamId || !p.data.channelId)
        return {
          projectId: pid,
          complete: true,
          messages: 0,
          notes: ["ยังไม่มี Channel"],
        };
      let cursor = copy(p.data.syncSource || {}),
        base = channelPath(p.data);
      cursor.pending = cursor.pending || [];
      let head = await G(base + "?$top=20"),
        calls = 1;
      for (let m of head.value || [])
        if (command(m.body?.content))
          try {
            if (await acceptMessage(await loadProject(pid), m, m.id)) seen++;
          } catch (e) {
            notes.push(safeSourceError(e));
          }
      while (calls < budget) {
        if (cursor.thread) {
          let url =
            cursor.replyNext ||
            base + "/" + enc(cursor.thread) + "/replies?$top=50";
          if (
            url.startsWith("http") &&
            !url.startsWith("https://graph.microsoft.com/v1.0/")
          )
            throw new E("nextLink ไม่ใช่ Microsoft Graph");
          let page = await G(url);
          calls++;
          for (let m of page.value || []) {
            if (!command(m.body?.content)) continue;
            try {
              if (await acceptMessage(await loadProject(pid), m, cursor.thread))
                seen++;
            } catch (e) {
              notes.push(safeSourceError(e));
            }
          }
          cursor.replyNext = page["@odata.nextLink"] || "";
          if (!cursor.replyNext) delete cursor.thread;
        } else if (cursor.pending.length) {
          let root = cursor.pending.shift();
          cursor.thread = root;
          cursor.replyNext = "";
        } else {
          if (cursor.started && !cursor.next) {
            cursor = { pending: [], lastCompleteAt: at };
            break;
          }
          if (
            cursor.next?.startsWith("http") &&
            !cursor.next.startsWith("https://graph.microsoft.com/v1.0/")
          )
            throw new E("nextLink ไม่ใช่ Microsoft Graph");
          let page = !cursor.started
            ? head
            : await G(cursor.next || base + "?$top=20");
          if (cursor.started) calls++;
          for (let m of page.value || [])
            if (command(m.body?.content))
              try {
                if (await acceptMessage(await loadProject(pid), m, m.id))
                  seen++;
              } catch (e) {
                notes.push(safeSourceError(e));
              }
          cursor.pending = (page.value || []).map((m) => String(m.id));
          cursor.next = page["@odata.nextLink"] || "";
          cursor.started = true;
          if (!cursor.pending.length && !cursor.next) {
            cursor = { pending: [], lastCompleteAt: at };
            break;
          }
        }
      }
      cursor.lastAttemptAt = at;
      cursor.error = notes.slice(0, 3).join(" · ");
      p = await loadProject(pid);
      p = await saveProject(p, { ...p.data, syncSource: cursor });
      await remind(p);
      return {
        projectId: pid,
        complete: !!cursor.lastCompleteAt && !cursor.started,
        messages: seen,
        notes,
        calls,
      };
    }
    function safeSourceError(e) {
      return String(e.message || e).slice(0, 180);
    }
    async function health() {
      let a = await ready(),
        rows = await all(
          path(a.directoryId) +
            "?$expand=fields&$filter=fields/ProjectRef eq 0&$top=2",
        );
      return rows[0]
        ? {
            raw: rows[0],
            data: json(rows[0].fields.DirectoryJson || "{}", "สถานะ worker"),
          }
        : { raw: null, data: {} };
    }
    async function heartbeat(data) {
      await requireAdmin();
      let a = await ready(),
        h = await health(),
        fields = {
          Title: "สถานะตัวประมวลผล",
          ProjectRef: 0,
          DirectoryJson: JSON.stringify({
            ...h.data,
            ...data,
            ...(data.worker ? { workerAt: now() } : {}),
            at: now(),
          }),
        };
      if (h.raw)
        await G(path(a.directoryId, h.raw.id, true), {
          method: "PATCH",
          noRetry: true,
          headers: { "If-Match": h.raw.eTag },
          json: fields,
        });
      else
        try {
          await G(path(a.directoryId), {
            method: "POST",
            noRetry: true,
            json: { fields },
          });
        } catch (e) {
          if (!(await health()).raw) throw e;
        }
      return health();
    }
    async function cycle({
      limit = 10,
      scan = 2,
      budget = 8,
      worker = false,
    } = {}) {
      await ready(true);
      await requireAdmin();
      let h = await health(),
        allJobs = await jobs(),
        activeIds = new Set(
          (await directoryRows()).map((r) => {
            try {
              return JSON.parse(r.fields.DirectoryJson).syncActive?.jobId;
            } catch {
              return null;
            }
          }),
        ),
        rows = allJobs
          .filter(
            (r) =>
              !r.trusted ||
              (!Core.terminal(r.job.state) && r.job.state !== "conflict") ||
              (activeIds.has(r.id) && Core.terminal(r.job.state)),
          )
          .sort((a, b) =>
            String(a.job.updatedAt).localeCompare(String(b.job.updatedAt)),
          ),
        done = [],
        errors = [];
      for (let r of rows.slice(0, limit)) {
        try {
          done.push(await engine.process(r.id));
        } catch (e) {
          errors.push(safeSourceError(e));
        }
      }
      let directory = (await directoryRows()).filter(
        (r) => Number(r.fields.ProjectRef) > 0,
      );
      if (worker) {
        let mains = await all(
            path(cfg.projectListId) +
              "?$expand=fields&$select=id,eTag,lastModifiedDateTime&$top=200",
          ),
          by = new Map(mains.map((m) => [String(m.id), m])),
          changed = 0;
        for (let row of directory) {
          let d = json(row.fields.DirectoryJson, "ทะเบียน"),
            main = by.get(String(row.fields.ProjectRef));
          if (!main || d.syncActive) continue;
          let observed = observation({ fields: main.fields, raw: main }),
            mainChanged =
              d.syncObserved &&
              !Core.same(d.syncObserved.fields, observed.fields),
            dirChanged =
              d.syncPublished && !Core.same(d.syncPublished, publication(d));
          if (changed < limit && (mainChanged || dirChanged)) {
            try {
              await scanProject("sp-" + row.fields.ProjectRef, 2);
              changed++;
            } catch (e) {
              errors.push(safeSourceError(e));
            }
          }
        }
      }
      let index = Number(h.data.cursor || 0),
        sources = [];
      for (let n = 0; n < Math.min(scan, directory.length); n++) {
        let row = directory[(index + n) % directory.length];
        try {
          sources.push(
            await scanProject("sp-" + row.fields.ProjectRef, budget),
          );
        } catch (e) {
          errors.push(safeSourceError(e));
        }
      }
      await heartbeat({
        worker: !!worker,
        cursor: directory.length ? (index + scan) % directory.length : 0,
        processed: done.length,
        pending: rows.length,
        errors: errors.slice(0, 5),
        sources: sources.map((x) => ({
          projectId: x.projectId,
          complete: x.complete,
          messages: x.messages,
        })),
        completedAt: now(),
      });
      return { processed: done.length, pending: rows.length, errors, sources };
    }
    return {
      ...adapter,
      engine,
      all,
      jobs,
      settings,
      current,
      context,
      directoryRows,
      initial,
      secureDirectoryItem,
      path,
      config: cfg,
      request,
      scanProject,
      health,
      heartbeat,
      cycle,
    };
  }
  return {
    createClient,
    STATUS,
    STEPS,
    REQUEST,
    TRACK,
    QUEUE_NAME,
    DIRECTORY_NAME,
    workflow,
    fieldsEqual,
    listStatus,
    command,
    text,
    date,
  };
});
