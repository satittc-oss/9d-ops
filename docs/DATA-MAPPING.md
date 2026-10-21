# 9D v16.41 · ข้อมูลกลางและสัญญาการซิงก์

เวอร์ชันนี้เป็นการซิงก์ตามชนิดข้อมูลที่ระบุในตาราง ไม่ใช่การคัดลอก SharePoint ทุก List หรือทุกการตั้งค่าไป Teams ใช้ `sync-core.js` และ `sync-m365.js` ชุดเดียวกันทั้งเว็บและ Node worker การเปิดใช้งานต้องผ่านขั้นตอนใน [ADMIN-SYNC.md](ADMIN-SYNC.md)

## แหล่งข้อมูล

| ข้อมูล / key | แหล่งหลักใน SharePoint | เว็บและผู้แก้ไข | Teams | เมื่อขัดแย้ง |
|---|---|---|---|---|
| ProjectItemId / code | All Projects List: ID และคอลัมน์ `M.cols.code` | ID/รหัสอ่านอย่างเดียวในหลังบ้าน | อ้างอิงรหัสในข้อความ | ID จาก Microsoft; ไม่เปลี่ยนรหัสเพื่อเปลี่ยนชื่อ |
| name, client, source, brands, workTypes, notes, urgency, closingChance, assignedAt, estimatedValue | คอลัมน์จริงตาม `M.cols` ของ All Projects List | เจ้าของแก้คำขอระหว่างรออนุมัติตามสิทธิ์เดิม; Admin แก้ผ่านหลังบ้าน | สรุปชื่อ/คู่ค้า/สถานะที่เกี่ยวข้อง ไม่ส่งรายละเอียดใบเสนอราคาหรือทุกฟิลด์ภายใน | Main List เป็นหลัก; ฟอร์มใช้ eTag ล่าสุด ไม่เขียนทับเมื่อ 412 |
| RequestStatus / การอนุมัติ | All Projects List / Microsoft Lists Approvals | ใช้ขั้นตอนอนุมัติ/ตรวจผลเดิม ผู้อนุมัติที่ได้รับสิทธิ์ | สรุปข้อมูลของโครงการที่มี Channel แล้ว; ไม่อนุมัติด้วย hashtag | ผล Microsoft เป็นหลัก; worker ไม่อนุมัติแทน |
| pstat.s | DirectoryJson.pstat + Main latest/winLoss | Engineer/Admin; เซลส์เจ้าของใช้ WIN/LOSS/ยกเลิก/เปิดใหม่ตามเดิม | ข้อความสรุปและคำสั่งที่รองรับ | `active → In Progress/Process`, `delivered → Finish/Process`, `won → Finish/WIN`, `lost/cancelled → Loss/LOSS`; เก็บ cancelled แยกใน Directory |
| sub.sub | DirectoryJson.sub + Main คอลัมน์ step (ถ้ามีและเขียนได้) | Engineer/Admin และเจ้าของตามสิทธิ์เดิม; เฉพาะโครงการ active | hashtag ขั้นตอนและสรุป | รับเฉพาะ recv/design/buy/sup/price/sales/quote/cust; ชื่อหน้าจอไม่เปลี่ยนรหัส |
| engineer | DirectoryJson.engineer + Main Engineer LookupId (ถ้ามี) | Engineer/Admin; เลือกผู้ใช้ที่มีบทบาท engineer/admin ใน settings | ชื่อผู้รับผิดชอบในสรุป | ตรวจผู้ใช้กับทะเบียนกลาง; ค่า Lookup จาก Lists ต้องตรงผู้ใช้ที่เปิดใช้ |
| due, followup, waitingOn, nextAction, summary, priority | 9D Sync Directory / DirectoryJson | Engineer/Admin; ฝั่ง Sales แก้ส่วนผลลูกค้า/ติดตามตามกฎเดิม | กำหนดส่ง งานต่อไป ผู้รับผิดชอบ และบันทึกที่เกี่ยวข้องในข้อความ | Directory เป็นหลัก; direct Directory edit รับเฉพาะรูปแบบที่รองรับ; ฟอร์มมี revision guard |
| stage, outcome, salesSummary, closeRequestedAt | DirectoryJson | กฎ PV เดิม + validation ใน adapter: มอบหมายก่อนทำงาน, สรุปก่อนส่ง/ปิด, ปิดระบุผล, Sales ส่งผลของตน | สรุปสถานะ/งานต่อไป | ไม่ย้ายความหมายโครงการเดิมตามชื่อการ์ดใหม่; คำสั่ง status แบบเดิมยังรองรับ |
| owner | Main createdBy ตอนเริ่มทะเบียน; กรณี onBehalf ให้ Admin ตรวจยืนยันก่อน | อ่านอย่างเดียว; ไม่เชื่อ email จาก request payload | ใช้ตรวจสิทธิ์ ไม่ส่งอีเมลในข้อความ | Canonical owner ใน Directory; การโอนเจ้าของ/ย้ายข้อมูลต้องแยกงานพร้อมตรวจ ACL |
| teamId, channelId, channelUrl | DirectoryJson + ChannelKey unique | Admin เปลี่ยนจาก dialog ที่แสดงผลกระทบ; Engineer ผูกผลสร้างครั้งแรกที่ตรงรหัสผ่าน mChannel เดิม | ตรวจ Channel จริงและกันผูกกับโครงการอื่น; ไม่เปลี่ยนชื่อ/สมาชิกจากการแก้ชื่อโครงการ | Directory เป็นหลัก; direct JSON เปลี่ยน binding จะหยุดและให้ใช้หลังบ้าน |
| channelArchive / ไฟล์ / native setup | Tracking / กลไก Archive และแนบไฟล์เดิม | ยืนยัน Archive เฉพาะโครงการปิด; ตรวจ isArchived จริง | คำสั่ง Archive เดิม | ไม่ให้ worker สร้าง/Archive/เปลี่ยนสิทธิ์ Channel เอง |
| uiConfig, sidebarOrder, uiRevision | Tracking `ProjectItemId=0` | Admin ร่าง → ตัวอย่าง → เผยแพร่; เว็บทุกบัญชีอ่านค่ากลาง | ไม่มีการตั้งค่าที่เทียบเท่าใน Teams จึงไม่ส่งธีม/ปุ่ม/ลำดับการ์ด | settings eTag + UI fingerprint; แยกชื่อแสดงจาก status key |
| workflowPolicy | settings แถวเดียวกัน | Admin ตั้งเปิด/ปิดการซิงก์, การแจ้ง Teams, ช่วงรับคำสั่ง, disabled transitions, วันเตือน | worker ใช้กฎล่าสุดก่อนรับคำสั่ง/เตือน | ตรวจชนิด/ช่วงค่า; backup ก่อนหน้า; ไม่เพิ่ม status key ตามข้อความอิสระ |
| members, accounts, settings เดิม | settings แถวเดียวกัน (protected item ACL) | Admin ตรวจตัวเองจากค่าล่าสุด; เปลี่ยนบทบาทต้องยืนยันผล ACL เฉพาะพื้นที่ซิงก์ | ไม่สร้างบัญชี Entra/ไม่แต่งตั้ง Microsoft Tenant Admin/ไม่เพิ่มสมาชิก Team ตามบทบาทเว็บ | Microsoft ACL ยังเป็นขอบเขตสูงสุด; app role เป็นกฎเพิ่มของ 9D |
| ใบเสนอราคา / ยืมสินค้า / เซอร์วิส | Lists และ ACL เดิมของแต่ละระบบ | คงขอบเขตเดิม; ใบเสนอราคาทุกบทบาททำของตน Admin ทั้งหมด | ไม่ส่งราคา/เอกสารไปทุก Channel อัตโนมัติ | อยู่นอกคิว business project รุ่นนี้; ไม่อ้างว่ามี bidirectional sync ทุกโมดูล |

