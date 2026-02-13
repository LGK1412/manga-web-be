# MangaWord - Backend API

Hệ thống quản lý và cung cấp nội dung truyện trực tuyến, tích hợp AI và thanh toán trực tuyến.

## 🚀 Tính năng chính
- [cite_start]**Quản lý nội dung:** CRUD Truyện, Chương, Thể loại và Tác giả. [cite: 1, 9]
- [cite_start]**Hệ thống Auth:** Authentication & Authorization chặt chẽ. [cite: 15]
- [cite_start]**Real-time:** Bình luận và phản hồi tức thời qua Socket.IO. [cite: 16]
- **AI Integration:** Phân tích nội dung hoặc hỗ trợ tìm kiếm bằng Google Gemini.
- **Thanh toán:** Tích hợp cổng thanh toán VNPAY.
- [cite_start]**Thông báo:** Gửi mail (SMTP) và thông báo đẩy qua Firebase. [cite: 17]

## 🛠 Tech Stack
- [cite_start]**Framework:** NestJS [cite: 18]
- [cite_start]**Database:** MongoDB [cite: 18]
- [cite_start]**Real-time:** Socket.IO [cite: 18]
- **Khác:** JWT, Firebase Admin SDK, VNPAY SDK.

## ⚙️ Cấu hình Environment (.env)
```env
PORT=3000
DATABASE_URL=
JWT_SECRET=
CLIENT_URL=
SMTP_USER=
SMTP_PASS=
GOOGLE_CLIENT_ID=
VNP_TMNCODE=
VNP_HASHSECRET=
VNP_URL=
VNP_RETURNURL=
GEMINI_API_KEY=
GEMINI_MODEL=
PROJECT_ID=
PRIVATE_KEY=
CLIENT_EMAIL=
