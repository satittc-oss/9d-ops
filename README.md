# 9d-ops
9D Integrated Operations - Nine Distribution (Microsoft 365 sign-in required)

## ออกเวอร์ชันใหม่
เมื่อเปลี่ยน `M_VER` ใน `index.html` ให้แก้ `version.json` เป็นเลขเดียวกันเสมอ — หน้าเว็บที่เปิดค้างไว้ใช้ไฟล์นี้เช็คว่ามีเวอร์ชันใหม่
ถ้าแก้ไอคอนหรือ manifest ให้เปลี่ยนชื่อ cache (`C`) ใน `sw.js` ด้วย

## หน้าเมืองจำลอง (v16.14)
`city.html` คือฉาก 3 มิติ (ฝังในเมนู "เมืองจำลอง" ผ่าน iframe `city.html?embed=1`) และใช้ `vendor/three.r128.min.js` (three.js r128, MIT) — ตอนนี้ยังใช้ข้อมูลจำลอง ยังไม่ผูกกับโครงการจริง
