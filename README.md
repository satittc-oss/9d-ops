# 9d-ops
9D Integrated Operations - Nine Distribution (Microsoft 365 sign-in required)

## ออกเวอร์ชันใหม่
เมื่อเปลี่ยน `M_VER` ใน `index.html` ให้แก้ `version.json` เป็นเลขเดียวกันเสมอ — หน้าเว็บที่เปิดค้างไว้ใช้ไฟล์นี้เช็คว่ามีเวอร์ชันใหม่
ถ้าแก้ไอคอนหรือ manifest ให้เปลี่ยนชื่อ cache (`C`) ใน `sw.js` ด้วย

## หน้าเมืองจำลอง (v16.14)
`city.html` คือฉาก 3 มิติ (ฝังในเมนู "เมืองจำลอง" ผ่าน iframe `city.html?embed=1`) และใช้ `vendor/three.r128.min.js` (three.js r128, MIT) — ตอนนี้ยังใช้ข้อมูลจำลอง ยังไม่ผูกกับโครงการจริง

## ข้อมูลจริงในเมืองจำลอง + Outlook (v16.15)
- หน้าเมืองจำลองส่งข้อมูลโครงการจริง (จาก All Projects List + 9D Project Tracking) เข้า `city.html` ผ่าน `postMessage` — 1 โครงการ = 1 คัน: รออนุมัติ → Sales · กำลังทำ → Engineering (โต๊ะของ Engineer ผู้รับผิดชอบ) · ส่งงานแล้ว → กลุ่มลูกค้า · WIN / LOSS / ยกเลิก (14 วันล่าสุด) → ลานผลงาน
- "เชื่อมต่อ Outlook" ขอสิทธิ์ `Mail.Read` + `Calendars.Read` (อ่านเฉพาะ /me ของคนที่ล็อกอิน) แยกจากการล็อกอินปกติ — เนื้อหาเมล/ปฏิทินอยู่ในหน่วยความจำของหน้าเว็บเท่านั้น
- ตำแหน่งงานของ Engineer จากปฏิทิน (ช่วงเวลา + รหัสตึก ไม่มีหัวข้อ) บันทึกเป็นแถว `presence:<email>` ใน 9D Project Tracking (`ProjectItemId = -9000000000`) ถ้าเจ้าตัวไม่ปิดการแชร์
- กฎจับคู่หัวข้อนัดหมาย → ตึก อยู่ใน `OL_RULES` ของ `index.html`

