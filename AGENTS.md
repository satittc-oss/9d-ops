# AGENTS.md — 9D Integrated Operations (9d-ops)

คู่มือสำหรับ AI coding agent (Codex / Claude / อื่น ๆ) ที่จะแก้ repo นี้ต่อ · อ่านให้จบก่อนแก้โค้ด

## ภาพรวม
- เว็บแอปของ Nine Distribution: รับ Service Request จากเซลส์ → อนุมัติ → สร้าง Teams Private Channel อัตโนมัติ → ติดตามสถานะ/ขั้นตอนงาน + ยืมสินค้า, งานเซอร์วิส (AEM/CommScope), ใบเสนอราคานอกระบบ ERP, เมืองจำลอง 3 มิติ
- ข้อมูลทั้งหมดอยู่ใน Microsoft 365 ของบริษัท (SharePoint Lists + Teams) — ไม่มี backend ของตัวเอง เบราว์เซอร์เรียก Microsoft Graph / SharePoint REST ตรงด้วยบัญชีของผู้ใช้ (OAuth PKCE, delegated)
- โฮสต์: GitHub Pages จาก branch `main` / root → https://satittc-oss.github.io/9d-ops/ (push แล้วขึ้นเว็บเองใน 1–2 นาที)

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | **ซอร์สหลัก (ไฟล์เดียว ~1 MB)** — React app ที่ build แล้ว + โค้ด 9D ทั้งหมด (สคริปต์ inline ก้อนที่ 3) + CSS ต่อท้ายเป็น `<style id="v16xx">` ก่อน `</body>` |
| `city.html` | เมืองจำลอง 3 มิติ (three.js r128 ใน `vendor/`) รับข้อมูลจาก index.html ผ่าน `postMessage` (`{t:"9d-city",v:1,...}`) |
| `version.json` | `{"v":"v16.xx"}` ต้องตรงกับ `M_VER` ใน index.html เสมอ — หน้าที่เปิดค้างใช้ไฟล์นี้เช็กว่ามีเวอร์ชันใหม่ |
| `sw.js`, `manifest.webmanifest`, ไอคอน | PWA (ติดตั้งเป็นแอป) — แก้ไอคอน/manifest ให้เปลี่ยนชื่อ cache `C` ใน sw.js |
| `README.md` | บันทึกการเปลี่ยนแปลงแต่ละเวอร์ชัน (ภาษาไทย) |

**ไม่มีขั้นตอน build** — แก้ `index.html` ตรง ๆ (ซอร์สแยกไฟล์เดิมไม่ได้อยู่ใน repo และเก่ากว่า index.html แล้ว อย่าพยายามสร้างใหม่จากที่อื่น)

## วิธีหาโค้ดใน index.html
- โค้ด 9D ใช้ prefix: `m*` = ชั้นข้อมูล/Microsoft 365 (เช่น `mLoad`, `mState`, `mProject`, `mSaveTrack`, `mRun`, `mChannel`, `mSubmit`, `mDecide`), `dv*` = หน้าจอ/แดชบอร์ด (เช่น `dvRender`, `dvProjectsPage`, `dvStatusPage`, `dvQuotesPage`, `dvNav`), `qt*` = ใบเสนอราคา, `pv*` = ร่างคำขอในเครื่อง (localStorage)
- ค้นด้วยคอมเมนต์เวอร์ชัน เช่น `/* v16.28` — ทุกการแก้ใหม่ให้ใส่คอมเมนต์ภาษาไทยสั้น ๆ ขึ้นต้นด้วยเลขเวอร์ชันแบบเดียวกัน
- สคริปต์หลักเป็นสโคปเดียว (ไม่ใช่ global) — ฟังก์ชันที่ถูกเรียกจาก `onclick` ใน HTML ต้องประกาศเป็น `window.xxx=`
- หน้าใหม่: เพิ่มใน `dvNav` (รายการ `want` + `dvNavIcon`) และใน `dvRender` (`if(DV.page==="...")`)
- ตรวจ syntax ก่อน commit: ดึงสคริปต์ inline ก้อนใหญ่ออกมาแล้ว `node --check`

