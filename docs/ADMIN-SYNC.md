# 9D v16.41 · ตั้งค่าหลังบ้านและซิงก์

**ระหว่างพัฒนาใช้ mock เท่านั้น ยังไม่ได้สร้าง List/แก้สิทธิ์/ติดตั้ง worker ในองค์กร และยังไม่ได้ทดสอบ tenant จริง** ต้องตรวจ PR และอนุมัติ merge/deploy ก่อน เอกสารนี้เป็นขั้นตอนให้ผู้ดูแลทำภายหลัง

## หลังบ้าน

เปิดเมนู **ศูนย์ผู้ดูแล** เฉพาะ Admin:

- ภาพรวม: งานรอ/ผลไม่แน่ชัด/ข้อมูลขัดแย้ง/สำเร็จ พร้อมหลักฐาน worker ล่าสุด
- ข้อมูลโครงการ: ค้นหา กรอง Engineer/เซลส์/สถานะ/วันที่ แบ่งหน้า 25; แก้ข้อมูลเห็นค่าเดิม/ใหม่ก่อนยืนยัน; การเชื่อม Channel มี checkbox ตรวจปลายทาง
- คิวและผลซิงก์: ตรวจ receipt/audit/เหตุผลแต่ละปลายทาง สั่งทำเฉพาะที่ค้าง หรือยกเลิก/ข้ามพร้อมเหตุผล
- Flow: เปิด/ปิด กำหนดวันเตือน ช่วงรับข้อความ ปิดคำสั่งบางสถานะ; ส่งออก/นำเข้า/คืนก่อนหน้าเป็นฟอร์มให้ตรวจแล้วค่อยบันทึก
- หน้าเว็บ: ธีม คำ เมนู การ์ด ปุ่ม และหน้าข้อมูล/ลิงก์ ตาม schema เดิม พร้อมตัวอย่างและเผยแพร่ส่วนกลาง
- ผู้ใช้: บทบาทแอป/ชื่อผู้ใช้; การเปลี่ยนบทบาทเมื่อเปิดซิงก์ต้องยืนยันการปรับ ACL คิว/ทะเบียน/settings เท่านั้น ไม่ได้ตั้ง Microsoft Tenant Admin และไม่ได้ให้สิทธิ์แอปทุก List
- ประวัติ/สำรอง: UI backup เดิม + export กติกาในหน้า Flow + export audit คิวเป็น JSON. ไฟล์ที่มีข้อมูลโครงการ/รายชื่อเป็นข้อมูลภายใน ห้ามนำขึ้น public repo

CI ใช้ขาว/ดำ Cyan `#00ADEF` Blue `#005CB9`, ribbon และฟอนต์สำรองภาษาไทยร่วมชุดเดิม คงโลโก้และชื่อ Nine Distribution; ไม่ใส่โลโก้ CommScope แทนแบรนด์ของบริษัท

## ขั้นตอนเปิดใช้ (ผู้ดูแลดำเนินการเอง)

