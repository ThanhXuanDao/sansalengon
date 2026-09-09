# Tech Stack

## Lựa chọn công nghệ

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Backend API | Node.js (Express/Fastify) | Async I/O tốt cho gọi API, ecosystem lớn |
| Website | Next.js | SSG/SSR linh hoạt, SEO tốt, deploy dễ |
| Database | PostgreSQL | Quan hệ rõ ràng, query phức tạp được, miễn phí |
| Job scheduler | BullMQ (Redis-backed) | Queue cron job, retry tự động, monitor được |
| Image processing | Sharp (Node.js) | Download + resize ảnh sản phẩm |
| Content generation | Template engine (Handlebars) | Tạo nội dung post từ data deal |
| Hosting | VPS (Ubuntu) | Kiểm soát hoàn toàn, giá thấp |

## Hosting ước tính

| Dịch vụ | Nhà cung cấp gợi ý | Chi phí/tháng |
|---|---|---|
| VPS (2 vCPU, 4GB RAM) | Vultr / DigitalOcean / Linode | $12–20 (~300–500k) |
| Domain .com | Namecheap | ~$10/năm |
| Object storage (ảnh) | Cloudflare R2 | Miễn phí đến 10GB |
| Redis (BullMQ) | Upstash hoặc self-host | Miễn phí tier / $0 |

**Tổng chi phí kỹ thuật**: ~300–500k/tháng giai đoạn đầu

---

## Cấu trúc thư mục dự án

```
affiliate/
├── apps/
│   ├── api/          — Backend Node.js
│   └── web/          — Next.js website
├── packages/
│   ├── db/           — Schema PostgreSQL, migrations
│   ├── sync/         — Logic fetch AccessTrade, Shopee
│   └── content/      — Template generate nội dung
├── config/
│   └── niches.yaml   — Cấu hình ngách
└── docs/             — Tài liệu này
```

---

## Môi trường

```env
# .env
ACCESSTRADE_API_KEY=xxx
SHOPEE_AFFILIATE_KEY=xxx
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ZALO_OA_ACCESS_TOKEN=xxx
STORAGE_BUCKET=xxx
```
