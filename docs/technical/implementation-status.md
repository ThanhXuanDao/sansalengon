# Implementation Status
*Last updated: 2026-09-13 (Sync Jobs UI + SyncController HTTP endpoints + AccessTrade auto-discovery)*

Tài liệu này là nguồn sự thật về những gì đã/chưa implement. Cập nhật mỗi khi hoàn thành tính năng mới.

---

## ✅ Đã implement

### Backend — NestJS (`apps/api`)

| Tính năng | File | Ghi chú |
|---|---|---|
| Deal sync cron (mỗi 4h) | `src/sync/deal-sync.service.ts` | Upsert sản phẩm từ **Shopee** + **AccessTrade** + **Tiki** + **Lazada** (enabled per-niche qua Admin → Cấu hình nguồn); auto-match AT campaign, fetch offers, tạo tracking link |
| AccessTrade campaign auto-discovery | `src/sync/deal-sync.service.ts` | `resolveCampaignIds()`: nếu `campaign_ids` trống → `listCampaigns(approved)` → filter theo `campaign_keywords` / niche name. Cache 4h. |
| Batch price history recording | `src/sync/deal-sync.service.ts` | Ghi khi giá thay đổi, dùng DISTINCT ON tránh N+1 |
| Price history pruning (90 ngày) | `src/sync/deal-sync.service.ts` | Xóa records > 90 ngày sau mỗi sync |
| SyncController HTTP endpoints | `src/sync/sync.controller.ts` | `POST /sync/deals`, `/sync/coupons`, `/sync/platform-match` — Bearer token auth (`API_INTERNAL_SECRET`). Gọi `triggerSync()` public method của từng service. |
| Coupon sync cron (6h + 18h) | `src/sync/coupon-sync.service.ts` | AccessTrade + Shopee Affiliate API + Tiki Affiliate API + Lazada Affiliate API; dedup composite key; cần `SHOPEE_AFFILIATE_API_KEY`, `TIKI_AFFILIATE_API_KEY`, `LAZADA_AFFILIATE_API_KEY` |
| Zalo OA broadcast (9h hàng ngày) | `src/distribute/zalo-broadcast.service.ts` | Top 5 deals, score = `discount×0.45 + click×0.30 + rating×0.25`, log DB |
| Zalo token auto-refresh | `src/distribute/zalo-token.service.ts` | Lưu DB, cron thứ Hai 7h, refresh khi ≤14 ngày còn lại |
| Content generator | `src/distribute/content-generator.service.ts` | Digest broadcast + Facebook single post, redirect URL với src |
| Shopee GraphQL client | `src/affiliate/shopee/client.ts` | Circuit breaker, rate limit, retry |
| AccessTrade REST client | `src/affiliate/accesstrade/client.ts` | `listCampaigns`, `createTrackingLink` |
| Platform Adapter interface | `src/platforms/platform.adapter.ts` | Abstract class `PlatformAdapter` — `searchByName`, `fetchPrice`, `fetchProduct` |
| ShopeeAdapter | `src/platforms/shopee/shopee.adapter.ts` | Wrap `ShopeeAffiliateClient.productSearch()` |
| LazadaAdapter | `src/platforms/lazada/lazada.adapter.ts` | Lazada Affiliate API, HMAC-SHA256 signing, cần `LAZADA_APP_KEY`/`LAZADA_APP_SECRET` |
| TikiAdapter | `src/platforms/tiki/tiki.adapter.ts` | Public API `tiki.vn/api/v2`, không cần auth |
| ProductMatcherService | `src/platforms/matcher/product-matcher.service.ts` | Barcode exact (1.0) → khi có embedding: `cosineSim×0.50 + tokenOverlap×0.35 + editSim×0.15`; fallback: `tokenOverlap×0.70 + editSim×0.30`, filter >0.5 |
| PlatformSyncService | `src/platforms/platform-sync.service.ts` | Cron 2h sáng matching, cron mỗi 4h refresh giá; `confirmMatch`, `rejectMatch` |

### Database — Prisma (`apps/web/prisma`)