## ข้อมูลใน SharePoint (ไซต์ ninedistribution.sharepoint.com/sites/KendoProject)
- **All Projects List** (`CFG.listId` 29246322-232d-426e-a572-92c388bd379d): 1 รายการ = 1 คำขอ/โครงการ · คอลัมน์ไทยใช้ internal name (ดู `M.cols` / `mF(f,"key")`) · `RequestStatus` = Approved / Reject / ว่าง (= รอพิจารณา)
- **9D Project Tracking**: ข้อมูลเสริมของเว็บ แยกตาม `ProjectItemId`
  - `0` = settings ของทีม (`mSaveSettings`)
  - `> 0` = ข้อมูลติดตามของรายการนั้น (Payload JSON) — เขียนผ่าน `mSaveTrack` เท่านั้น และ**ฟิลด์ใหม่ต้องเพิ่มในอาร์เรย์ `keep` ใน `mSaveTrack`** ไม่งั้นจะหายตอนบันทึกครั้งถัดไป
  - `< 0` (= −เลขรายการ) = แถวบันทึกแบบเพิ่มอย่างเดียว: สถานะ `{s}`, ขั้นตอน `{sub}`, ประวัติอนุมัติ `{d}` (approved / rejected / reopened / cancelled)
  - `-9000000000` presence (ตำแหน่ง Engineer) · `-9100000000` flow-index · `-9200000000` inbox จาก Power Automate · `-9300000000` ประวัติการลบโครงการ
- **9D Product Loans**: List จำกัดสิทธิ์เฉพาะ Engineer · **9D Quotations** (v16.37): ทุกบทบาทรวม Viewer สร้าง/แก้ของตัวเอง; Admin จัดการทั้งหมด · ต้องให้ Admin กดตั้งค่าสิทธิ์ก่อน (ReadSecurity/WriteSecurity=2, กลุ่มผู้ใช้ Contribute, Owners/Admin Full Control เฉพาะ List) · เจ้าของอ้างอิง AuthorLookupId จาก SharePoint ไม่เชื่อข้อมูลเจ้าของใน DocJson
- ไซต์ `/sites/9deng`: List งานเซอร์วิส AEM และ CommScope Certifications
- Power Automate flow "9D Teams hashtag sync" (บัญชี Satit) อ่าน Teams ทุกชั่วโมงแล้วเขียนแถว inbox — เว็บแปลง #แฮชแท็กจาก inbox (`mInboxMerge`)

## กติกาที่ต้องทำตาม
1. **ห้ามแก้ข้อมูลจริง / สิทธิ์ / โครงสร้าง List ใน SharePoint หรือ Teams** ระหว่างพัฒนา — ทดสอบด้วยการจำลอง (mock) เท่านั้น การสร้าง List/คอลัมน์ใหม่ให้เกิดจากปุ่มบนเว็บที่ผู้ใช้กดเอง
2. **ห้าม commit อีเมลพนักงาน, token, รหัสผ่าน** — repo เป็น public · รายชื่อผู้อนุมัติ/แอดมินเก็บเป็น SHA-256 ของอีเมล (`approverHashes`, `adminHashes`)
3. ทุก release: เพิ่ม `M_VER` (เช่น v16.31 → v16.32) + แก้ `version.json` ให้ตรง + เพิ่มหัวข้อใน `README.md`
4. โค้ดที่สลับตัวแปร `PV` ชั่วคราว (`mRun`, การบันทึกร่าง, `mSubmit`) ต้องอยู่ใต้คิว `mPvLock()` — เคยทำให้ Channel ถูกสร้างซ้ำและข้อความโพสต์ผิดงาน (v16.28)
5. การสร้าง Teams Channel ต้องผ่าน `mChannel` (มีกันซ้ำ: in-flight map, `chanClaim`, อ่าน `mTrackFresh`)
6. ข้อความภาษาไทยทั้งหมดบนหน้าเว็บ · มือถือใช้งานได้ (ช่องกรอกตัวอักษร ≥16px, จอ ≤680px มีแถบเมนูล่าง)
7. CSS ใหม่ใส่เป็น `<style id="v16xx">` ก่อน `</body>` ตัวสุดท้าย และ scope ด้วย class ของฟีเจอร์นั้น
8. Repo ต้องเป็น **public** และ GitHub Pages ต้องเปิด (Settings → Pages → main / root) — ถ้าเปลี่ยนเป็น private บนบัญชีฟรี เว็บจะหาย

