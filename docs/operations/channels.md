# Vận hành kênh phân phối

## Tổng quan

| Kênh | Tự động hóa | Effort/ngày | Traffic tiềm năng |
|---|---|---|---|
| Website (SEO) | 100% tự động | 0 | Cao, chậm (3–6 tháng) |
| Zalo OA | Bán tự động | 5 phút | Trung bình, ổn định |
| Facebook Group | Có hỗ trợ tool | 20–30 phút | Cao, nhanh |

---

## Website / SEO

- Mỗi sản phẩm có trang riêng với URL chuẩn SEO: `/san-pham/ten-san-pham-slug`
- Meta title/description tự generate từ data sản phẩm
- Sitemap XML tự cập nhật, submit Google Search Console
- Schema markup (Product, Offer) để Google hiểu giá, deal
- **Không cần làm gì thêm** — cron job lo hết

---

## Zalo OA

### Setup
1. Tạo Zalo Official Account tại oa.zalo.me
2. Đăng ký gói API (khoảng 1 triệu/tháng)
3. Kết nối API key vào hệ thống

### Vận hành hàng ngày
- 8h30 sáng: hệ thống tự chọn top 5 deal tốt nhất, tạo ảnh + nội dung
- Người vận hành xem qua, approve (hoặc cài auto-send thẳng)
- 9h00: broadcast tự động đến tất cả subscriber

### Kéo subscriber
- Đăng link Zalo OA lên Facebook Group khi post deal
- Thêm QR code vào website
- Khuyến khích follow để nhận deal sớm nhất

---

## Facebook Group

### Chiến lược
- Không spam link — đăng deal kèm **ngữ cảnh**: "Mình vừa thấy cái này giảm 40%, hợp lý lắm"
- Tham gia group người khác trước, xây trust, rồi mới đăng deal
- Hoặc tự lập group riêng: "Săn deal [Tên ngách] mỗi ngày"

### Quy trình hàng ngày (20–30 phút)
1. Mở dashboard nội bộ → xem danh sách deal được generate sẵn
2. Chọn 3–5 deal phù hợp với group đó
3. Copy nội dung + ảnh đã chuẩn bị sẵn → paste lên group
4. Trả lời comment nếu có

### Lưu ý quan trọng
- **Không dùng tool auto-post** — Facebook phát hiện và khóa tài khoản
- Mỗi tài khoản chỉ post vào 3–5 group/ngày để tránh bị hạn chế
- Nếu scale lên cần nhiều tài khoản → thuê cộng tác viên

---

## TikTok (giai đoạn sau)

- Tạo video ngắn: "Top 5 deal hôm nay" (30–60 giây)
- Link affiliate đặt ở bio hoặc TikTok Shop
- Cần 1 người làm video — không tự động hóa hoàn toàn được
- Tiềm năng viral rất cao nếu nội dung tốt
