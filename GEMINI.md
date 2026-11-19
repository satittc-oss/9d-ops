# GEMINI.md — 9D Integrated Operations (9d-ops)

Gemini: อ่าน **[AGENTS.md](AGENTS.md)** ให้จบก่อนแก้อะไร — เป็นคู่มือหลักของ repo นี้ (กติกา, โครงสร้างข้อมูล SharePoint, การทดสอบ, การ deploy, งานค้าง)

สรุปสั้นที่สุด:
- แอปทั้งตัวอยู่ใน `index.html` ไฟล์เดียว ไม่มี build step · เว็บจริง https://satittc-oss.github.io/9d-ops/ (GitHub Pages จาก `main`)
- ห้ามแก้ข้อมูลจริง/สิทธิ์/โครงสร้าง List ใน SharePoint หรือโพสต์/ลบใน Teams ระหว่างพัฒนา · ห้าม commit อีเมลพนักงาน, token, รหัสผ่าน (repo เป็น public)
- ทุก release: `M_VER` + `version.json` + README + `node --test tests/*.test.cjs` ต้องผ่านครบ (290 ข้อ ณ v16.76)
- ตอบเจ้าของเป็นภาษาไทยเสมอ