| Model | Ghi chú |
|---|---|
| `Product` | Sản phẩm affiliate — tên, giá, discountPct, imageUrl, shopeeUrl, rating |
| `Category` | Danh mục khớp với niche ID trong `niches.ts` |
| `PriceHistory` | Lịch sử giá theo ngày, pruning 90 ngày; có thêm `platformId?` để phân biệt sàn |
| `Coupon` | Mã giảm giá theo ngách hoặc universal (nicheId null); có `platform` (shopee/tiki/lazada), `clickCount`, `source` (accesstrade/shopee/tiki/lazada/manual) |
| `ClickLog` | Lượt click có source (website/zalo/facebook/direct) + referer |
| `BroadcastLog` | Lịch sử broadcast Zalo — status, nội dung, productIds JSON |
| `AppSetting` | Key-value store — lưu Zalo token, expiresAt; AI SEO cache (`seo:niche:*`, `seo:compare:*`); AI provider + feature flags (`ai:provider:*`, `ai:feature:*:enabled`) |
| `ProductEmbedding` | Vector embedding cho product name — JSON float array, model name, dims, updatedAt; cascade delete khi Product bị xóa |
| `Platform` | Danh sách sàn (shopee, lazada, tiki, tiktok) — seeded sẵn |
| `PlatformProduct` | Sản phẩm tương đương trên sàn khác — unique (productId, platformId) |
| `ProductMatch` | Kết quả matching tự động/thủ công — status PENDING/CONFIRMED/REJECTED, confidence score |
| `Niche` | Nguồn dữ liệu ngách duy nhất — id, name, emoji, status, shopeeKeywords, atCampaignIds, atKeywords, filters, postPrefix, hashtags, zaloOaId, sortOrder |
| `NicheIntegration` | Per-niche platform config (enabled, atEnabled, directEnabled, directFallback, campaignId) — runtime-configurable qua Admin UI, không cần restart |

### Website — Next.js (`apps/web`)

#### Trang công khai (SEO)

| Tính năng | File(s) | Ưu tiên ban đầu | Ghi chú |
|---|---|---|---|
| Trang chủ deal | `src/app/page.tsx` | Làm ngay | Feed sản phẩm, filter ngách; có MobileBottomNav |
| ProductCard + dual CTA | `src/components/sections/ProductCard.tsx` | Làm ngay | "Mua ngay" + toggle chart + PlatformPriceBar + link so sánh |
| Biểu đồ lịch sử giá | `src/components/sections/PriceHistoryChart.tsx` | Làm ngay | Pure SVG, lazy load, 30 ngày, isLowest badge |
| API price history | `src/app/api/products/[id]/price-history/route.ts` | — | GET đơn sàn + `?platform=all` trả grouped theo platformId |
| Trang mã giảm giá | `src/app/ma-giam-gia/page.tsx` + `CouponPageClient.tsx` | Giai đoạn 2 | Tab ngách, platform tabs (All/Shopee/Tiki/Lazada), filter sidebar (loại/sort), flash sale section (hết hạn <24h countdown), load more |
| CouponCard component | `src/components/coupons/CouponCard.tsx` | — | Receipt-style; platform badge; masked code + reveal-on-click + click tracking; countdown timer cho flash sale; lượt dùng |
| Trang ngách `/[niche]` | `src/app/[niche]/page.tsx` + `NichePageClient.tsx` | Giai đoạn 2 | SSR + ISR 30ph, Schema.org ItemList, breadcrumb, coupon strip; có MobileBottomNav |
| MobileBottomNav | `src/components/layout/MobileBottomNav.tsx` | — | Slides up sau 260px scroll, `lg:hidden fixed bottom-0`, tabs 6 ngách |
| Mobile sticky filter bar | trong `ProductGrid.tsx` | — | `sticky top-[64px] z-30`, sort + category + range chips cuộn ngang |
| Navbar + dropdown danh mục | `src/components/layout/Navbar.tsx` | — | Dropdown → 6 trang ngách, link mã giảm giá |
| Sitemap tự động | `src/app/sitemap.ts` | Giai đoạn 2 | Async, query DB, revalidate 1h |
| robots.txt | `src/app/robots.ts` | — | Block admin + api, link sitemap |
| Niche config shared | `src/lib/niches.ts` | — | Async DB queries (`getActiveNiches`, `getNiche`, `getNicheByCategory`) — không còn hardcode |
| Blog danh sách `/[niche]/blog` | `src/app/[niche]/blog/page.tsx` | Giai đoạn 2 | SSG, danh sách bài MDX, pagination, search |
| Blog bài viết `/[niche]/blog/[slug]` | `src/app/[niche]/blog/[slug]/page.tsx` | Giai đoạn 2 | Hero + gradient overlay, article + sidebar desktop layout, ReadingProgress, MobileArticleBar |
| Trang so sánh `/[niche]/compare/[slug]` | `src/app/[niche]/compare/[slug]/page.tsx` | Giai đoạn 3 | SSG ISR 30ph, hero product + gradient, price table, PriceCompareChart, sidebar desktop, Schema.org Product+Offers |
| PlatformPriceBar | `src/components/compare/PlatformPriceBar.tsx` | Giai đoạn 3 | Client, lazy fetch `/api/products/:id/compare`, platform dots + prices + "Rẻ nhất" badge |
| PriceCompareChart | `src/components/compare/PriceCompareChart.tsx` | Giai đoạn 3 | Client, fetch `?platform=all`, SVG polyline per platform, forward-fill, legend |

