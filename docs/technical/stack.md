# Tech Stack
*Last updated: 2026-09-10*

## Lựa chọn công nghệ (thực tế đang dùng)

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Backend API | **NestJS** (Node.js) | Dependency injection, cron built-in (`@nestjs/schedule`), module rõ ràng |
| Website | **Next.js 15** (App Router) | SSR/SSG linh hoạt, SEO tốt, React Server Components |
| Database | **PostgreSQL** | Quan hệ rõ ràng, query phức tạp, free |
| ORM | **Prisma** | Type-safe, schema single source of truth, Prisma Studio |
| Job scheduling | **`@nestjs/schedule`** | Built-in cron — không cần Redis/BullMQ |
| AI (text) | **Multi-provider**: Gemini / DeepSeek / OpenAI / Claude | Per-task, switch runtime, không restart |
| AI (embedding) | **OpenAI** `text-embedding-3-small` (1536d) hoặc **Gemini** `text-embedding-004` (768d) | Cosine sim trong TypeScript, không cần pgvector |
| AI (image) | **Pollinations.ai** (free) / **DALL-E 3** / **Stability AI** | URL-based, không cần upload |
| Styling | **Tailwind CSS** | Utility-first, consistent design system |
| Language | **TypeScript** | Full-stack type safety |

## Hosting ước tính

| Dịch vụ | Nhà cung cấp gợi ý | Chi phí/tháng |
|---|---|---|
| VPS (2 vCPU, 4GB RAM) | Vultr / DigitalOcean / Railway | ~300–500k |
| Domain .com | Namecheap / Google Domains | ~20k (trung bình/tháng) |
| Object storage (ảnh) | Cloudflare R2 | Free đến 10GB |
| **Tổng kỹ thuật** | | **~350–550k/tháng** |

> Không cần Redis — cron dùng `@nestjs/schedule` built-in. Không cần BullMQ.

---

## Chi phí AI (ước tính)

| Provider | Task | Chi phí |
|---|---|---|
| **Gemini Flash** | Post gen, blog, SEO, sentiment, auto-classify | **Miễn phí** đến 1M tokens/ngày |
| **DeepSeek Chat** | Fallback cho Gemini | ~$0.14/1M tokens |
| **OpenAI** `text-embedding-3-small` | Embedding matching | $0.02/1M tokens |
| **OpenAI** `gpt-4o-mini` | Post gen / blog | $0.15/1M tokens |
| **Claude Haiku** | Post gen / blog (quality mode) | $0.80/1M tokens |
| **DALL-E 3** | Deal image gen | $0.04/image |

**Khuyên dùng:** Gemini Flash làm primary → gần như không tốn tiền AI. OpenAI key chỉ cần nếu muốn embedding matching.

---

## Cấu trúc thư mục dự án

```
Affiliate/
├── src/
│   ├── apps/
│   │   ├── api/                  — NestJS backend (port 4000)
│   │   │   ├── src/
│   │   │   │   ├── sync/         — Deal sync, Coupon sync (Cron)
│   │   │   │   ├── distribute/   — Zalo broadcast, Content gen
│   │   │   │   ├── affiliate/    — Shopee GraphQL, AccessTrade REST
│   │   │   │   └── platforms/    — Adapters (Shopee/Lazada/Tiki) + Matcher + Embedding
│   │   │   └── package.json
│   │   └── web/                  — Next.js 15 (port 3000)
│   │       ├── src/
│   │       │   ├── app/          — App Router pages + API routes
│   │       │   ├── components/   — Shared UI (ProductCard, CouponCard, etc.)
│   │       │   └── lib/          — AI providers, utils, Prisma client
│   │       ├── prisma/
│   │       │   ├── schema.prisma — Source of truth schema
│   │       │   └── schema.sql    — DDL để tạo DB từ đầu
│   │       └── package.json
│   └── .env                      — Copy từ .env.example
└── docs/                         — Tài liệu này
```

---

## Biến môi trường đầy đủ

```env
# === BẮT BUỘC ===
DATABASE_URL=                       # PostgreSQL connection string
NEXT_PUBLIC_SITE_URL=               # URL website (không có / ở cuối)
WEB_URL=                            # URL Next.js từ NestJS (thường giống trên)

# === DATA SOURCES (cần ít nhất 1) ===
ACCESSTRADE_ACCESS_KEY=             # Deal + coupon từ AccessTrade
ACCESSTRADE_BASE_URL=https://api.accesstrade.vn/v1
ACCESSTRADE_REGION=VN
SHOPEE_AFFILIATE_APP_ID=            # Deal từ Shopee Affiliate GraphQL
SHOPEE_AFFILIATE_APP_SECRET=

# === COUPON SYNC — CÁC SÀN (đều tùy chọn) ===
SHOPEE_AFFILIATE_API_KEY=           # Voucher từ Shopee Affiliate API (bearer token)
TIKI_AFFILIATE_API_KEY=             # Voucher từ Tiki Affiliate API
LAZADA_AFFILIATE_API_KEY=           # Voucher từ Lazada Affiliate API

# === SO SÁNH ĐA SÀN — LAZADA (tùy chọn) ===
LAZADA_APP_KEY=                     # Lazada Open Platform — product search
LAZADA_APP_SECRET=

# === AI PROVIDERS (tất cả tùy chọn — chọn 1 hoặc nhiều) ===
GOOGLE_AI_API_KEY=                  # Gemini Flash — KHUYÊN DÙNG (free 1M tokens/ngày)
DEEPSEEK_API_KEY=                   # DeepSeek Chat — cực rẻ ($0.14/1M)
OPENAI_API_KEY=                     # GPT-4o mini + DALL-E + text-embedding-3-small
ANTHROPIC_API_KEY=                  # Claude Haiku/Sonnet — quality cao nhất
STABILITY_API_KEY=                  # Stability AI SDXL — $0.01/image

# === ZALO OA (tùy chọn) ===
ZALO_OA_ACCESS_TOKEN=               # Seed lần đầu vào DB, có thể xóa sau
ZALO_OA_REFRESH_TOKEN=
ZALO_OA_APP_ID=
ZALO_OA_APP_SECRET=

# === APP CONFIG ===
PORT=4000                           # NestJS port
NODE_ENV=development
```