1. ตรวจ **All Projects List/Tracking เดิม**: บัญชีผู้ใช้เข้าถึงได้ตามหน้าที่จริงใน Microsoft, Engineer/Admin ที่จัดการโครงการเข้า Private Channel ที่เกี่ยวข้องได้ และ settings มี Admin/Engineer/Sales/Viewer ที่ใช้งานจริง ไม่ใช่พึ่งการซ่อนปุ่ม. หน้าหลังบ้านไม่เปลี่ยน ACL ของ Main List หรือไซต์ทั้งองค์กรแทน IT
2. Admin → การเชื่อมต่อ → **เตรียมระบบซิงก์**: ดูรายการพื้นที่/ขอบเขต ACL เลือกกลุ่ม SharePoint ที่ให้ส่งคำสั่ง ตรวจแล้วยืนยัน ผู้ดูแลต้องให้ consent เพิ่มตามที่ Microsoft แสดง. จะสร้าง Queue/Directory และปรับเฉพาะ settings row ตาม [mapping](DATA-MAPPING.md); การเปิดหน้าปกติไม่ทำขั้นตอนนี้
3. ถ้ามี List ชื่อเดียวกันอยู่แต่คอลัมน์ไม่ครบ/ProjectRef หรือ ChannelKey ซ้ำ ให้หยุดแก้โดย IT ไม่ลบข้อมูลเดิมให้ schema ผ่าน. Setup ตรวจ Queue item security, unique index และสิทธิ์ settings; เปิดซิงก์เมื่อค่าที่อ่านกลับผ่านเท่านั้น
4. **เริ่มทะเบียนโครงการเก่า**: Admin → ข้อมูลโครงการ → กรองชุดที่จะใช้ → เตรียมทะเบียนซิงก์ → ตรวจรหัส เจ้าของ (รวมคีย์แทน) สถานะ/Channel → ยืนยัน ส่งทีละไม่เกิน 50 โครงการ/ครั้ง แล้วประมวลผลคิวหรือให้ worker ทำ. เริ่มชุดเล็กใน test environment ก่อน โครงการใหม่เริ่มทะเบียนจากคำสั่งแรกหรือการผูกผล Channel; รายการ SP ใหม่ที่ยังไม่มีทะเบียนต้องให้ Admin ตรวจเข้าชุดนี้
5. Flow → ตรวจ/เปิด policy และการแจ้ง Teams. worker ตรวจ policy ล่าสุดก่อนทำคำสั่ง. UI settings เผยแพร่จากหน้าเว็บแยกกัน ไม่ต้องส่งสี/ปุ่มไป Teams
6. ติดตั้ง worker ด้านล่าง หากต้องซิงก์ต่อเมื่อปิดเว็บ. จนกว่าจะมี workerAt ที่ใหม่และตรวจผลได้ ให้ถือว่ายังไม่มีงานเบื้องหลัง. เบราว์เซอร์ Admin ทำคิวได้เฉพาะตอนเปิดอยู่ ส่วนบัญชีอื่นส่งคำสั่งเข้าคิวเพื่อรอประมวลผล
7. ตรวจด้วยข้อมูลทดสอบใน **tenant ทดสอบขององค์กร** โดยผู้ดูแลหลังอนุมัติ rollout: ทุกบทบาท, แก้พร้อมกัน, บัญชีเข้า Private Channel ไม่ได้, token หมดอายุ, 429, timeout, บัญชีถูกลดบทบาท และการกู้คืน. mock ไม่ทดแทนการตรวจ Microsoft ACL/Conditional Access จริง

## Node worker ที่ไม่ต้องเปิดเว็บ

ใช้เครื่ององค์กรที่เปิดอยู่ตามรอบและมี Node.js 22 ขึ้นไป พร้อม OS credential store (Windows DPAPI / macOS Keychain / Linux Secret Service+libsecret). worker รันหนึ่งรอบแล้วออก ใช้ Task Scheduler/launchd/systemd timer ขององค์กรเรียกซ้ำ ไม่ใช้ GitHub Actions เก็บ token บริษัท

1. Entra admin ตรวจ App Registration ตัวเดิมหรือแอปแยกที่องค์กรอนุมัติ: เปิด public client/device code ตามนโยบายองค์กร และให้ delegated consent ที่จำเป็น **ผู้ดูแลกดยืนยันเอง**:
   - Microsoft Graph: `User.Read`, `User.ReadBasic.All`, `Sites.ReadWrite.All`, `Channel.ReadBasic.All`, `ChannelMessage.Read.All`, `ChannelMessage.Send`.
   - SharePoint resource: `AllSites.FullControl` สำหรับ **บัญชี Admin ที่จัดการเฉพาะพื้นที่ซิงก์**. ขอ token แยก resource จาก Graph เสมอ
   - ผู้ใช้ที่ login worker ต้องเป็น Admin ใน settings และมี Microsoft ACL จริง พร้อมเป็นสมาชิก Channel ที่ต้องอ่าน/เขียน. แอปไม่ได้ยกระดับบัญชีให้เอง
