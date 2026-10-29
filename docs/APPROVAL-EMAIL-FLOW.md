# แจ้งเตือนอีเมลผู้อนุมัติเมื่อมีคำขออนุมัติโครงการใหม่ (Power Automate)

คู่มือนี้ให้ **ผู้ดูแล (Satit)** สร้าง Power Automate flow ที่ส่งอีเมลหา "ผู้มีสิทธิ์อนุมัติ" โดยอัตโนมัติ เมื่อมีรายการใหม่เข้ามาใน All Projects List และยัง **รอพิจารณา** (คอลัมน์ `RequestStatus` ว่าง)

> ทำไมใช้ Power Automate ไม่ใช่โค้ดในเว็บ:
> - เว็บ 9D เก็บรายชื่อผู้อนุมัติเป็น **SHA-256 ของอีเมล** (repo เป็น public จึงไม่เก็บอีเมลจริง) — ส่งเมลตรงจากเว็บจึงไม่เหมาะ
> - flow ทำงาน **แม้ไม่มีใครเปิดเว็บ** และเก็บอีเมลผู้อนุมัติไว้ในฝั่ง flow เท่านั้น
> - เว็บ 9D มี flow "9D Teams hashtag sync" อยู่แล้ว ใช้รูปแบบเดียวกันได้

## สิ่งที่ต้องมี
- บัญชี Microsoft 365 ที่เข้าถึง SharePoint ไซต์ `ninedistribution.sharepoint.com/sites/KendoProject` และ List **All Projects**
- อีเมลจริงของผู้มีสิทธิ์อนุมัติ (ปัจจุบัน 4 คนตาม `approverHashes` ในเว็บ — เก็บไว้ในตัวแปรของ flow เท่านั้น)

## ขั้นตอนสร้าง flow

### 1. สร้าง flow แบบ Automated
- ไป https://make.powerautomate.com → **Create** → **Automated cloud flow**
- ตั้งชื่อ เช่น `9D Approval Request Email`
- Trigger: **When an item is created** (SharePoint)
  - Site Address: ไซต์ KendoProject
  - List Name: **All Projects**

### 2. เงื่อนไข: เฉพาะรายการที่ "รอพิจารณา"
เพิ่ม **Condition** หลัง trigger:
- `RequestStatus` **is equal to** (ค่าว่าง)  — ปล่อยช่องขวาว่างไว้

> หมายเหตุ: `RequestStatus` เป็นคอลัมน์ Choice ที่มีค่า Approved / Reject / (ว่าง = รอพิจารณา) เว็บ 9D เขียนค่านี้ตอนอนุมัติ/ไม่อนุมัติ รายการที่เพิ่งยื่นจะยังว่าง

ใส่สเต็ปถัดไปในกิ่ง **If yes**

### 3. (แนะนำ) กันแจ้งซ้ำ
ให้แจ้งเฉพาะรายการที่มี Project Code (ช่องรหัสโครงการไม่ว่าง) เพื่อข้ามรายการร่าง — เพิ่มเงื่อนไข AND: `Title`/`Project Code` **is not equal to** ว่าง

### 4. ส่งอีเมลหาผู้อนุมัติ — **Send an email (V2)** (Office 365 Outlook)
- **To:** ใส่อีเมลผู้อนุมัติทั้งหมด คั่นด้วย `;`
  (เก็บไว้ในสเต็ป **Initialize variable** `approverEmails` ชนิด String ที่ต้นฟลว์ แล้วอ้างอิง — แก้ที่เดียวเมื่อเปลี่ยนผู้อนุมัติ)
- **Subject:** `มีคำขออนุมัติโครงการใหม่: @{triggerOutputs()?['body/Title']}`
- **Body:** (HTML)
  ```
  มีคำขออนุมัติโครงการใหม่รอพิจารณา

  Project Code: @{triggerOutputs()?['body/Title']}
  ชื่องาน: @{triggerOutputs()?['body/ชื่อคอลัมน์ชื่องาน']}
  ลูกค้า: @{triggerOutputs()?['body/ชื่อคอลัมน์ลูกค้า']}
  เซลส์ผู้ยื่น: @{triggerOutputs()?['body/Author/DisplayName']}
  ยื่นเมื่อ: @{triggerOutputs()?['body/Created']}

  เปิดพิจารณาในเว็บ 9D: https://satittc-oss.github.io/9d-ops/  (หน้า "รออนุมัติ")
  เปิดใน SharePoint: @{triggerOutputs()?['body/{Link}']}
  ```
  > ชื่อ dynamic content ของคอลัมน์ไทย (ชื่องาน/ลูกค้า) ให้เลือกจากรายการที่ Power Automate แสดง — internal name อาจเป็นรหัส เลือกจากช่อง dynamic content ให้ตรงหัวข้อ

### 5. บันทึกและทดสอบ
- **Save** แล้วกด **Test** → **Manually** → สร้างรายการทดสอบใน All Projects (RequestStatus ว่าง) → ตรวจว่าอีเมลถึงผู้อนุมัติ
- ลบรายการทดสอบออก

## ข้อควรระวัง
- **อย่า** ใส่อีเมลผู้อนุมัติลงใน repo/โค้ดเว็บ — เก็บในตัวแปรของ flow เท่านั้น
- flow นี้ **ไม่แก้** ข้อมูลใด ๆ ใน List แค่ส่งอีเมลอ่านอย่างเดียว
- ถ้าต้องการแจ้งซ้ำเมื่อยังไม่มีใครอนุมัติเกิน N วัน ให้เพิ่ม flow แบบ Scheduled แยก (Get items ที่ RequestStatus ว่าง + Created เกิน N วัน → ส่งอีเมลเตือน)
- ปรับรายชื่อผู้อนุมัติให้ตรงกับ `approverHashes` ในเว็บเสมอ (เว็บใช้ hash ตรวจสิทธิ์อนุมัติ · flow ใช้อีเมลจริงส่งเมล)
