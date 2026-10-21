/* v16.41 Microsoft จำลองสำหรับ unit/UI เท่านั้น ไม่อ่าน token และไม่ส่งเครือข่าย */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(
      require("../sync-core.js"),
      require("../sync-m365.js"),
    );
  else root.NineSyncFixture = factory(root.NineSync, root.NineSyncM365);
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (Core, M365) {
    const clone = (x) => JSON.parse(JSON.stringify(x)),
      err = (m, s) => new Core.SyncError(m, s);
    function create(options = {}) {
      const columns =
        options.columns ||
        Object.fromEntries(
          [
            "code",
            "name",
            "client",
            "source",
            "notes",
            "urgency",
            "closingChance",
            "estimatedValue",
            "latest",
            "winLoss",
            "step",
            "approval",
            "legacyApproval",
            "engineer",
            "brands",
            "workTypes",
            "assignedAt",
          ].map((k) => [
            k,
            {
              name: k,
              type: ["brands", "workTypes"].includes(k)
                ? "multi"
                : k === "engineer"
                  ? "user"
                  : "text",
              readOnly: false,
            },
          ]),
        );
      let actor = options.profile || {
          oid: "admin-uid",
          email: "admin@example.invalid",
          name: "Admin ตัวอย่าง",
        },
        ticks = 0,
        idCounter = 1000;
      const users = [
        {
          oid: "admin-uid",
          email: "admin@example.invalid",
          name: "Admin ตัวอย่าง",
          role: "admin",
          lookup: 11,
        },
        {
          oid: "engineer-uid",
          email: "engineer@example.invalid",
          name: "Engineer A",
          role: "engineer",
          lookup: 12,
        },
        {
          oid: "sales-uid",
          email: "sales@example.invalid",
          name: "Sales A",
          role: "sales",
          lookup: 13,
        },
        {
          oid: "other-uid",
          email: "other@example.invalid",
          name: "Sales B",
          role: "sales",
          lookup: 14,
        },
        {
          oid: "viewer-uid",
          email: "viewer@example.invalid",
          name: "Viewer A",
          role: "viewer",
          lookup: 15,
        },
      ];
      if (!users.some((u) => u.email === actor.email))
        users.push({ ...actor, role: options.role || "admin", lookup: 11 });
      else
        Object.assign(
          users.find((u) => u.email === actor.email),
          actor,
          { role: options.role || "admin" },
        );
      const cfg = {
        v: 1,
        siteId: "mock-site",
        siteHost: "example.invalid",
        sitePath: "/sites/mock",
        projectListId: "projects",
        trackingListId: "tracking",
        settingsItemId: "settings",
        columns,
        ...options.config,
      };
      let settings = options.settings || {
        members: users.map((u) => ({
          userId: u.oid,
          email: u.email,
          name: u.name,
          role: u.role,
        })),
        accounts: {},
        settings: {},
        syncAccess: { v: 1, queueId: "queue", directoryId: "directory" },
        workflowPolicy: { ...M365.workflow(), enabled: true },
      };
      if (options.settings)
        settings = {
          ...settings,
          syncAccess: settings.syncAccess || {
            v: 1,
            queueId: "queue",
            directoryId: "directory",
          },
          workflowPolicy: settings.workflowPolicy || {
            ...M365.workflow(),
            enabled: true,
          },
        };
      const at = () =>
          new Date(
            Date.parse("2026-10-21T09:00:00Z") + ++ticks * 1000,
          ).toISOString(),
        lists = { projects: [], tracking: [], queue: [], directory: [] },
        messages = new Map(),
        calls = [],
        faults = {};
      const field = (f, k, v) => {
        if (columns[k]) f[columns[k].name] = v;
      };
      const raw = (id, fields, owner = users[0]) => ({
        id: String(id),
        eTag: '"v1"',
        fields: clone(fields),
        createdBy: {
          user: { id: owner.oid, email: owner.email, displayName: owner.name },
        },
        lastModifiedBy: {
          user: { id: owner.oid, email: owner.email, displayName: owner.name },
        },
        createdDateTime: at(),
        lastModifiedDateTime: at(),
      });
      if (options.projects)
        lists.projects = clone(options.projects).map((it) => {
          let u = users.find((u) => u.email === it.createdBy?.user?.email);
          if (!u) {
            u = {
              oid: "uid-" + users.length,
              email: it.createdBy?.user?.email,
              name: it.createdBy?.user?.displayName,
              role: "sales",
              lookup: 100 + users.length,
            };
            users.push(u);
          }
          return {
            ...it,
            eTag: it.eTag || '"v1"',
            createdBy: { user: { ...it.createdBy.user, id: u.oid } },
            lastModifiedBy: { user: { id: u.oid } },
          };
        });
      else
        for (let i = 1; i <= 3; i++) {
          let f = {};
          for (let [k, v] of Object.entries({
            code: "DEMO" + i,
            name: "โครงการ " + i,
            client: "ลูกค้าตัวอย่าง",
            source: "อีเมล",
            notes: "รายละเอียด",
            approval: "Approved",
            latest: "In Progress",
            winLoss: "Process",
            step: M365.STEPS.recv.label,
            brands: ["Demo"],
            workTypes: [],
            urgency: "ปกติ",
            closingChance: "50%",
            estimatedValue: "",
          }))
            field(f, k, v);
          lists.projects.push(
            raw(i, f, i === 2 ? users[3] : i === 3 ? users[4] : users[2]),
          );
        }
      lists.tracking = clone(options.tracking || []).filter(
        (x) => Number(x.fields?.ProjectItemId) !== 0,
      );
      lists.tracking.unshift(
        raw("settings", {
          ProjectItemId: 0,
          Payload: JSON.stringify(settings),
        }),
      );
      const role = (a) =>
        JSON.parse(lists.tracking[0].fields.Payload).members.find(
          (m) =>
            String(m.email).toLowerCase() === String(a.email).toLowerCase(),
        )?.role || "viewer";
      const readable = (list, row, a) => {
        if (role(a) === "admin" || list === "projects" || list === "tracking")
          return true;
        if (list === "queue") return row.createdBy.user.id === a.oid;
        let data = JSON.parse(row.fields.DirectoryJson || "{}");
        return (
          role(a) === "engineer" || data.owner === String(a.email).toLowerCase()
        );
      };
      const checkWrite = (list, row, a) => {
        if (list === "directory" || list === "tracking") {
          if (role(a) !== "admin") throw err("Mock Forbidden", 403);
        } else if (
          list === "queue" &&
          row &&
          role(a) !== "admin" &&
          row.createdBy.user.id !== a.oid
        )
          throw err("Mock own-item only", 403);
      };
      for (let main of lists.projects) {
        let old = lists.tracking.find(
            (t) => Number(t.fields.ProjectItemId) === Number(main.id),
          ),
          data = old ? JSON.parse(old.fields.Payload || "{}") : {},
          owner = String(
            data.onBehalf?.email || main.createdBy.user.email,
          ).toLowerCase(),
          state = M365.listStatus(main.fields, columns),
          record = {
            ...data,
            v: 1,
            projectId: "sp-" + main.id,
            owner,
            code: main.fields[columns.code.name],
            name: main.fields[columns.name.name],
            client: main.fields[columns.client.name],
            engineer: data.engineer || "Engineer A",
            teamId: data.teamId || "team",
            channelId: data.channelId || "channel-" + main.id,
            channelUrl: "https://example.invalid/teams/" + main.id,
            pstat: data.pstat || { s: state, at: "2026-10-20T09:00:00Z" },
            stage: data.stage || "approved",
            version: data.version || 1,
            syncRevision: 0,
            syncHistory: [],
            syncObserved: {
              etag: main.eTag,
              fields: Object.fromEntries(
                Object.entries(columns)
                  .filter(
                    ([k]) =>
                      M365.REQUEST[k] ||
                      [
                        "latest",
                        "winLoss",
                        "step",
                        "engineer",
                        "approval",
                        "legacyApproval",
                      ].includes(k),
                  )
                  .map(([, c]) => [
                    c.type === "user" ? c.name + "LookupId" : c.name,
                    main.fields[
                      c.type === "user" ? c.name + "LookupId" : c.name
                    ] ?? null,
                  ]),
              ),
            },
          };
        lists.directory.push(
          raw(main.id, {
            ProjectRef: Number(main.id),
            DirectoryJson: JSON.stringify(record),
            ChannelKey: record.teamId + ":" + record.channelId,
          }),
        );
        messages.set(record.channelId, []);
      }
      function update(row, fields, a) {
        if (faults.patchBefore) throw err("timeout", 504);
        row.fields = { ...row.fields, ...clone(fields) };
        let n = Number(row.eTag.match(/\d+/)[0]) + 1;
        row.eTag = '"v' + n + '"';
        row.lastModifiedDateTime = at();
        row.lastModifiedBy = {
          user: { id: a.oid, email: a.email, displayName: a.name },
        };
        if (faults.patchAfter) throw err("timeout", 504);
        return clone(row);
      }
      function userOf(a) {
        return users.find((u) => u.email === a.email) || { ...a, lookup: 11 };
      }
      async function graphFor(a, p, o = {}) {
        let path = String(p).replace(
            /^https:\/\/graph.microsoft.com\/v1.0/,
            "",
          ),
          url = new URL("https://example.invalid" + path),
          parts = url.pathname
            .split("/")
            .filter(Boolean)
            .map(decodeURIComponent),
          method = o.method || "GET";
        calls.push({
          method,
          url: String(p),
          path: parts.join("/"),
          options: clone(o),
        });
        if (parts[0] === "users") {
          let u = users.find((u) => u.oid === parts[1] || u.email === parts[1]);
          if (!u) throw err("Mock user not found", 404);
          return {
            id: u.oid,
            mail: u.email,
            userPrincipalName: u.email,
            displayName: u.name,
          };
        }
        if (parts[0] === "teams") {
          let channel = parts[3],
            rows = messages.get(channel) || [];
          if (parts.length === 4) {
            return {
              id: channel,
              displayName: "DEMO" + channel.split("-").pop() + "_โครงการ",
              webUrl: "https://example.invalid/teams/" + channel,
              isArchived: false,
            };
          }
          let root = parts[5],
            reply = parts[6] === "replies",
            messageId = reply ? parts[7] : root;
          if (method === "POST") {
            if (faults.teams403) throw err("Mock send Forbidden", 403);
            if (faults.postBefore) throw err("timeout", 504);
            let msg = {
              id: String(++idCounter),
              body: clone(o.json.body),
              createdDateTime: at(),
              from: { user: { id: a.oid } },
              webUrl: "https://example.invalid/messages/" + idCounter,
              ...(reply ? { replyToId: root } : {}),
            };
            rows.push(msg);
            messages.set(channel, rows);
            options.onPostMessage?.(lists);
            if (faults.postAfter) throw err("timeout", 504);
            return clone(msg);
          }
          if (messageId) {
            let hit = rows.find((m) => m.id === messageId);
            if (!hit) throw err("Mock message missing", 404);
            if (faults.messageRead)
              throw err("Mock message read Forbidden", 403);
            return clone(hit);
          }
          return {
            value: clone(
              rows.filter((m) => (reply ? m.replyToId === root : !m.replyToId)),
            ),
          };
        }
        if (parts[0] === "sites" && parts[2] === "lists") {
          if (parts.length === 3)
            return {
              value: Object.keys(lists).map((k) => ({
                id: k,
                displayName:
                  k === "queue"
                    ? M365.QUEUE_NAME
                    : k === "directory"
                      ? M365.DIRECTORY_NAME
                      : k,
              })),
            };
          let list =
            parts[3] === cfg.projectListId
              ? "projects"
              : parts[3] === cfg.trackingListId
                ? "tracking"
                : parts[3];
          if (!lists[list]) throw err("Mock list missing", 404);
          if (parts[4] === "columns") return { value: [] };
          let id = parts[5],
            row = id ? lists[list].find((r) => r.id === id) : null;
          if (id && !row) throw err("Mock row missing", 404);
          if (row && !readable(list, row, a))
            throw err("Mock read Forbidden", 403);
          if (method === "PATCH") {
            checkWrite(list, row, a);
            if (o.headers?.["If-Match"] !== row.eTag)
              throw err("Mock eTag", 412);
            if (faults.sp403 && list === "projects")
              throw err("Mock SharePoint Forbidden", 403);
            let result = update(row, o.json, a);
            if (list === "projects") options.onProjectPatch?.(lists);
            return result;
          }
          if (method === "POST") {
            checkWrite(list, null, a);
            let f = o.json.fields;
            if (
              (list === "queue" &&
                lists.queue.some(
                  (r) => r.fields.OperationKey === f.OperationKey,
                )) ||
              (list === "directory" &&
                lists.directory.some(
                  (r) => r.fields.ProjectRef === f.ProjectRef,
                ))
            )
              throw err("Mock duplicate unique key", 409);
            let r = raw(++idCounter, f, userOf(a));
            lists[list].push(r);
            return clone(r);
          }
          if (row) return clone(row);
          let data = lists[list].filter((r) => readable(list, r, a)),
            filter = url.searchParams.get("$filter") || "";
          for (let [column, re] of [
            ["ProjectRef", /fields\/ProjectRef eq (\d+)/],
            ["ProjectItemId", /fields\/ProjectItemId eq (-?\d+)/],
            ["OperationKey", /fields\/OperationKey eq '([^']+)'/],
          ]) {
            let m = filter.match(re);
            if (m) data = data.filter((r) => String(r.fields[column]) === m[1]);
          }
          let ownerFilter = filter.match(/fields\/AuthorLookupId eq '(\d+)'/);
          if (ownerFilter)
            data = data.filter(
              (r) =>
                String(userOf({ email: r.createdBy.user.email }).lookup) ===
                ownerFilter[1],
            );
          let skip = Number(url.searchParams.get("$skip") || 0),
            top = Number(url.searchParams.get("$top") || 200),
            value = data.slice(skip, skip + top),
            next =
              skip + top < data.length
                ? url.pathname +
                  "?" +
                  new URLSearchParams(
                    [...url.searchParams.entries()]
                      .filter(([k]) => k !== "$skip")
                      .concat([["$skip", String(skip + top)]]),
                  )
                : null;
          return {
            value: clone(value),
            ...(next
              ? { "@odata.nextLink": "https://graph.microsoft.com/v1.0" + next }
              : {}),
          };
        }
        throw err("Mock route missing: " + path, 404);
      }
      async function spFor(a, p, o = {}) {
        calls.push({
          sp: true,
          path: p,
          method: o.method || "GET",
          options: clone(o),
        });
        if (p.includes("currentuser"))
          return { Id: userOf(a).lookup, Email: a.email };
        if (p.includes("ensureuser")) {
          let em = String(o.json.logonName).split("|").pop(),
            u = users.find((u) => u.email === em);
          if (!u) throw err("Mock user missing", 404);
          return { Id: u.lookup, Title: u.name, Email: u.email };
        }
        if (p.includes("getuserbyid")) {
          let id = Number(p.match(/getuserbyid\((\d+)\)/)?.[1]),
            u = users.find((u) => u.lookup === id);
          if (!u) throw err("Mock user missing", 404);
          return { Id: id, Email: u.email, Title: u.name };
        }
        if (p.includes("roledefinitions"))
          return {
            Id: p.includes("(2)")
              ? 1073741826
              : p.includes("(3)")
                ? 1073741827
                : 1073741829,
          };
        if (o.method) {
          if (role(a) !== "admin") throw err("Mock Admin only", 403);
          return {};
        }
        if (p.includes("/fields/"))
          return {
            Indexed: !faults.badIndex,
            EnforceUniqueValues: !faults.badIndex,
          };
        return {
          ReadSecurity: 2,
          WriteSecurity: 2,
          HasUniqueRoleAssignments: !faults.badPolicy,
          EffectiveBasePermissions: { Low: role(a) === "admin" ? 2048 : 0 },
        };
      }
      const makeClient = (a) =>
        M365.createClient({
          config: cfg,
          now: options.now || (() => Date.parse(at())),
          profile: async () => clone(a),
          graph: (p, o) => graphFor(a, p, o),
          sp: (p, o) => spFor(a, p, o),
        });
      return {
        client: makeClient(actor),
        makeClient,
        actor,
        cfg,
        lists,
        users,
        calls,
        messages,
        faults,
        graph: (p, o) => graphFor(actor, p, o),
        sp: (p, o) => spFor(actor, p, o),
        role,
        setRole: (em, value) => {
          let s = JSON.parse(lists.tracking[0].fields.Payload),
            m = s.members.find((m) => m.email === em);
          if (m) m.role = value;
          lists.tracking[0].fields.Payload = JSON.stringify(s);
        },
        addMessage: (channel, body, who = "sales-uid", root = null) => {
          let m = {
            id: String(++idCounter),
            body: { contentType: "html", content: body },
            createdDateTime: at(),
            from: { user: { id: who } },
            ...(root ? { replyToId: root } : {}),
          };
          let rows = messages.get(channel) || [];
          rows.push(m);
          messages.set(channel, rows);
          return m;
        },
      };
    }
    return { create };
  },
);