## พื้นที่ใหม่ (สร้างเมื่อ Admin กดยืนยัน)

| List / ฟิลด์ | หน้าที่ | สิทธิ์ |
|---|---|---|
| **9D Sync Queue**: OperationKey (unique/indexed), ProjectRef, JobJson, State, TargetSP, TargetTeams | คำสั่งถาวร, base eTag/revision, receipt แยกปลายทาง, audit ค่าเดิม/ใหม่, retries/lease | ReadSecurity/WriteSecurity=2; กลุ่มที่ Admin เลือก Contribute; Owners/Admin Full Control เฉพาะ List |
| **9D Sync Directory**: ProjectRef (unique/indexed), DirectoryJson, ChannelKey (unique/indexed) | Canonical project metadata, owner, version, syncRevision, active operation, observed/published snapshot และ cursor | Admin/Owners เขียน; Engineer อ่าน; เจ้าของอ่านเฉพาะรายการผ่าน item ACL; ไม่ให้กลุ่ม Members ทั้งกลุ่มอ่านทุกทะเบียน |
| Directory ProjectRef=0 | heartbeat, workerAt, pagination cursor และข้อผิดพลาดรอบล่าสุด | Admin/Engineer ตาม ACL ของ Directory; ไม่ใช่โครงการ |
| Tracking settings ProjectItemId=0 | UI, Flow, roles, syncAccess | ตัด inheritance เฉพาะแถวนี้ ให้ Owners/Admin Full Control และกลุ่มที่เลือก Read; ไม่ตั้งสิทธิ์ Tracking ทั้ง List ใหม่ |

