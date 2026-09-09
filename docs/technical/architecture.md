# Kiến trúc hệ thống

## Sơ đồ tổng thể

```
[AccessTrade API / Shopee Feed]
        ↓ Cron job mỗi 4h
[Data Pipeline]
├── Fetch sản phẩm/deal mới
├── Filter: giảm ≥30%, flash sale, giá thấp nhất 30 ngày
├── Download & host ảnh (tránh hotlink bị block)
├── Generate nội dung post (template-based)
└── Lưu vào PostgreSQL

[PostgreSQL Database]
├── products        — sản phẩm + metadata
├── deals           — deal hiện tại, giá gốc vs giá sale
├── price_history   — lịch sử giá để tính "thấp nhất X ngày"
├── niches          — cấu hình ngách
└── post_logs       — lịch sử post lên các kênh

[Backend API — Node.js]
├── /api/deals?niche=fashion     — feed deal cho website
├── /api/deals/top?limit=5       — top deal ngày cho Zalo OA
└── /api/affiliate/redirect/:id  — tracking click, redirect link

[Website — Next.js]
├── Trang chủ: deal nổi bật
├── /[niche]: trang theo ngách
├── /san-pham/[slug]: trang sản phẩm (SEO)
└── Sitemap tự động

[Distribution Layer]
├── Zalo OA API → broadcast tự động 9h sáng
├── Content generator → tạo sẵn nội dung cho Facebook
└── (Tương lai) TikTok API
```

---

## Data flow chi tiết

### Sync sản phẩm
```
AccessTrade API
    → Fetch danh sách merchant + sản phẩm
    → Filter theo ngách (category ID)
    → Upsert vào bảng products
    → Update bảng price_history
    → Tính toán deal tốt → insert vào bảng deals
    → Trigger generate content job
```

### User click affiliate
```
User click trên website/Zalo/Facebook
    → /api/affiliate/redirect/:dealId
    → Log click (dealId, source, timestamp)
    → Redirect đến link affiliate trên AccessTrade
    → AccessTrade tracking → hoa hồng
```

---

## Nguyên tắc thiết kế

- **Config-driven**: thêm ngách mới = thêm 1 record vào bảng niches, không sửa code
- **Stateless API**: backend không giữ session, dễ scale horizontal
- **Idempotent sync**: chạy cron nhiều lần không bị duplicate data
- **Click tracking**: mọi redirect đều qua hệ thống để đo hiệu quả từng kênh