## ฟีเจอร์ v16.37
- `settings.sidebarOrder` เก็บ key เมนูร่วมทั้งทีม; อย่าหาเมนูภาพรวมด้วย index เพราะ Admin ย้ายได้
- `settings.quoteAccess` เป็นหลักฐานว่าตั้งค่า List ใบเสนอราคาจากปุ่มครบแล้ว; อย่าขยายสิทธิ์ระหว่างเปิดหน้า/บันทึกปกติ
- ตั้งค่า ACL ใบเสนอราคาใช้ `mQtAdminSP` / token `spadmin` (SharePoint delegated AllSites.FullControl) หลังผู้ดูแลกดยืนยันเท่านั้น; อย่ารวม Graph กับ SharePoint scopes ใน authorize เดียว และ callback ต้องเก็บ token ไว้ตาม resource ให้ถูก
- `channelArchive` อยู่ใน Tracking keep: ส่ง Archive เฉพาะกดยืนยันในโครงการปิด (WIN/LOSS/ยกเลิก) · 202 ยังไม่สำเร็จ ต้องอ่าน `channel.isArchived` · ห้าม retry POST เมื่อผลไม่แน่นอน
- Archive ขอ delegated `ChannelSettings.ReadWrite.All` ผ่านปุ่ม consent เท่านั้น และส่ง `shouldSetSpoSiteReadOnlyForMembers:false`

## ฟีเจอร์ v16.38 · ศูนย์ผู้ดูแล
- `ws*` เป็นชุดฟังก์ชันหน้าตั้งค่า Admin ในสโคปเดิม; `WS_ADMIN` เก็บร่างในหน่วยความจำ ส่วนค่ากลางอยู่ใน settings แถวเดิม (`ProjectItemId=0`)
- `uiConfig` schema 2 ตั้งแต่ v16.40 เก็บ theme/pages/actions/custom/status และอ่าน schema 1 เดิมได้; `sidebarOrder` ยังเป็นฟิลด์เดิมและรวม custom page ด้วย อย่าใส่ Admin ใน catalog จัดลำดับ เพราะต้องอยู่ใต้ Management และอาจเกิด DOM reorder วนซ้ำ
- `wsValidateUi` รับเฉพาะรูปแบบที่รู้จัก: ข้อความธรรมดา, HTTPS ไม่มี user/password, custom สูงสุด 12 หน้า/6 ลิงก์ต่อหน้า; ห้ามเพิ่ม raw HTML/JavaScript/CSS จากค่าที่ผู้ใช้กรอก
- `wsPageAllowed`/ปุ่มที่ซ่อนใช้ควบคุมหน้าจอ ไม่ใช่ ACL ของ Microsoft และต้องคงข้อจำกัดเดิมของยืมสินค้า/งานเซอร์วิส ภาพรวม/ทางเข้า Admin/คำสั่งบันทึกและยกเลิกต้องเข้าถึงได้เสมอ
- การเขียนจากแผง Admin ใช้ `wsSettingsEdit`: ตรวจ Admin จาก settings ล่าสุด, คิวงาน/Web Locks, eTag `If-Match` ผ่าน `mSaveSettings(s,{etag})`, ไม่ retry PATCH ที่ไม่ทราบผล และอ่านยืนยันก่อนรายงานว่าสำเร็จ; `wsPublish` ตรวจ fingerprint ของ UI+order เพื่อกันร่างเก่าทับฉบับใหม่ โดยคงสมาชิก/ค่าระบบที่เพิ่งแก้
- `uiPrevious` เก็บหน้าจอก่อนหน้า 1 ฉบับ, `uiAudit` จำกัด 12 รายการ; JSON export/import มีเฉพาะ UI+order ห้ามรวม members/accounts หรือข้อมูลเชื่อมต่อ นำเข้าหรือคืนค่าต้องเป็นร่างก่อนเผยแพร่
- จำกัด `uiConfig` 16,000 bytes / settings รวม 62,000 bytes (UTF-8); รายชื่อค้นหาและวาดหน้า 25 คน แต่ยังใช้ที่เก็บ settings เดิม หากต้องรองรับขนาดใหญ่กว่านี้ให้แยกทะเบียนผู้ใช้เป็นงานออกแบบใหม่ ไม่ตัดข้อมูลเดิมเพื่อให้บันทึกผ่าน
- ปุ่มใหม่ใช้ตัวแปร `--ws-button-height` / `--ws-radius` และชุด class ร่วม; บนมือถือขั้นต่ำ 44px/ช่องกรอก 16px ระวัง `.dv-del` เดิมมี position:absolute ใน media query จึงต้อง scope/reset สำหรับหน้าหรือฟอร์มใหม่