Queue/Directory เปิด version history 100 ฉบับเมื่อ setup. ประวัติใน Directory เก็บล่าสุด 16 เหตุการณ์และ activities 80 รายการเพื่อจำกัด payload; Queue เก็บ audit ต่อคำสั่งและผลปลายทาง ส่งออกได้จาก Admin → ประวัติ/สำรอง การเก็บระยะยาว/retention ให้ IT กำหนดใน SharePoint ไม่ใช้ Teams เป็น log archive

## กลไกแต่ละทาง

1. **เว็บ → SharePoint → Teams**: อ่าน base → รับเข้าคิว (ยังไม่เท่ากับสำเร็จ) → Admin browser หรือ worker ตรวจ canonical author/role/owner → จอง Queue และโครงการด้วย eTag → PATCH เฉพาะฟิลด์ mapped → GET ยืนยัน → บันทึก Directory → ส่งสรุป Teams ที่มี operation marker → GET ยืนยัน → ปิดงานและเผยแพร่ snapshot
2. **SharePoint → เว็บ/Teams**: เว็บ poll settings/ข้อมูลกลาง (30–900 วินาที เฉพาะแท็บที่เปิด/มองเห็น); worker อ่าน Main List เทียบ snapshot ของทะเบียนและตรวจ Directory business snapshot; metadata ของ lease/cursor ไม่สร้าง loop. business changes จาก Main ตรวจผู้แก้จริง บทบาทและเจ้าของ; request fields ที่อนุมัติแล้วให้ Admin แก้ หากไม่ผ่านจะเก็บ blocked โดยไม่กระจายต่อ ไม่ย้อน Main ที่บุคคลนั้นแก้ผ่าน Microsoft เอง. ชื่อ/คู่ค้ามี Main เป็นหลัก จึงไม่รับการแก้ชื่อผ่าน Directory JSON
3. **Teams → SharePoint → เว็บ**: อ่าน root/replies ตาม cursor; รับเฉพาะ hashtag หนึ่งคำสั่งที่รองรับ; GET ข้อความ canonical ใหม่ ตรวจ `from.user.id` กับ Graph `/users/id` และบทบาทล่าสุด ไม่เชื่อชื่อหน้าข้อความหรือ email ใน payload; ตรวจว่า source Team/Channel ตรงทะเบียน; เขียนผ่านคิวเดียวกัน; ตอบใน Thread ต้นทาง