#### Admin dashboard (`/admin`)

| Tính năng | File(s) | Ghi chú |
|---|---|---|
| Login + OTP auth | `admin/login/` + `api/admin/` | CSRF, session cookie |
| Dashboard tổng quan | `admin/(dashboard)/page.tsx` | Stats nhanh |
| Quản lý sản phẩm | `admin/(dashboard)/products/` | CRUD, filter, pagination |
| Quản lý danh mục | `admin/(dashboard)/categories/` | — |
| Click Logs | `admin/(dashboard)/click-logs/` | Bảng click, filter ngày, export CSV |
| Analytics tổng hợp | `admin/(dashboard)/analytics/` | Revenue, top products, chart |
| Click theo ngách | `admin/(dashboard)/niches/` + `[niche]/` | Source breakdown bar, top products, drill-down |
| **Quản lý ngách (CRUD)** | `admin/(dashboard)/niches/manage/` + `api/admin/niches/manage/route.ts` + `[id]/route.ts` | Tạo/sửa/xoá ngách, sort order, tất cả fields qua modal form; thay thế hoàn toàn `niches.yaml` + hardcode array |
| Facebook analytics | `admin/(dashboard)/facebook/` | Tab Analytics (click FB + chart + niche) + Tab Tạo nội dung (post generator, copy) |
| Zalo OA analytics | `admin/(dashboard)/zalo/` | Tab Analytics + Tab Broadcasts + Tab 🔑 Token (quản lý token DB-first) |
| Broadcast (Zalo) | `admin/(dashboard)/broadcast/` | Token status, gửi thủ công, lịch sử, xem nội dung |
| Broadcast token API | `api/broadcast/token/route.ts` | GET status, POST force refresh |
| Niche analytics API | `api/admin/niche-analytics/route.ts` | Aggregate clicks per niche + source |
| Facebook analytics API | `api/admin/facebook-analytics/route.ts` | source=facebook, time series, top products |
| Facebook content API | `api/admin/facebook-content/route.ts` | Scored products + generated post text |
| Zalo analytics API | `api/admin/zalo-analytics/route.ts` | source=zalo + BroadcastLog với clicksAfter24h |
| Match review `/admin/matches` | `src/app/admin/matches/page.tsx` | Filter PENDING/CONFIRMED/REJECTED + platform, confirm/reject, manual override form |
| API admin matches | `api/admin/matches/route.ts` + `api/admin/matches/[id]/route.ts` | GET paginated, POST manual override, PATCH confirm/reject |
| **AI: Post generator** | `lib/claude.ts` + `api/admin/facebook-content/route.ts` | Multi-provider, 3 variants/sản phẩm, fallback template, parallel generate |
| **AI: Blog writer** | `lib/blog-generator.ts` + `api/admin/generate-blog/route.ts` + `admin/(dashboard)/blog/` | Multi-provider (quality mode), ghi TSX ra disk, auto-generate cover image, register vào `generated-posts.ts` |
| **AI: SEO Meta** | `lib/seo-generator.ts` + `api/admin/generate-seo/route.ts` + `admin/(dashboard)/seo/` | Multi-provider, cache vào AppSetting; niche meta admin-triggered, compare meta lazy-generate |
| **AI: Multi-provider config** | `lib/ai-provider.ts` + `lib/ai-config.ts` + `lib/image-generator.ts` + `api/admin/ai-config/route.ts` + `admin/(dashboard)/ai-config/` | Claude / DeepSeek / Gemini / OpenAI — per-task selection lưu DB, không restart; image: Pollinations (free) / DALL-E / Stability |
| **Zalo token DB migration** | `api/admin/zalo-token/route.ts` + `admin/(dashboard)/zalo/` → tab Token | GET/POST token vào AppSetting, UI trạng thái màu, form nhập thủ công, không expose token thực |
| **Enhanced Deal Scoring** (AI Plan Tier 1 #3) | `apps/api/src/distribute/zalo-broadcast.service.ts`, `apps/web/src/app/api/admin/facebook-content/route.ts` | Score = `discount×0.45 + click×0.30 + rating×0.25` — thêm rating signal (0–5 scale) |
| **Auto-generate ảnh deal** | `api/admin/facebook-content/route.ts` + `admin/(dashboard)/facebook/page.tsx` | `dealImageUrl` dùng Pollinations.ai (miễn phí, URL-based), hiển thị preview trong tab Tạo nội dung |
| **AI Feature Flags (cost control)** | `lib/ai-config.ts` + `api/admin/ai-config/route.ts` + `admin/(dashboard)/ai-config/page.tsx` | Toggle enable/disable từng AI task trong admin → ngăn API call → kiểm soát cost. Default: all enabled |
| **Embedding-based Product Matching** (AI Plan Tier 2 #4) | `apps/api/src/platforms/matcher/embedding.service.ts` + `apps/web/src/app/api/admin/embeddings/route.ts` + `admin/(dashboard)/embeddings/page.tsx` | OpenAI `text-embedding-3-small` (1536d) hoặc Gemini `text-embedding-004` (768d), auto-detect từ env. Score = `cosineSim×50% + tokenOverlap×35% + editSim×15%`. Weekly cron Chủ nhật 3h. `ProductEmbedding` table lưu JSON vector. Admin page `/admin/embeddings` để trigger + xem coverage |
| **Tiki + Lazada deal sync** | `src/sync/deal-sync.service.ts` + `src/app/api/admin/niche-config/route.ts` + `src/app/admin/(dashboard)/niches/config/page.tsx` | Cách 1 (AT campaign match) → Cách 2 fallback (Tiki public API / Lazada Affiliate API); per-niche config lưu DB (`NicheIntegration`), runtime-configurable. Tiki: không cần auth. Lazada: cần `LAZADA_APP_KEY/SECRET`. |
| **Auto-Classification** (AI Plan Tier 3 #7) | `lib/auto-classifier.ts` + `api/admin/auto-classify/route.ts` + `admin/(dashboard)/auto-classify/page.tsx` | Zero-shot classify sản phẩm vào Category bằng AI, admin page xem + apply gợi ý, batch classify 10–50 sản phẩm. Respects `post_generation` feature flag |
| **Feedback Sentiment** (AI Plan Tier 3 #8) | `lib/sentiment-classifier.ts` + `api/feedback/route.ts` (fire-and-forget) + `admin/(dashboard)/feedback/page.tsx` | Classify feedback → positive/negative/neutral/suggestion, badge màu trong admin. Prisma schema: `sentiment`, `sentimentScore`. Respects `post_generation` feature flag |
| **Coupon System Phase 1–4** | xem bảng riêng bên dưới | Multi-source sync, click tracking, UX upgrade, admin CRUD |

#### Coupon System (Phase 1–4)

| Phase | Tính năng | File(s) | Ghi chú |
|---|---|---|---|
| Phase 1 | Schema: `platform`, `clickCount` | `prisma/schema.prisma` + `schema.sql` | `platform` = shopee/tiki/lazada; `clickCount` = lượt dùng |
| Phase 1 | Sync Shopee/Tiki/Lazada | `coupon-sync.service.ts` | Cần `SHOPEE_AFFILIATE_API_KEY`, `TIKI_AFFILIATE_API_KEY`, `LAZADA_AFFILIATE_API_KEY`; bỏ qua nếu không có key |
| Phase 1 | API filter nâng cao | `api/coupons/route.ts` | Params: `platform`, `type`, `sort`, `flash=1`; sort: value/popular/expiring |
| Phase 2 | Click tracking API | `api/coupons/[id]/click/route.ts` | POST → increment `clickCount` fire-and-forget, trả `affiliateUrl` |
| Phase 2 | CouponCard UX | `components/coupons/CouponCard.tsx` | Platform badge, masked code (reveal on click), countdown timer, lượt dùng |
| Phase 3 | CouponPageClient rebuild | `ma-giam-gia/CouponPageClient.tsx` | Platform tabs, filter sidebar, flash sale section (expiring <24h) |
| Phase 4 | Admin Coupons CRUD | `admin/(dashboard)/coupons/page.tsx` | List, manual add form, toggle active, delete, trigger sync |
| Phase 4 | Admin Coupon APIs | `api/admin/coupons/route.ts` + `[id]/route.ts` + `sync/route.ts` | GET list (active+inactive), POST create, PATCH toggle, DELETE, POST sync (deactivate expired) |

> **Ghi chú so với AI Integration Plan gốc:**
> - Tier 1 #1 (Post Generator) ✅ — nâng cấp thêm multi-provider thay vì chỉ Claude
> - Tier 1 #2 (Blog Auto-Writer) ✅ — nâng cấp thêm cover image auto-gen
> - Tier 2 #6 (SEO Meta Generation) ✅ — niche + compare lazy-generate
> - Tier 1 #3 (Enhanced Deal Scoring) ✅ — `discount×0.45 + click×0.30 + rating×0.25`
> - Tier 2 #4 (Embedding Matching) ✅ — OpenAI/Gemini embeddings, `ProductEmbedding` table, admin `/admin/embeddings`, không cần pgvector
> - Tier 2 #5 (Price Drop Prediction) ✅ — statistical, weekly cron log + admin page `/admin/price-prediction`
> - Tier 3 #7 (Auto-Classification) ✅ — `lib/auto-classifier.ts`, batch classify, admin page `/admin/auto-classify`, apply gợi ý
> - Tier 3 #8 (Feedback Sentiment) ✅ — `lib/sentiment-classifier.ts`, fire-and-forget after save, badge trong `/admin/feedback`

#### Click tracking

| Tính năng | File | Ghi chú |
|---|---|---|
| Click API (website) | `api/click/route.ts` | POST, rate limit |
| Redirect affiliate | `api/affiliate/redirect/[id]/route.ts` | GET `?src=zalo|facebook|direct`, fire-and-forget log, 302 |
| Click service | `lib/services/click.ts` | `logClick(productId, source)`, typed ClickSource |

---

## ❌ Chưa implement

### 🔴 Làm ngay (impact cao, dễ)

| Tính năng | Độ khó | Impact SEO | Impact Conversion | Ghi chú |
|---|---|---|---|---|
| ~~Widget "Đang xem nhiều"~~ | ~~Rất thấp~~ | ~~Thấp~~ | ~~Cao~~ | ✅ done — `/api/trending`, `TrendingWidget`, fallback 1h→24h, badge trên card |
| Cấu hình API key thực | Không cần code | — | — | AccessTrade + Shopee → điền vào `.env` (xem setup-guide.md) |
| ~~Enhanced Deal Scoring~~ (AI Plan Tier 1 #3) | ~~Thấp~~ | ~~—~~ | ~~Cao~~ | ✅ done — `discount×0.45 + click×0.30 + rating×0.25`. Note: schema không có `soldCount`/`reviewCount` như plan gốc → cần migration nếu muốn thêm 2 signal đó |

### 🟡 Giai đoạn 2 (impact SEO cao)

| Tính năng | Độ khó | Impact SEO | Impact Conversion | Ghi chú |
|---|---|---|---|---|
| ~~Blog theo ngách~~ | ~~Trung bình~~ | ~~Rất cao~~ | ~~Trung bình~~ | ✅ done — `/[niche]/blog` + `/[niche]/blog/[slug]`, MDX, hero + sidebar layout |
| ~~Auto-generate ảnh deal~~ | ~~Trung bình~~ | ~~Thấp~~ | ~~Cao~~ | ✅ done — `dealImageUrl` trong `facebook-content/route.ts`, preview trong `/admin/facebook` → Tạo nội dung, Pollinations.ai miễn phí |
| ~~Embedding-based Product Matching~~ (AI Plan Tier 2 #4) | ~~Cao~~ | ~~—~~ | ~~Trung bình~~ | ✅ done — OpenAI/Gemini embeddings, cosine similarity trong TypeScript (không cần pgvector), `ProductEmbedding` table, admin `/admin/embeddings`, cron Chủ nhật 3h |
| ~~Price Drop Prediction~~ (AI Plan Tier 2 #5) | ~~Trung bình~~ | ~~—~~ | ~~Cao~~ | ✅ done — `lib/price-prediction.ts` + `api/admin/price-prediction/route.ts` + `admin/(dashboard)/price-prediction/page.tsx` + NestJS `PricePredictionService` (cron thứ 2 8h). Không cần AI. Cron log top predictions mỗi tuần, có mẫu tin Zalo sẵn để enable |
| Chạy migration DB thật | Ops | — | — | `npx prisma migrate deploy` trên PostgreSQL production (bao gồm migration đa sàn) |
| Seed deal thật | Ops | — | — | Trigger sync sau khi có API key |

### 🟢 Giai đoạn 3 (dài hạn)

| Tính năng | Độ khó | Impact SEO | Impact Conversion | Ghi chú |
|---|---|---|---|---|
| ~~So sánh đa sàn~~ | ~~Cao~~ | ~~Cao~~ | ~~Cao~~ | ✅ done — Platform adapters, matching cron, `/[niche]/compare/[slug]`, admin review |
| Đăng ký Lazada App Key | Ops | — | — | Vào open.lazada.com → tạo App → lấy `LAZADA_APP_KEY`/`LAZADA_APP_SECRET` |
| Chạy matching job lần đầu | Ops | — | — | Sau khi có Lazada/Tiki — cron tự chạy 2h sáng hoặc trigger thủ công |
| TikTok content generator | Trung bình | Thấp | Cao | Script + caption ngắn, test sau khi traffic ổn định |
| A/B test nội dung post | Cao | — | Cao | Cần đủ volume click trước |
| Thuê CTV đăng Facebook | Ops | — | Cao | Không phải tech — dùng tab "Tạo nội dung" trong `/admin/facebook` |
| ~~Auto-Classification~~ (AI Plan Tier 3 #7) | ~~Trung bình~~ | ~~—~~ | ~~Trung bình~~ | ✅ done — `lib/auto-classifier.ts`, admin page `/admin/auto-classify`, batch 10–50, áp dụng 1 click |
| ~~Feedback Sentiment~~ (AI Plan Tier 3 #8) | ~~Trung bình~~ | ~~—~~ | ~~Thấp~~ | ✅ done — `lib/sentiment-classifier.ts`, fire-and-forget trong POST `/api/feedback`, badge màu trong admin |

---

## Bước tiếp theo (theo thứ tự thực hiện)

1. **Setup API keys** → xem `docs/operations/setup-guide.md` (bao gồm Lazada App Key mới)
2. **Khởi tạo DB** → chạy `schema.sql` (lần đầu): `psql $DATABASE_URL -f prisma/schema.sql`
3. **Seed ngách** → vào `/admin/niches/manage` → "Thêm ngách" → điền id, name, shopeeKeywords, atKeywords → set `status=draft`
4. **Chọn AI provider** → `/admin/ai-config` → thêm ít nhất 1 API key (khuyên dùng Gemini Flash — miễn phí 1M tokens/ngày)
5. **Trigger sync lần đầu** → `/admin/jobs` → Đồng bộ sản phẩm → chọn ngách → Chạy ngay → nếu ổn thì đổi `status=active`
6. **Seed Zalo token** → đặt `ZALO_OA_ACCESS_TOKEN` + `ZALO_OA_REFRESH_TOKEN` vào `.env` lần đầu → sau đó quản lý qua `/admin/zalo` → tab Token
7. **Generate SEO meta** → `/admin/seo` → "Generate tất cả ngách" (chạy 1 lần, tự động cache)
8. **Tạo embedding** → `/admin/embeddings` → "Chạy ngay" sau khi set `OPENAI_API_KEY` hoặc `GOOGLE_AI_API_KEY`
9. **Viết blog đầu tiên** → `/admin/blog` hoặc tạo file TSX trong `src/content/blog/`
10. **Review match queue** → `/admin/matches` sau khi matching cron chạy
11. **Auto-classify sản phẩm** → `/admin/auto-classify` → chạy batch, áp dụng gợi ý AI cho sản phẩm chưa đúng danh mục
