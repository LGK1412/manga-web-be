# MangaWord - Backend API

Hệ thống quản lý và cung cấp nội dung truyện trực tuyến, tích hợp AI và thanh toán trực tuyến.

## 🚀 Tính năng chính
- **Quản lý nội dung:** CRUD Truyện, Chương, Thể loại và Tác giả.
- **Hệ thống Auth:** Authentication & Authorization chặt chẽ.
- **Real-time:** Bình luận và phản hồi tức thời qua Socket.IO.
- **AI Integration:** Phân tích nội dung hoặc hỗ trợ tìm kiếm bằng Google Gemini.
- **Thanh toán:** Tích hợp cổng thanh toán VNPAY.
- **Thông báo:** Gửi mail (SMTP) và thông báo đẩy qua Firebase.

## 🛠 Tech Stack
- **Framework:** NestJS
- **Database:** MongoDB
- **Real-time:** Socket.IO
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