**คำสั่ง**: `#ส่งงานแล้ว` / `#delivered`, `#win`, `#loss`, `#ยกเลิก`, `#เปิดงานใหม่` / `#reopen`, `#ทำBOM` / `#ออกแบบ`, `#รอจัดซื้อ`, `#รอซัพ`, `#รอราคา`, `#รอเซลส์`, `#ส่งราคา`, `#รอลูกค้า`. ไม่รับหลายคำสั่งในข้อความเดียว, ข้อความที่ลบ, ข้อความเก่าเกิน policy หรือก่อนสถานะล่าสุด, และข้อความ `[9D]`/`9D Sync ·` ของระบบเอง รุ่นนี้ยังไม่มี Adaptive Card/Bot สำหรับส่งวันที่/มอบหมาย/อนุมัติ

## การยืนยันและการกู้คืน

- `pending/sending/verified/not_applicable/blocked/failed/uncertain/conflict/skipped/cancelled` แสดงแยก SP/Teams. “ครบแล้ว” เกิดหลัง GET ยืนยันทั้งปลายทางที่เกี่ยวข้อง; ไม่มี Channel หรือปิด notify ต้องแสดงเหตุผล N/A
- รหัสเว็บ UUID; แหล่ง SP/Teams ใช้ SHA-256 ของ reference ที่แน่นอน; OperationKey unique. ส่ง key เดิม+รายละเอียดเดิมคืนแถวเดิม key เดิม+รายละเอียดใหม่ถูกปฏิเสธ
- เชื่อ receipt ที่ Microsoft ระบุว่าผู้แก้ล่าสุดมี Admin role ในทะเบียนกลาง; receipt จากผู้ส่งที่ไม่ใช่ Admin ถูกเริ่มตรวจใหม่ ไม่เชื่อ `verified` หรือ audit ที่ใส่เอง. เมื่อโครงการมีหลักฐานว่าเคย apply แล้ว จะตรวจ marker ก่อน และไม่ส่ง Teams ซ้ำ
- Queue lease 5 นาที + Directory active operation + eTag CAS ป้องกันทำงานพร้อมกัน. ข้อมูลใหม่กว่าฟอร์มจะเป็น conflict ให้ตรวจ/ยกเลิกคำสั่งเก่าแล้วเปิดฟอร์มใหม่
- POST Teams ที่ไม่ทราบผลจะตรวจ message id/marker ต่อไป ไม่มีการ reset เป็น pending เพื่อส่งสร้างซ้ำ. หากยังไม่พบ ให้ Admin ตรวจ Microsoft แล้วเลือกทำต่อ/ข้าม Teams พร้อมเหตุผล; skipped แยกจาก complete
- ยกเลิกคำสั่งไม่ย้อนข้อมูลที่บันทึกสำเร็จไปแล้ว. ต้องระบุเหตุผล และบันทึกการตัดสินใจ. หากปิดงานแล้วแต่ปลด active ไม่สำเร็จ รอบถัดไปซ่อม cleanup โดยไม่โพสต์ซ้ำ
- Source polling เป็น eventual consistency: root 20 รายการล่าสุดตรวจทุกครั้งที่เยี่ยม Channel; replies/หน้าที่เก่ากว่าไล่ต่อด้วย cursor ไม่อ้างว่าตรวจครบเมื่อยังมีหน้าค้าง ดูเวลาจบรอบจริงใน source status

## เอกสาร Microsoft ที่ใช้ตรวจสัญญา API

- [Graph listItem PATCH / If-Match](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0)
- [ส่งข้อความ Channel และสิทธิ์ delegated](https://learn.microsoft.com/en-us/graph/api/channel-post-messages?view=graph-rest-1.0)
- [อ่านข้อความ/ผู้เขียนจริง](https://learn.microsoft.com/en-us/graph/api/chatmessage-get?view=graph-rest-1.0)
- [Teams connector limitations — รวม private channels](https://learn.microsoft.com/en-gb/connectors/teams/)
