# Business Model — Affiliate Deal Aggregator

## Mô hình kinh doanh

**Tên mô hình**: Hybrid Deal Aggregator + Multi-Channel Distribution  
**Nguồn doanh thu**: Hoa hồng affiliate từ AccessTrade, Shopee Affiliate (3–15% mỗi đơn)  
**Mục tiêu**: Hệ thống tự động lấy deal tốt → phân phối đa kênh → user click mua → nhận hoa hồng

---

## Nguồn sản phẩm

| Nguồn | Loại | Ưu tiên |
|---|---|---|
| AccessTrade API | API chính thức, nhiều merchant | ✅ Ưu tiên số 1 |
| Shopee Affiliate | Product feed CSV/XML | ✅ Bổ sung |
| Lazada Affiliate | API | Sau này |

**Lý do chọn AccessTrade làm ưu tiên**: Một API duy nhất, nhiều merchant, hợp lệ ToS, không rủi ro bị khóa tài khoản.

---

## Kênh phân phối (3 tầng)

### Tầng 1 — Tự động 100% (Website + SEO)
- Trang sản phẩm tự sinh, tự submit sitemap Google
- SEO theo tên sản phẩm cụ thể + từ khóa "mua ở đâu", "giá rẻ"
- Kết quả: traffic passive, tăng dần theo tháng 3–6

### Tầng 2 — Bán tự động (Zalo OA)
- Hệ thống tự chọn top 5 deal/ngày, tự tạo ảnh + nội dung
- Người vận hành chỉ cần approve/lên lịch gửi
- Chi phí: ~1 triệu/tháng khi dùng API broadcast
- Phù hợp: user 30–45 tuổi, mua sắm thực dụng

### Tầng 3 — Có hỗ trợ tool (Facebook Group)
- Hệ thống tạo sẵn nội dung + ảnh đẹp cho từng deal
- Người/cộng tác viên copy-paste lên Group: 20–30 phút/ngày
- Không cần nghĩ content — hệ thống generate sẵn

---

## Cấu trúc ngách (có thể mở rộng)

Mỗi ngách là 1 config độc lập, dùng chung backend:

```
Ngách 1: Thời trang (ra mắt tháng 1)
Ngách 2: Điện tử (thêm tháng 3–4)
Ngách 3: Mẹ & Bé (thêm tháng 6)
...
```

Thêm ngách mới = thêm config file, không cần sửa code.

---

## Dự báo thu nhập

| Giai đoạn | Thời gian | Subscriber | Click/ngày | Hoa hồng/tháng |
|---|---|---|---|---|
| Khởi động | Tháng 1–2 | 500–2k | 50–200 | 500k–2tr |
| Tăng trưởng | Tháng 3–6 | 5k–20k | 500–2k | 5–20tr |
| Scale | Tháng 6–12 | 50k+ | 5k+ | 50tr+ |

*Giả định: conversion rate 2–5%, hoa hồng trung bình 5–8%*

---

## Lợi thế cạnh tranh

- Không làm tay từng sản phẩm — hoàn toàn tự động phần data
- Cấu hình theo ngách — scale dễ dàng
- Phân phối đa kênh — không phụ thuộc 1 nguồn traffic
- Deal có bộ lọc chất lượng (giảm ≥30%, flash sale) → conversion cao hơn
