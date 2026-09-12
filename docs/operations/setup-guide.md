# Hướng dẫn Setup Hệ thống
*Last updated: 2026-09-10*
*Đọc file này trước khi chạy hệ thống lần đầu.*

Hệ thống cần cấu hình: **PostgreSQL**, **Shopee Affiliate**, **AccessTrade**, **Zalo OA**, **AI providers (tùy chọn)**, và **Lazada/Tiki/Shopee coupon API (tùy chọn)**. Các bước sắp xếp theo thứ tự ưu tiên.

---

## Mục lục

1. [Tổng quan các biến môi trường](#1-tổng-quan-các-biến-môi-trường)
2. [PostgreSQL](#2-postgresql)
3. [Shopee Affiliate API](#3-shopee-affiliate-api)
4. [AccessTrade API](#4-accesstrade-api)
5. [Coupon Affiliate APIs (Shopee / Tiki / Lazada)](#5-coupon-affiliate-apis-shopee--tiki--lazada)
6. [Lazada Open Platform (so sánh đa sàn)](#6-lazada-open-platform-so-sánh-đa-sàn--giai-đoạn-3)
7. [Zalo OA](#7-zalo-oa)
8. [AI Providers (tùy chọn)](#8-ai-providers-tùy-chọn)
9. [Cấu hình domain và URL](#9-cấu-hình-domain-và-url)
10. [Quy trình chạy lần đầu](#10-quy-trình-chạy-lần-đầu)
11. [Kiểm tra hệ thống](#11-kiểm-tra-hệ-thống)
12. [Deploy lên server](deploy-guide.md) ← hướng dẫn deploy chi tiết (Railway, Vercel, VPS, Docker)

---

## 1. Tổng quan các biến môi trường

Copy file `.env.example` thành `.env` trong thư mục `src/`:

```bash
cp src/.env.example src/.env
```

Tất cả các biến cần điền (xem chi tiết từng mục bên dưới):

```env
# === BẮT BUỘC ===
DATABASE_URL=                       # PostgreSQL connection string
NEXT_PUBLIC_SITE_URL=               # URL website công khai (không có / ở cuối)
WEB_URL=                            # URL Next.js dùng từ NestJS (thường giống trên)
API_URL=http://localhost:4000       # URL NestJS API — Web gọi để trigger sync jobs
API_INTERNAL_SECRET=                # Bearer token bảo vệ /sync/* endpoints (trống = không auth)

# === DATA SOURCES — DEAL (cần ít nhất 1) ===
ACCESSTRADE_ACCESS_KEY=             # Deal + coupon AccessTrade
ACCESSTRADE_BASE_URL=https://api.accesstrade.vn/v1
ACCESSTRADE_REGION=VN
SHOPEE_AFFILIATE_APP_ID=            # Deal từ Shopee Affiliate GraphQL
SHOPEE_AFFILIATE_APP_SECRET=

# === COUPON SYNC — CÁC SÀN (tất cả tùy chọn — bỏ qua nếu không có key) ===
SHOPEE_AFFILIATE_API_KEY=           # Voucher Shopee (bearer token riêng với app ID/secret ở trên)
TIKI_AFFILIATE_API_KEY=             # Voucher Tiki Affiliate
LAZADA_AFFILIATE_API_KEY=           # Voucher Lazada Affiliate

# === SO SÁNH ĐA SÀN (tùy chọn) ===
LAZADA_APP_KEY=                     # Lazada Open Platform — product search + price compare
LAZADA_APP_SECRET=

# === AI PROVIDERS (tất cả tùy chọn — khuyên dùng Gemini Flash miễn phí) ===
GOOGLE_AI_API_KEY=                  # Gemini Flash — FREE 1M tokens/ngày (KHUYÊN DÙNG)
DEEPSEEK_API_KEY=                   # DeepSeek Chat — rất rẻ ($0.14/1M tokens)
OPENAI_API_KEY=                     # GPT-4o mini + DALL-E + text-embedding-3-small
ANTHROPIC_API_KEY=                  # Claude Haiku/Sonnet — chất lượng cao nhất
STABILITY_API_KEY=                  # Stability AI SDXL — $0.01/image (tùy chọn)

# === ZALO OA (tùy chọn — chỉ cần nếu muốn broadcast) ===
# Chỉ cần cho lần SEED ĐẦU TIÊN — sau đó quản lý qua Admin → Zalo OA → tab Token
ZALO_OA_ACCESS_TOKEN=
ZALO_OA_REFRESH_TOKEN=
ZALO_OA_APP_ID=
ZALO_OA_APP_SECRET=
```

---

## 2. PostgreSQL

### 2.1 Yêu cầu

- PostgreSQL 14+ (khuyến nghị 15 hoặc 16)
- Extension `pgcrypto` (dùng cho `cuid()` nếu cần)

### 2.2 Tạo database

```sql
CREATE USER affiliate_user WITH PASSWORD 'your_password';
CREATE DATABASE affiliate OWNER affiliate_user;
GRANT ALL PRIVILEGES ON DATABASE affiliate TO affiliate_user;
```

### 2.3 Connection string

```env
DATABASE_URL="postgresql://affiliate_user:your_password@localhost:5432/affiliate"
```

Nếu dùng cloud (Supabase, Railway, Neon):
- Lấy connection string từ dashboard của provider
- Thêm `?sslmode=require` ở cuối nếu cần SSL

### 2.4 Tạo schema DB

Chạy file SQL một lần để tạo toàn bộ bảng:

```bash
psql \$DATABASE_URL -f src/apps/web/prisma/schema.sql
`````r

File này tạo tất cả bảng: `Category`, `Product`, `PriceHistory`, `PlatformProduct`, `ProductMatch`, `Platform`, `ClickLog`, `AppSetting`, `Feedback`, `Coupon` (có `platform`, `clickCount`), `ProductEmbedding`, `BroadcastLog`, và seed sẵn 4 platform (Shopee, Lazada, Tiki, TikTok Shop).

> **Lưu ý:** Project dùng `schema.sql` trực tiếp — không dùng Prisma migrations. Không chạy `prisma migrate deploy`.

### 2.5 Xem DB bằng Prisma Studio (local)

```bash
npx prisma studio
```

---

## 3. Shopee Affiliate API

### 3.1 Đăng ký

1. Vào **https://affiliate.shopee.vn**
2. Đăng nhập bằng tài khoản Shopee cá nhân
3. Đăng ký tư cách Publisher — chọn "Website" làm kênh
4. Điền URL website (có thể dùng domain tạm trong lúc chờ duyệt)
5. Chờ duyệt (thường 1–3 ngày làm việc)

### 3.2 Lấy API credentials

Sau khi được duyệt:
1. Vào **https://affiliate.shopee.vn/developer** → tab **API Keys**
2. Tạo App mới → chọn quyền `product.read`, `link.create`
3. Sao chép **App ID** và **App Secret**

### 3.3 Điền vào .env

```env
SHOPEE_AFFILIATE_APP_ID=123456
SHOPEE_AFFILIATE_APP_SECRET=abcdef1234567890abcdef1234567890
```

### 3.4 Lưu ý

- API Shopee Affiliate VN dùng GraphQL endpoint: `https://open-api.affiliate.shopee.vn/graphql`
- Rate limit: 100 req/phút
- Mỗi sản phẩm cần tạo tracking link riêng — hệ thống đã tự động hóa trong `deal-sync.service.ts`
- Hoa hồng thường 2–8% tùy ngành hàng

---

## 4. AccessTrade API

### 4.1 Đăng ký

1. Vào **https://accesstrade.vn**
2. Đăng ký tài khoản Publisher
3. Xác minh email + điền thông tin trang web
4. Chờ duyệt (thường vài giờ đến 1 ngày)

### 4.2 Lấy Access Key

1. Đăng nhập → vào **https://publisher.accesstrade.vn/settings/api**
2. Tạo API Key mới
3. Sao chép **Access Key**

### 4.3 Điền vào .env

```env
ACCESSTRADE_ACCESS_KEY=your_access_key_here
ACCESSTRADE_BASE_URL=https://api.accesstrade.vn/v1
ACCESSTRADE_REGION=VN
```

### 4.4 Các campaign cần join

Để sync deal và coupon, cần join các campaign liên quan trong AccessTrade:

1. Vào **https://publisher.accesstrade.vn/campaigns**
2. Tìm và join các campaign của: Shopee, Lazada, Tiki, Sendo (nếu có)
3. Sau khi join và được duyệt, hệ thống tự động pull deal + coupon trong lần sync tiếp theo

### 4.5 Coupon API

AccessTrade cung cấp API riêng cho voucher: `GET /v1/vouchers`
- Hệ thống sync mỗi 6h và 18h (`coupon-sync.service.ts`)
- Coupon được phân loại theo ngách, universal coupon (nicheId null) xuất hiện trên tất cả trang

---

## 5. Coupon Affiliate APIs (Shopee / Tiki / Lazada)

Đây là các API riêng để sync **voucher/mã giảm giá** từ các sàn về trang `/ma-giam-gia`. Khác với Shopee Affiliate App ID/Secret (dùng để sync deal sản phẩm).

Tất cả đều **tùy chọn** — nếu không có key, service sẽ bỏ qua nguồn đó mà không báo lỗi.

### 5.1 Shopee Affiliate Voucher API

1. Vào **https://affiliate.shopee.vn** → đăng nhập
2. Vào **Developer** → **API Keys** → tạo key với quyền `voucher.read`
3. Sao chép bearer token (khác với App ID/Secret)

```env
SHOPEE_AFFILIATE_API_KEY=your_bearer_token
```

### 5.2 Tiki Affiliate API

1. Đăng ký affiliate tại **https://affiliate.tiki.vn**
2. Sau khi được duyệt → vào **API Credentials** → tạo access token
3. Endpoint voucher: `https://api.tiki.vn/raas/v2/vouchers`

```env
TIKI_AFFILIATE_API_KEY=your_access_token
```

### 5.3 Lazada Affiliate Voucher API

Khác với Lazada Open Platform (dùng cho product search), đây là API voucher của Lazada Affiliate Program.

1. Đăng ký tại **https://affiliate.lazada.vn**
2. Vào **Tools** → **API Access** → lấy bearer token
3. Endpoint: `https://api.lazada.vn/rest/affiliate/vouchers`

```env
LAZADA_AFFILIATE_API_KEY=your_bearer_token
```

### 5.4 Kiểm tra coupon sync

Sau khi điền key:
1. Vào **Admin → Sync Jobs** (`/admin/jobs`)
2. Chọn **Đồng bộ Coupon/Voucher** trong sidebar
3. (Tùy chọn) Chọn nguồn: `all`, `accesstrade`, hoặc `platforms`
4. Nhấn **Chạy ngay** — xem kết quả và log ngay bên dưới

Hoặc chờ cron tự chạy (mặc định: 6h và 18h mỗi ngày).

> Coupon từ AccessTrade vẫn sync bình thường mà không cần các key trên.

---

## 6. Lazada Open Platform (So sánh đa sàn — Giai đoạn 3)

Phần này chỉ cần nếu muốn dùng tính năng so sánh giá Lazada. Nếu bỏ qua, `LazadaAdapter` tự động skip khi không có credentials.

### 6.1 Đăng ký Lazada Open Platform

1. Vào **https://open.lazada.com**
2. Đăng nhập bằng tài khoản seller hoặc affiliate của Lazada VN
3. Vào **My Apps** → **Create App**
4. Điền tên app, chọn country: Vietnam
5. Chọn permission: `product` (search, detail)
6. Submit và chờ duyệt (thường 1–3 ngày)

### 6.2 Lấy API credentials

Sau khi được duyệt:
1. Vào app vừa tạo → tab **App Info**
2. Sao chép **App Key** và **App Secret**

### 6.3 Điền vào .env

```env
LAZADA_APP_KEY=123456
LAZADA_APP_SECRET=abcdef1234567890abcdef1234567890
```

### 6.4 Cách hoạt động

- `LazadaAdapter` dùng HMAC-SHA256 signing với `App Key` + `App Secret`
- Method: `lazada.affiliate.products.query` tại `https://api.lazada.vn/rest`
- Matching cron chạy mỗi đêm 2h — lần đầu matching 20 sản phẩm/platform/tick
- Review kết quả tại `/admin/matches` (filter platform=lazada, status=PENDING)

---

## 7. Zalo OA

Đây là phần phức tạp nhất. Cần có **Zalo Official Account** (OA) trước.

### 7.1 Tạo Zalo Official Account

1. Vào **https://oa.zalo.me** → đăng nhập bằng số điện thoại
2. Tạo OA mới → chọn loại "Doanh nghiệp" hoặc "Cá nhân"
3. Điền thông tin, upload ảnh đại diện và ảnh bìa
4. Xác minh OA (cần CCCD hoặc giấy phép kinh doanh tùy loại)
5. Chờ duyệt (1–5 ngày làm việc)

> **Lưu ý:** OA loại "Cá nhân" không gửi broadcast được. Phải dùng OA "Doanh nghiệp" hoặc OA đã xác thực.

### 7.2 Tạo Zalo App (để lấy API credentials)

1. Vào **https://developers.zalo.me**
2. Đăng nhập → **My Apps** → **Create App**
3. Điền tên app, chọn loại "Official Account"
4. Vào tab **Settings** → sao chép **App ID** và **App Secret**

### 7.3 Lấy Access Token lần đầu

Access token Zalo OA **hết hạn sau 90 ngày** và không thể lấy tự động lần đầu — phải lấy thủ công một lần.

**Cách 1 — Qua Zalo Developer Console (dễ nhất):**
1. Vào **https://developers.zalo.me/tools/explorer**
2. Chọn App → chọn OA → nhấn **Generate Access Token**
3. Sao chép `access_token` và `refresh_token`

**Cách 2 — OAuth flow (nếu cần automation):**
```
GET https://oauth.zaloapp.com/v4/oa/permission
  ?app_id=YOUR_APP_ID
  &redirect_uri=YOUR_REDIRECT_URI

# Sau khi user authorize → nhận code → đổi lấy token:
POST https://oauth.zaloapp.com/v4/oa/access_token
  Content-Type: application/x-www-form-urlencoded
  secret_key: YOUR_APP_SECRET

  code=AUTH_CODE&app_id=YOUR_APP_ID&grant_type=authorization_code
```

### 7.4 Điền vào .env

```env
ZALO_OA_ACCESS_TOKEN=<access_token_lấy_ở_bước_7.3>
ZALO_OA_REFRESH_TOKEN=<refresh_token_lấy_ở_bước_7.3>
ZALO_OA_APP_ID=<app_id_từ_developers.zalo.me>
ZALO_OA_APP_SECRET=<app_secret_từ_developers.zalo.me>
```

### 7.5 Seed token vào Database

Sau khi điền `.env` và khởi động API server, `ZaloTokenService` tự động seed token từ env vào DB khi `OnModuleInit` chạy. Kiểm tra:

1. Vào admin → **Zalo OA** → tab **Broadcasts** — hoặc —
2. Vào **Broadcast** trong sidebar → xem trạng thái token (xanh = hợp lệ)

Nếu muốn seed thủ công:
```bash
# Gọi API force refresh (cần token hợp lệ trong env)
curl -X POST http://localhost:3000/api/broadcast/token \
  -H "Content-Type: application/json" \
  -H "Cookie: admin-session=..." 
```

### 7.6 Auto-refresh

Hệ thống tự động kiểm tra và refresh token:
- **Cron:** Mỗi thứ Hai lúc 7h sáng (`ZaloTokenService`)
- **Ngưỡng:** Refresh nếu còn ≤ 14 ngày
- **Thủ công:** Nút "Refresh Token" trong `/admin/broadcast`

### 7.7 Test broadcast

Gửi thử một broadcast:
1. Vào `/admin/broadcast`
2. Chọn ngách → nhấn **Gửi ngay**
3. Nếu thành công → kiểm tra Zalo OA trên điện thoại

---

## 8. AI Providers (tùy chọn)

Hệ thống hỗ trợ **4 AI providers** — mỗi task có thể dùng provider khác nhau, cấu hình trong `/admin/ai-config` mà không cần restart. Tất cả đều có fallback về template nếu không có key.

### 8.1 Thứ tự khuyên dùng (từ rẻ đến đắt)

| Provider | Key env | Chi phí | Đăng ký |
|---|---|---|---|
| **Gemini Flash** ⭐ | `GOOGLE_AI_API_KEY` | **Miễn phí** 1M tokens/ngày | https://aistudio.google.com/apikey |
| **DeepSeek Chat** | `DEEPSEEK_API_KEY` | ~$0.14/1M tokens | https://platform.deepseek.com/api_keys |
| **OpenAI** | `OPENAI_API_KEY` | $0.15/1M (mini) + embedding $0.02/1M | https://platform.openai.com/api-keys |
| **Claude Haiku** | `ANTHROPIC_API_KEY` | $0.80/1M tokens | https://console.anthropic.com/settings/keys |

> **Khuyên dùng:** Chỉ cần `GOOGLE_AI_API_KEY` là đủ dùng hầu hết tính năng AI miễn phí.
> `OPENAI_API_KEY` cần thêm nếu muốn embedding matching (`text-embedding-3-small`).

### 8.2 Điền vào .env

```env
# Chọn 1 hoặc nhiều — khuyên tối thiểu:
GOOGLE_AI_API_KEY=AIza...          # Gemini Flash — miễn phí
OPENAI_API_KEY=sk-proj-...         # Nếu muốn embedding matching
```

### 8.3 Cấu hình provider theo task

Sau khi thêm key và restart server:
1. Vào **`/admin/ai-config`**
2. Với mỗi task (Post generator / Blog writer / SEO meta / Sentiment / Auto-classify): chọn provider và nhấn Save
3. Bật/tắt từng task bằng toggle Enable — dùng để kiểm soát cost

### 8.4 Các tính năng AI và chi phí ước tính (với Gemini Flash)

| Tính năng | Task flag | Chi phí/tháng (Gemini) |
|---|---|---|
| Post generator (Facebook/Zalo) | `post_generation` | ~$0 (free tier) |
| AI Blog writer | `post_generation` | ~$0 (free tier) |
| AI SEO meta | `post_generation` | <$0.01 (chạy 1 lần, cache) |
| Feedback Sentiment | `post_generation` | ~$0 (fire-and-forget) |
| Auto-Classification | `post_generation` | ~$0 (on-demand) |
| Embedding matching | OpenAI only | ~$0.01–0.05 tùy số sản phẩm |

### 8.5 Generate SEO meta lần đầu

1. Vào **`/admin/seo`** → nhấn **"Generate tất cả ngách"** — chạy 1 lần là đủ
2. Kết quả cache vào `AppSetting` DB, không phát sinh thêm chi phí
3. Compare page SEO lazy-generate khi crawl lần đầu — không cần thao tác thủ công

### 8.6 Generate embedding lần đầu

1. Thêm `OPENAI_API_KEY` hoặc `GOOGLE_AI_API_KEY` vào `.env`
2. Vào **`/admin/embeddings`** → nhấn **"Chạy ngay"** → chọn limit
3. Cron tự chạy lại mỗi Chủ nhật 3h sáng để embed sản phẩm mới

### 8.7 Khi không có AI key nào

- **Post generator**: trả về template tĩnh (vẫn hoạt động)
- **Blog writer**: không thể tạo bài — hiển thị lỗi trong admin
- **SEO meta**: dùng mô tả tĩnh trong `niches.ts`
- **Sentiment / Auto-classify**: skip (feature flag bị disabled tự động)

---

## 9. Cấu hình domain và URL

### 9.1 Biến URL

```env
# NestJS (apps/api) — URL của Next.js web app
WEB_URL=https://yourdomain.com

# Next.js (apps/web) — URL công khai, dùng cho sitemap + OG tags + redirect links
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

Cả hai biến phải **giống nhau** và **không có dấu / ở cuối**.

### 9.2 robots.txt và sitemap

Sau khi có domain thật:
- `robots.txt` tự phục vụ tại `/robots.txt`
- Sitemap tự phục vụ tại `/sitemap.xml` (revalidate 1h)
- Submit sitemap vào **Google Search Console** tại `https://search.google.com/search-console`

### 9.3 Khai báo Zalo OA redirect URI

Nếu dùng OAuth flow:
1. Vào Zalo Developer → App Settings → **Redirect URI**
2. Thêm `https://yourdomain.com/api/zalo/callback`

---

## 10. Quy trình chạy lần đầu

Thực hiện **theo thứ tự** sau:

```
1. Copy .env.example thành .env, điền DATABASE_URL + ít nhất 1 data source key
       ↓
2. Tạo DB schema (chạy 1 lần):
   psql $DATABASE_URL -f src/apps/web/prisma/schema.sql
       ↓
3. Khởi động API server:
   cd src/apps/api && npm run start:dev
   → ZaloTokenService tự seed token từ env vào DB (nếu có ZALO_OA_ACCESS_TOKEN)
       ↓
4. Khởi động Web server:
   cd src/apps/web && npm run dev
       ↓
5. Kiểm tra admin: http://localhost:3000/admin
       ↓
6. Chạy sync thủ công (không cần chờ cron):
   Vào http://localhost:3000/admin/jobs → chọn job → Chạy ngay
   Thứ tự nên làm: Đồng bộ sản phẩm → Đồng bộ Coupon/Voucher → Khớp nền tảng
   (Cron tự chạy theo lịch sau: deal mỗi 4h, coupon 6h & 18h, matching 2h hằng đêm)
       ↓
7. (Có AI key) Vào /admin/ai-config → chọn provider cho từng task
       ↓
8. (Có AI key) Vào /admin/seo → "Generate tất cả ngách"
       ↓
9. (Có OPENAI_API_KEY hoặc GOOGLE_AI_API_KEY)
   Vào /admin/embeddings → "Chạy ngay" để tạo embedding cho sản phẩm
       ↓
10. (Tùy chọn) Cấu hình Zalo OA → kiểm tra broadcast qua /admin/broadcast
```

> **Không dùng** `npx prisma migrate deploy` — project dùng `schema.sql` trực tiếp.

---

## 11. Kiểm tra hệ thống

### Checklist sau khi setup

**Core:**
- [ ] Trang chủ hiển thị sản phẩm (không trống)
- [ ] Click "Mua ngay" → redirect đúng Shopee/AccessTrade link
- [ ] Click log xuất hiện trong `/admin/click-logs`
- [ ] Trang `/fashion` (niche page) load được
- [ ] Sitemap tại `/sitemap.xml` có URL sản phẩm

**Coupon:**
- [ ] Trang `/ma-giam-gia` hiển thị danh sách coupon
- [ ] Platform tabs (Shopee/Tiki/Lazada) filter được
- [ ] Nhấn "Lấy mã" → mã hiện ra + mở affiliate link
- [ ] `/admin/coupons` hiển thị danh sách, có thể toggle active/delete

**AI (nếu có key):**
- [ ] `/admin/ai-config` hiển thị đúng provider và toggle enable
- [ ] `/admin/seo` — 6/6 ngách có trạng thái "AI" xanh
- [ ] `/admin/embeddings` — coverage > 0% sau khi chạy ngay
- [ ] `/admin/auto-classify` — classify batch sản phẩm hoạt động
- [ ] Submit feedback → sau vài giây badge sentiment xuất hiện trong `/admin/feedback`

**Zalo (nếu cấu hình):**
- [ ] Admin Zalo: tab Token → trạng thái hiển thị màu xanh (còn nhiều ngày)
- [ ] Gửi thử broadcast Zalo → nhận tin trên OA

**Đa sàn (nếu có Lazada key):**
- [ ] Trang `/[niche]/compare/[slug]` load được, hiển thị bảng giá
- [ ] `/admin/matches` hiển thị PENDING matches sau khi cron chạy

---

### Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Giải pháp |
|---|---|---|
| Trang chủ trống | Chưa có data | Restart API server để trigger sync; điền API key |
| Click không log | Schema chưa tạo | Chạy lại `schema.sql` |
| Zalo "Token invalid" | Token hết hạn 90 ngày | Lấy token mới tại developers.zalo.me → Admin → Zalo OA → tab Token → nhập thủ công |
| AI features không hoạt động | Chưa có API key hoặc feature bị disable | Thêm key vào `.env` + restart; hoặc vào `/admin/ai-config` bật toggle |
| Coupon (AccessTrade) không hiện | Chưa join campaign | Join campaign tại publisher.accesstrade.vn → chờ sync |
| Coupon Shopee/Tiki/Lazada trống | Thiếu API key sàn | Thêm `SHOPEE/TIKI/LAZADA_AFFILIATE_API_KEY` — hoặc bình thường (sync bỏ qua gracefully) |
| Broadcast lỗi 400 | OA chưa xác thực | Dùng OA Doanh nghiệp đã duyệt |
| Sitemap trống | DB không có sản phẩm | Xem mục "Trang chủ trống" ở trên |
| Embedding không chạy | Thiếu `OPENAI_API_KEY` hoặc `GOOGLE_AI_API_KEY` | Thêm 1 trong 2 key → chạy lại từ `/admin/embeddings` |

---

### Liên kết quan trọng

| Dịch vụ | URL quản lý |
|---|---|
| Shopee Affiliate | https://affiliate.shopee.vn |
| AccessTrade Publisher | https://publisher.accesstrade.vn |
| Tiki Affiliate | https://affiliate.tiki.vn |
| Lazada Affiliate | https://affiliate.lazada.vn |
| Lazada Open Platform | https://open.lazada.com |
| Zalo OA Manager | https://oa.zalo.me |
| Zalo Developers | https://developers.zalo.me |
| Google AI Studio (Gemini) | https://aistudio.google.com/apikey |
| DeepSeek Platform | https://platform.deepseek.com/api_keys |
| OpenAI Platform | https://platform.openai.com/api-keys |
| Anthropic Console | https://console.anthropic.com/settings/keys |
| Google Search Console | https://search.google.com/search-console |
| Prisma Studio (local) | `npx prisma studio` → http://localhost:5555 |