2. ดาวน์โหลด **ไฟล์เชื่อมต่อ worker** จาก Admin → การเชื่อมต่อ. วาง `config.local.json` ในเครื่ององค์กร ห้าม commit/วางบน GitHub Pages แม้ไฟล์นี้ไม่มี token; มี tenant/List/column metadata. ถ้าใช้ App Registration แยก เปลี่ยน `clientId` ในไฟล์ส่วนตัวที่ดาวน์โหลด
3. นำ checkout ที่ตรวจแล้วไปเครื่ององค์กร รวม `sync-core.js` / `sync-m365.js` และ `sync-worker/` ตามโครงสร้างเดิม แล้วใช้:

   ```sh
   cd /path/to/9d-ops/sync-worker
   npm ci
   node worker.cjs --config /private/path/config.local.json --login
   node worker.cjs --config /private/path/config.local.json
   node worker.cjs --config /private/path/config.local.json --once --apply --scan 10 --budget 8 --limit 10
   ```

   สองคำสั่งแรก login/check ไม่เขียน business data. `--apply` จึงประมวลผลจริง. npm รุ่นที่มี allowScripts ใช้รายการ pinned ใน package.json; native keytar ต้องติดตั้งสำเร็จ ห้ามแก้ให้ cache กลายเป็น plaintext เพื่อข้ามปัญหา
4. `--login` แสดงรหัสสำหรับ Microsoft device login ให้ผู้ดูแลเปิด URL ที่ Microsoft แจ้งและยืนยันเอง. token เก็บด้วย MSAL extensions ใน OS store; ไม่มี client secret/password ใน repo และไม่พิมพ์ access token. ถ้าถูกขอ login ใหม่หรือ Conditional Access ปฏิเสธ worker จะออกพร้อมข้อผิดพลาด ให้ผู้ดูแลจัดการนโยบาย/ลงชื่อเข้าใช้ใหม่
5. ตั้ง scheduler เรียก **คำสั่ง apply ข้างต้น** ทุก 1 นาทีด้วยบัญชี OS เดียวกับที่ login และ cache directory เดียวกัน; เลือก “ไม่เริ่ม instance ใหม่หากรอบก่อนยังทำงาน”. ไม่ต้องตั้งค่าตัว scheduler จากเว็บ. ถ้าต้องการ path cache เฉพาะใช้ `--cache-dir /private/path/cache`
6. เวลาเครื่องปิด/หลับ/ไม่ต่ออินเทอร์เน็ต/credential store ล็อก จะไม่มีการประมวลผล. เปิดกลับแล้วงานอยู่ใน SharePoint และทำต่อได้ ไม่ทิ้งคิวไว้เฉพาะใน RAM ของเว็บ

`--limit` คิวที่ทำต่อ, `--scan` จำนวนโครงการสำหรับ Teams รอบละเท่าใด, `--budget` จำนวนหน้าต่อ Channel (1–100). ค่าเริ่มต้น 10/10/8. รอบ worker อ่าน Main List เปรียบเทียบโครงการที่ลงทะเบียนทั้งหมดและรับการเปลี่ยน Main/Directory ก่อนเลือก Teams แบบหมุนเวียน; จำกัด changed projects ต่อรอบด้วย limit. GET มี retry เฉพาะ transient/429 ตาม Retry-After สูงสุด 3 ครั้ง; POST/PATCH ไม่ retry อัตโนมัติ

หากมี 160 Channels และ scan=10 ต้องประมาณ 16 รอบจึงเยี่ยมครบหนึ่งรอบ ส่วน thread เก่า/หลายหน้ายังต้องต่อ cursor ตาม budget จึง **ไม่ใช่ realtime และไม่รับประกันครบทุก Channel ภายในหนึ่งนาที** ดู lastAttemptAt/lastCompleteAt ในข้อมูลต้นทางและ heartbeat. ปรับปริมาณกับ latency/throttling ที่วัดจริง; งาน scale ใหญ่ควรเพิ่ม event-driven ingestion เป็นรุ่นต่อไปพร้อม API permissions ที่องค์กรอนุมัติ