## ฟีเจอร์ v16.39 · รายการจาก Teams แบบกดเปิดเอง
- ห้ามเปิดหน้าต่างนำเข้า Channel หลังซิงค์อัตโนมัติ `mOfferTeamImports(true)` ใช้เฉพาะจากการกดของผู้ใช้ `mApprovalImportsInject` เพิ่มปุ่มใน `.page-heading .heading-actions` ของหน้ารออนุมัติ และอัปเดตจำนวนอย่างเดียวหลังซิงค์
- `mImportCandidates` และขั้นตอนตรวจ Channel/กันซ้ำ/ยืนยันสร้างเดิมยังคงใช้ จำกัดทางเข้าด้วย Engineer/Admin ตรวจบทบาทอีกครั้งหลังอ่านและกันคลิกเปิดซ้อนก่อนเริ่มอ่าน
- ปุ่มนำเข้าเป็นการเปิดดู ยังไม่เขียน SharePoint จนผู้ใช้ยืนยันในฟอร์ม ตัวเลือกรายการค้นหาและแบ่งหน้า 25 รายการ ไม่กรองทิ้งตามชื่อ Channel ที่อาจเป็นชื่อโครงการจริง

## ฟีเจอร์ v16.40 · ตั้งค่าหน้าสถานะและตัวกรองผู้รับผิดชอบ
- `wsDefaultStatus` / `wsValidateStatus` เก็บคำและลำดับการ์ดใน `uiConfig.status` (schema 2); นำเข้ารุ่น 1 จะเติมค่าเริ่มต้น ห้ามเปลี่ยน `SUBST` / `SUBORD` / `PSTAT` ตามข้อความที่ Admin กรอก เพราะยังใช้เขียนสถานะจริงและอ่านคำสั่ง Teams
- ลำดับต้องมีครบทุก key ภายในกลุ่มเดิม: 8 ขั้นตอน active และ delivered/closed; ไม่รองรับการเพิ่ม/ลบสถานะจริงจากหน้า Admin คำที่กรอกเป็น plain text และ escape ก่อนแสดงเสมอ
- ใช้ร่าง/เผยแพร่/backup/eTag/fingerprint ชุดเดียวกับ Admin เดิม และปฏิเสธ schema รุ่นใหม่ที่ยังไม่รู้จัก เพื่อไม่ให้เว็บเก่าบันทึกทับค่ารุ่นใหม่
- `dvStatusRows` รับเฉพาะ `st.projects` ที่กรองสิทธิ์จาก `mState` แล้ว; ตัวเลือกชื่อและตัวเลขทั้งหมดต้องมาจากชุดนี้ ห้ามย้อนกลับไปอ่าน `M.cache.items` เพื่อรวมงานที่บัญชีไม่มีสิทธิ์เห็น
- ตัวกรอง Engineer ใช้ค่าที่กำหนดจริงใน `p.engineer` เทียบชื่อ/อีเมลแบบตรงตัว ไม่เดาจากผู้ตอบ Teams หรือผู้อนุมัติ; ไม่มีค่าให้จัดเป็น “ยังไม่ระบุ Engineer” ส่วน Sales ใช้ `accountId` ของเจ้าของงาน (รวมกรณีคีย์แทน)
- `DV.se`/`DV.sa` เป็นตัวเลือกชั่วคราวของหน้าจอ ห้ามส่งลง settings ร่วม; ใช้กรองก่อนสรุปยอด/รายการ/บอร์ด แล้วค่อยค้นหาและแบ่งแสดง

## การทดสอบ (แนะนำ)
- ชุดทดสอบจำลอง: `node --test tests/*.test.cjs` · ตัวอย่าง UI `node tests/serve-workspace.cjs` (localhost:8771, `?role=admin|engineer|sales|viewer`) ไม่มีการติดต่อ Microsoft จริง
- การตรวจ UI เพิ่มเติม: ใช้ Playwright เปิด `index.html` ผ่าน `python3 -m http.server` แล้วดัก request ทั้งหมดไป `login.microsoftonline.com`, `graph.microsoft.com`, `*.sharepoint.com` ด้วย mock ที่ตอบข้อมูลปลอม
- ใช้ clientId ปลอม `11111111-1111-1111-1111-111111111111` แทนตัวจริงในสำเนาทดสอบ → จะมี hook `window.__t` (sync, ts, render, od ฯลฯ) สำหรับเทสต์
- ห้ามทดสอบกับ tenant จริง

## Deploy
- commit แล้ว push เข้า `main` (หรือเปิด PR ให้เจ้าของ merge) → GitHub Pages อัปเดตเอง · เช็ก https://satittc-oss.github.io/9d-ops/version.json ว่าเป็นเวอร์ชันใหม่
- ก่อนเริ่มงานทุกครั้ง `git pull` — มีหลาย agent/session แก้ repo นี้ อย่าเขียนทับงานของคนอื่น (ถ้า index.html บน main เปลี่ยนระหว่างทำ ให้ merge/ทำ patch ใหม่บนเวอร์ชันล่าสุด)
