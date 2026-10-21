#!/usr/bin/env node
"use strict";
// ไม่มีบัญชี/token ในไฟล์: ดาวน์โหลด config จาก Admin แล้ววางนอก public hosting
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const M365 = require("../sync-m365.js");
function config(input) {
  let c = structuredClone(input);
  if (
    c.v !== 1 ||
    !/^[0-9a-f-]{36}$/i.test(c.clientId) ||
    !/^([0-9a-f-]{36}|[a-z0-9.-]+\.onmicrosoft\.com)$/i.test(c.tenant) ||
    !/^([a-z0-9-]+)\.sharepoint\.com$/i.test(c.siteHost) ||
    !/^\/sites\/[a-z0-9_/-]+$/i.test(c.sitePath) ||
    !c.siteId ||
    !c.projectListId ||
    !c.trackingListId ||
    !c.settingsItemId ||
    !c.columns
  )
    throw Error("config ไม่ครบหรือปลายทางไม่รองรับ ให้ดาวน์โหลดจาก Admin ใหม่");
  return c;
}
function createTransport(
  c,
  tokens,
  {
    fetch: request = globalThis.fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    timeout = 30000,
  } = {},
) {
  const root = "https://" + c.siteHost + c.sitePath + "/_api";
  async function send(url, o = {}, resource) {
    let allowed =
      resource === "graph"
        ? url.startsWith("https://graph.microsoft.com/v1.0/")
        : url.startsWith(root + "/");
    if (!allowed) throw Error("ปฏิเสธปลายทางที่อยู่นอก config");
    let method = o.method || "GET",
      tries = method === "GET" ? 3 : 1;
    for (let n = 0; n < tries; n++) {
      let controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), timeout),
        response;
      try {
        response = await request(url, {
          method,
          redirect: "error",
          signal: controller.signal,
          headers: {
            Authorization: "Bearer " + (await tokens(resource)),
            Accept:
              resource === "graph"
                ? "application/json"
                : "application/json;odata=nometadata",
            ...(o.json
              ? {
                  "Content-Type":
                    resource === "graph"
                      ? "application/json"
                      : "application/json;odata=nometadata",
                }
              : {}),
            ...o.headers,
          },
          ...(o.json ? { body: JSON.stringify(o.json) } : {}),
        });
      } catch {
        let e = Error(
          "ติดต่อ Microsoft ไม่สำเร็จหรือหมดเวลา ยังไม่ทราบผลคำสั่ง",
        );
        e.status = 504;
        throw e;
      } finally {
        clearTimeout(timer);
      }
      if (
        method === "GET" &&
        [429, 502, 503, 504].includes(response.status) &&
        n + 1 < tries
      ) {
        let delay = Math.min(
          30000,
          Math.max(
            1000,
            Number(response.headers.get("retry-after") || n + 1) * 1000,
          ),
        );
        await sleep(delay);
        continue;
      }
      let body = await response.text(),
        j;
      try {
        j = body ? JSON.parse(body) : {};
      } catch {
        j = {};
      }
      if (!response.ok) {
        let e = Error(
          String(
            j.error?.message?.value ||
              j.error?.message ||
              "Microsoft HTTP " + response.status,
          ).slice(0, 600),
        );
        e.status = response.status;
        throw e;
      }
      return j.d || j;
    }
  }
  return {
    graph: (p, o) =>
      send(
        p.startsWith("https://") ? p : "https://graph.microsoft.com/v1.0" + p,
        o,
        "graph",
      ),
    sp: (p, o) => send(root + p, o, "sharepoint"),
  };
}
async function authentication(
  c,
  {
    login = false,
    cacheDir = path.join(os.homedir(), ".9d-sync"),
    write = console.log,
  } = {},
) {
  const { PublicClientApplication } = require("@azure/msal-node"),
    {
      PersistenceCreator,
      PersistenceCachePlugin,
      DataProtectionScope,
    } = require("@azure/msal-node-extensions");
  fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  let stat = fs.lstatSync(cacheDir);
  if (stat.isSymbolicLink() || !stat.isDirectory())
    throw Error("cacheDir ต้องเป็นโฟลเดอร์ส่วนตัว");
  if (process.platform !== "win32") fs.chmodSync(cacheDir, 0o700);
  let persistence = await PersistenceCreator.createPersistence({
    cachePath: path.join(cacheDir, "msal-cache.bin"),
    dataProtectionScope: DataProtectionScope.CurrentUser,
    serviceName: "9d-sync-worker",
    accountName: c.clientId,
    usePlaintextFileOnLinux: false,
  });
  let app = new PublicClientApplication({
      auth: {
        clientId: c.clientId,
        authority: "https://login.microsoftonline.com/" + c.tenant,
      },
      cache: { cachePlugin: new PersistenceCachePlugin(persistence) },
    }),
    selected = null;
  const scopes = {
    graph: [
      "https://graph.microsoft.com/User.Read",
      "https://graph.microsoft.com/Sites.ReadWrite.All",
      "https://graph.microsoft.com/ChannelMessage.Read.All",
      "https://graph.microsoft.com/ChannelMessage.Send",
      "https://graph.microsoft.com/Channel.ReadBasic.All",
      "https://graph.microsoft.com/User.ReadBasic.All",
    ],
    sharepoint: ["https://" + c.siteHost + "/AllSites.FullControl"],
  };
  async function acquire(resource) {
    let result;
    if (login && !selected) {
      result = await app.acquireTokenByDeviceCode({
        scopes: scopes.graph,
        deviceCodeCallback: (r) => write(r.message),
      });
      selected = result.account;
    }
    if (!selected) {
      let accounts = await app.getTokenCache().getAllAccounts();
      if (accounts.length !== 1)
        throw Error(
          "ต้องลงชื่อเข้าใช้ด้วย --login และใช้ cache แยกหนึ่งบัญชีต่อ worker",
        );
      selected = accounts[0];
    }
    try {
      result = await app.acquireTokenSilent({
        account: selected,
        scopes: scopes[resource],
      });
    } catch (e) {
      if (!login) throw Error("ต้องให้ผู้ดูแลลงชื่อเข้าใช้ใหม่ด้วย --login");
      result = await app.acquireTokenByDeviceCode({
        scopes: scopes[resource],
        deviceCodeCallback: (r) => write(r.message),
      });
      if (result.account.homeAccountId !== selected.homeAccountId)
        throw Error("บัญชี Graph และ SharePoint ต้องตรงกัน");
    }
    return result.accessToken;
  }
  // acquire both audiences explicitly; never send Graph tokens to SharePoint REST.
  const tokens = (resource) => acquire(resource);
  await tokens("graph");
  await tokens("sharepoint");
  const transport = createTransport(c, tokens);
  let me = await transport.graph(
    "/me?$select=id,displayName,mail,userPrincipalName",
  );
  return {
    tokens,
    profile: {
      oid: me.id,
      email: me.mail || me.userPrincipalName,
      name: me.displayName,
    },
    transport,
  };
}
async function runOnce({
  client,
  apply = false,
  limit = 10,
  scan = 10,
  budget = 8,
}) {
  await client.ready(true);
  await client.requireAdmin();
  if (!apply) {
    let jobs = await client.jobs();
    return {
      mode: "check",
      pending: jobs.filter(
        (r) => !["complete", "skipped", "cancelled"].includes(r.job.state),
      ).length,
      registeredProjects: (await client.directoryRows()).filter(
        (r) => Number(r.fields.ProjectRef) > 0,
      ).length,
    };
  }
  return {
    mode: "apply",
    ...(await client.cycle({ limit, scan, budget, worker: true })),
  };
}
function args(argv) {
  let out = { apply: false, login: false, once: false };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    if (a === "--config" || a === "--cache-dir")
      out[a === "--config" ? "file" : "cacheDir"] = argv[++i];
    else if (["--scan", "--budget", "--limit"].includes(a)) {
      let value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1 || value > 100)
        throw Error("ช่วงของ " + a + " ต้องเป็น 1–100");
      out[a.slice(2)] = value;
    } else if (["--apply", "--login", "--once"].includes(a))
      out[a.slice(2)] = true;
    else if (a === "--help") out.help = true;
    else throw Error("ไม่รู้จักตัวเลือก " + a);
  }
  if (!out.help && !out.file)
    throw Error("ระบุ --config /path/to/config.local.json");
  return out;
}
async function main(argv = process.argv.slice(2)) {
  let a = args(argv);
  if (a.help) {
    console.log(
      "node worker.cjs --config /private/config.local.json [--login] [--once --apply] [--cache-dir /private/cache] [--scan 10 --budget 8 --limit 10]\nค่าเริ่มต้น: ตรวจความพร้อมอย่างเดียว ไม่มีการเขียนข้อมูล",
    );
    return;
  }
  let c = config(JSON.parse(fs.readFileSync(path.resolve(a.file), "utf8"))),
    auth = await authentication(c, a),
    client = M365.createClient({
      config: c,
      profile: async () => auth.profile,
      ...auth.transport,
    });
  let result = await runOnce({
    client,
    apply: a.apply,
    scan: a.scan,
    limit: a.limit,
    budget: a.budget,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors?.length) process.exitCode = 2;
}
if (require.main === module)
  main().catch((e) => {
    console.error(String(e.message || e));
    process.exitCode = 1;
  });
module.exports = { config, createTransport, authentication, runOnce, args };
