# Kiến trúc hệ thống
*Last updated: 2026-09-10*

## Sơ đồ tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                   DATA SOURCES (external)                   │
│  AccessTrade API  ·  Shopee Affiliate  ·  Lazada  ·  Tiki  │
└────────────────────────┬────────────────────────────────────┘
                         │ Cron sync (NestJS)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND — NestJS (apps/api, port 4000)         │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Sync Services   │  │   Distribution Services           │ │
│  │  ├ DealSync (4h) │  │  ├ ZaloBroadcast (9h daily)      │ │
│  │  ├ CouponSync    │  │  ├ ContentGenerator               │ │
│  │  │  (6h + 18h)   │  │  └ ZaloTokenService (Mon 7h)     │ │
│  │  └ PriceHistory  │  └──────────────────────────────────┘ │
│  └──────────────────┘                                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Platform Matching (multi-sàn)                       │   │
│  │  ├ PlatformAdapters: Shopee / Lazada / Tiki          │   │
│  │  ├ ProductMatcherService (cron 2h sáng)              │   │
│  │  │  → embedding×0.50 + tokenOverlap×0.35 + edit×0.15│   │
│  │  ├ PlatformSyncService (giá 4h, confirm/reject)      │   │
│  │  └ EmbeddingService (cron Chủ nhật 3h)               │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL Database                          │
│  Product · PriceHistory · PlatformProduct · ProductMatch   │
│  Coupon · ClickLog · BroadcastLog · AppSetting             │
│  Feedback · ProductEmbedding · Platform · Category         │
└────────────────────────┬────────────────────────────────────┘
                         │ Prisma ORM
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           FRONTEND — Next.js 15 (apps/web, port 3000)       │
│                                                             │
│  Public (SEO)                  Admin Dashboard              │
│  ├ / — trang chủ deal          ├ /admin — overview          │
│  ├ /[niche] — ngách            ├ /admin/products            │
│  ├ /[niche]/blog/[slug]        ├ /admin/analytics           │
│  ├ /[niche]/compare/[slug]     ├ /admin/coupons ← NEW      │
│  └ /ma-giam-gia — vouchers     ├ /admin/embeddings          │
│    (platform tabs, flash sale) ├ /admin/auto-classify       │
│                                ├ /admin/ai-config           │
│                                ├ /admin/blog / seo          │
│                                ├ /admin/zalo / broadcast    │
│                                └ /admin/matches             │
│                                                             │
│  AI Features (lib/)            Click Tracking               │
│  ├ ai-provider.ts (multi)      ├ /api/click                 │
│  ├ sentiment-classifier.ts     └ /api/affiliate/redirect    │
│  ├ auto-classifier.ts                                       │
│  └ price-prediction.ts                                      │
└─────────────────────────────────────────────────────────────┘

                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              AI PROVIDERS (multi-provider, per-task)         │
│  Gemini Flash (free) · DeepSeek (rẻ) · Claude · OpenAI     │
│  Cấu hình qua Admin → AI Config — không cần restart        │
└─────────────────────────────────────────────────────────────┘

                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              DISTRIBUTION CHANNELS                           │
│  Zalo OA (broadcast tự động 9h) · Facebook (content ready) │
│  Website SEO (sitemap, schema.org) · Trang coupon           │
└─────────────────────────────────────────────────────────────┘
```

---

## Data flow chi tiết

### Sync sản phẩm (Deal Sync — mỗi 4h)

```
AccessTrade API + Shopee Affiliate GraphQL
    → Fetch danh sách sản phẩm theo campaign/ngách
    → Upsert vào bảng Product
    → Ghi PriceHistory nếu giá thay đổi
    → Prune records > 90 ngày
    → Cron matching 2h sáng: tìm sản phẩm tương đương trên Lazada/Tiki
```

### Sync coupon (mỗi 6h và 18h)

```
AccessTrade /v1/vouchers + Shopee Affiliate API + Tiki API + Lazada API
    → Deactivate coupon hết hạn
    → Upsert coupon mới (key: composite merchant+code+source)
    → Set platform field (shopee/tiki/lazada/null)
    → Admin trigger thủ công qua /admin/coupons → Sync ngay
```

### User click affiliate link

```
User nhấn "Lấy mã" trên CouponCard
    → POST /api/coupons/[id]/click (fire-and-forget increment clickCount)
    → Mở affiliateUrl trong tab mới

User click "Mua ngay" trên ProductCard
    → POST /api/click (log ClickLog với source)
    → GET /api/affiliate/redirect/[id]?src=website|zalo|facebook
    → Log ClickLog → 302 redirect đến affiliate link
```

### AI pipeline (fire-and-forget)

```
Feedback saved → POST /api/feedback
    → Prisma create (sync, trả về 200 ngay)
    → classifySentiment() fire-and-forget
    → Prisma update { sentiment, sentimentScore }

Sản phẩm mới → /admin/auto-classify
    → classifyProduct() → AI zero-shot
    → Admin xem + nhấn "Áp dụng" → PATCH category
```

### Embedding matching flow

```
EmbeddingService (weekly cron Chủ nhật 3h)
    → embedMissing() → generate vector cho sản phẩm chưa có
    → Upsert ProductEmbedding (JSON float array)

ProductMatcherService (cron matching 2h sáng)
    → Load query embedding (productId) từ ProductEmbedding
    → Generate vectors cho candidates song song
    → Score = cosineSim×0.50 + tokenOverlap×0.35 + editSim×0.15
    → Fallback (không có embedding) = tokenOverlap×0.70 + editSim×0.30
    → Filter confidence > 0.5 → upsert ProductMatch
```

---

## Nguyên tắc thiết kế

- **Config-driven**: thêm ngách mới = thêm entry trong `config/niches.yaml`, không sửa code
- **Multi-provider AI**: mỗi task AI có thể dùng provider khác nhau, switch runtime qua DB (AppSetting)
- **Feature flags**: mỗi AI task có toggle enable/disable riêng → kiểm soát cost
- **Idempotent sync**: chạy cron nhiều lần không duplicate data (upsert by composite key)
- **Fire-and-forget**: sentiment, click count — không block HTTP response
- **Graceful degradation**: thiếu API key → skip nhẹ nhàng, không crash (Shopee/Tiki/Lazada coupon sync)
- **Click tracking**: mọi redirect qua hệ thống → đo hiệu quả từng kênh (website/zalo/facebook/direct)
- **Schema only**: không dùng Prisma migrations — sửa trực tiếp `schema.prisma` + `schema.sql`