Power Automate เดิมที่เขียน inbox ไม่ถูกนำมาเชื่อสถานะอัตโนมัติเมื่อ syncAccess v1 ทำงาน เพราะต้องตรวจ canonical author/ข้อความใหม่ ชุดนี้ใช้ Node+Graph สำหรับ Private Channels. [Teams connector](https://learn.microsoft.com/en-gb/connectors/teams/) มีข้อจำกัดกับ private-channel posting จึงไม่เสนอ Flow card ที่ใช้ไม่ได้กับโครงสร้างจริง

อ้างอิง: [MSAL encrypted persistence](https://learn.microsoft.com/en-us/entra/identity-platform/msal-node-extensions), [device/silent token acquisition](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests).

## ตรวจปัญหาและย้อนกลับ

- เกิด 403: ตรวจบัญชีจริง/role ใน settings/ACL ของพื้นที่ซิงก์/การเป็นสมาชิก Channel/consent ให้ครบ ไม่ให้ผู้ใช้เพิ่มสิทธิ์ตัวเอง
- ผลไม่แน่ชัด: เปิดคิว ดู operation key, message id และผล GET; ทำต่ออ่าน marker ก่อน. ห้ามลบ pending/uncertain record แล้วกดสร้างใหม่เพื่อข้ามการตรวจ
- ข้อมูลขัดแย้ง: ตรวจค่าล่าสุด ยกเลิกคำสั่งพร้อมเหตุผล แล้วเปิดฟอร์มใหม่. การยกเลิกไม่ rollback ข้อมูลที่อีกระบบรับไปแล้ว
- เปลี่ยน role จากแผงนี้: ต้องยืนยันผล ACL และทำ scope alignment ก่อนแจ้งสำเร็จ; ถ้าค้างให้ Admin เดิมใช้ Setup อีกครั้งเพื่อตรวจ/ซ่อม. ตรวจใบเสนอราคาด้วยปุ่มตั้งสิทธิ์เดิมแยกตามรายการที่องค์กรอนุมัติ
- หยุด worker scheduler และปิด Flow ใน settings เพื่อพัก rollout; เก็บ Queue/Directory ไว้. ไม่ลบ List/ไม่ล้างประวัติ. UI เก่ารองรับก่อนเปิด syncAccess; หลังเริ่มใช้ Directory แล้วอย่าสลับกลับ legacy เพื่อเขียนข้อมูลซ้อนโดยไม่มี migration review
- ส่งออก UI/Flow backup ก่อนปรับ; import/คืนฉบับก่อนเป็นร่างแล้วเผยแพร่. การคืน backup ไม่ย้อน project data, consent, ACL หรือ binding อัตโนมัติ

## ข้อจำกัดที่ตั้งใจแสดงให้ผู้ดูแลเห็น

- แหล่งภายนอกใช้ polling ไม่ใช่ webhook; Channels/โครงการที่ยังไม่ลงทะเบียนไม่ถูกรับคำสั่ง. ยังไม่มี unattended app-only normal Teams posting หรือ tenant-wide discovery/creation ขณะปิดเว็บ
- Main business List/ไซต์/Team permissions, บัญชี Entra และ Quotations ACL ใช้ขอบเขตองค์กร/โมดูลเดิม. Setup ไม่แก้สิทธิ์ทั้งบริษัท และ app role ไม่จำกัด Microsoft site owner/tenant admin ที่มีสิทธิ์สูงกว่าอยู่แล้ว
- ข้อมูลใน settings รวมไม่เกิน 62 KB, UI 16 KB, request 24 KB, Queue 50 KB, Directory 62 KB; รายชื่อ UI แบ่งหน้า แต่ยังเก็บ registry ผู้ใช้ใน settings เดิม. เกินขนาดจะหยุดโดยไม่ตัดข้อมูล ต้องออกแบบทะเบียนผู้ใช้แยกสำหรับปริมาณมากขึ้น
- Graph pagination มี guard 200 หน้า ไม่อ่านไม่จำกัด. คิว/ประวัติระยะยาวต้องมี retention และ archive ใน SharePoint ตามนโยบาย IT ก่อนเพิ่มผู้ใช้จำนวนมาก
- ไม่ลบ/ย้าย project identity, ไม่สร้าง status schema ใหม่, ไม่โอนเจ้าของหรือ Channel memberships อัตโนมัติ; ใช้ขั้นตอนดูผลกระทบและตั้งค่าฝั่ง Microsoft ที่เกี่ยวข้อง
