# Roadmap — Lộ trình thực hiện
*Last updated: 2026-09-10*

> Trạng thái chi tiết từng tính năng → xem [Implementation Status](../technical/implementation-status.md)

---

## Tháng 1 — Nền tảng

**Mục tiêu**: Hệ thống chạy được, có deal đầu tiên, test thị trường

- [x] Build backend: sync deal tự động từ AccessTrade + Shopee *(done)*
- [x] Database: schema sản phẩm, lịch sử giá, coupon *(done)*
- [x] Website: hiển thị deal theo ngách *(done — shopby base)*
- [x] Biểu đồ lịch sử giá 30 ngày (SVG, lazy load) *(done)*
- [x] Trang mã giảm giá theo ngách `/ma-giam-gia` *(done — platform tabs, flash sale, reveal-on-click, filter sidebar)*
- [x] Coupon sync tự động 2x/ngày *(done — AccessTrade + Shopee + Tiki + Lazada; click tracking; admin CRUD)*
- [ ] **Đăng ký AccessTrade API key** ← việc cần làm ngay
- [ ] **Đăng ký Shopee Affiliate** ← việc cần làm ngay
- [ ] Chạy migration + sync data thật lên DB
- [ ] Bắt đầu post Facebook thủ công để test phản hồi
- [ ] Tạo Zalo OA

---

## Tháng 2 — Kênh phân phối & Tracking

**Mục tiêu**: Đo được hiệu quả từng kênh, phân phối tự động

- [x] **Click tracking** — route `/api/affiliate/redirect/[id]` + bảng `ClickLog` *(done)*
- [x] **Sitemap tự động** — Google index sản phẩm *(done)*
- [x] **Trang `/[niche]`** — SEO theo từng ngách *(done)*
- [x] Zalo OA API: broadcast tự động top 5 deal 9h sáng *(done)*
- [x] Auto-generate ảnh deal — Pollinations.ai (URL-based, miễn phí) *(done)*
- [x] Dashboard nội bộ: click theo kênh, deal hiệu quả *(done — `/admin/analytics`, `/admin/niches`)*
- [x] **AI Blog writer** — tự động viết bài theo ngách *(done — `/admin/blog`)*
- [x] **AI SEO meta** — generate title/description cho ngách + so sánh *(done — `/admin/seo`)*
- [x] **AI Post generator** — 3 variants/sản phẩm cho Facebook/Zalo *(done)*
- [x] **Price Drop Prediction** — phân tích pattern giá theo ngày trong tuần *(done — `/admin/price-prediction`)*
- [x] **Embedding-based matching** — cosine similarity qua OpenAI/Gemini *(done — `/admin/embeddings`)*

---

## Tháng 3–4 — Thêm ngách thứ 2

**Mục tiêu**: Validate hệ thống scale theo ngách (chỉ thêm config)

- [ ] Activate ngách thứ 2 trong `config/niches.yaml` (status: active)
- [ ] Tạo kênh phân phối riêng cho ngách mới
- [ ] So sánh hiệu quả giữa các ngách → ưu tiên ngách tốt hơn

---

## Tháng 5–6 — Tối ưu & Scale

**Mục tiêu**: Thu nhập consistent, hệ thống ổn định

- [ ] Thuê CTV post Facebook nếu cần
- [ ] Thêm ngách thứ 3
- [ ] TikTok: thử nghiệm video review deal
- [ ] Tối ưu conversion: A/B test nội dung, thời điểm post
- [ ] Theo dõi hoa hồng theo ngách → phân bổ effort hợp lý

---

## KPIs theo dõi hàng tuần

| Metric | Mục tiêu tháng 2 | Mục tiêu tháng 6 |
|---|---|---|
| Deal sync/ngày | 50+ | 500+ |
| Click affiliate/ngày | 100+ | 2,000+ |
| Subscriber Zalo OA | 500+ | 10,000+ |
| Hoa hồng/tháng | 1 triệu+ | 20 triệu+ |
