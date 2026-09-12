# Sync Jobs — Hướng dẫn vận hành

*Last updated: 2026-09-12*

---

## Tổng quan kiến trúc

Hệ thống có **2 tầng job** chạy song song:

| Tầng | App | Chạy bằng | Mục đích |
|---|---|---|---|
| **API Jobs** | `apps/api` (NestJS) | `@Cron` decorator | Fetch data từ Shopee/AccessTrade, sync giá |
| **Web Jobs** | `apps/web` (Next.js) | Admin UI + tick endpoint | AI processing, SEO, broadcast, bảo trì |

---

## 1. API Jobs — NestJS (`apps/api`)

Các job này **chạy tự động** theo lịch cứng trong code. Không cần cấu hình thêm nếu `apps/api` đang chạy.

| Service | Cron | Giờ VN (UTC+7) | Làm gì |
|---|---|---|---|
| `DealSyncService` | `0 */4 * * *` | 0h, 4h, 8h, 12h, 16h, 20h | Fetch sản phẩm mới từ Shopee Affiliate + AccessTrade, lưu vào DB, cập nhật giá |
| `CouponSyncService` | `0 6,18 * * *` | 6h, 18h | Đồng bộ coupon từ nguồn ngoài, deactivate hết hạn |
| `PricePredictionService` | `0 8 * * 1` | Thứ 2 lúc 8h | Phân tích lịch sử giá, tính ngày mua rẻ nhất theo tuần |
| `ZaloBroadcastService` | `0 9 * * *` | 9h mỗi ngày | Gửi top deal đến followers Zalo OA |
| `ZaloTokenService` | `0 7 * * 1` | Thứ 2 lúc 7h | Refresh Zalo access token trước khi hết hạn |
| `EmbeddingService` | `0 3 * * 0` | Chủ nhật 3h | Tạo/cập nhật vector embedding cho sản phẩm mới |
| `PlatformSyncService` (full) | `0 2 * * *` | 2h mỗi ngày | Đồng bộ giá từ Lazada, Tiki, TikTok Shop |
| `PlatformSyncService` (delta) | `30 */4 * * *` | 4h30, 8h30, ... | Cập nhật delta giá các sàn |

> **Điều kiện chạy được:** `apps/api` phải đang chạy (`docker compose up api`). Nếu `apps/api` down, các job này sẽ không chạy.

---

## 2. Web Jobs — Next.js (`apps/web`)

Các job này được quản lý qua màn hình **Admin > Sync Jobs** (`/admin/jobs`). Có thể:
- Chạy thủ công (nút "Chạy ngay")
- Cấu hình lịch tự động (cron expression)
- Xem lịch sử từng lần chạy

### Danh sách Web Jobs

| Job key | Tên | Category | Schedule mặc định |
|---|---|---|---|
| `coupon_expire` | Hết hạn Coupon | Bảo trì | Hằng ngày 00:00 |
| `embedding_gen` | Tạo Vector Embedding | AI | Chủ nhật 03:00 |
| `auto_classify` | AI Phân loại sản phẩm | AI | Không tự động |
| `seo_gen` | Tạo SEO Metadata | Nội dung | Thứ 2 & Thứ 5 08:00 |
| `price_analysis` | Phân tích & Dự đoán giá | Phân tích | Hằng ngày 02:00 |
| `zalo_broadcast` | Broadcast Zalo OA | Broadcast | Hằng ngày 12:00 & 20:00 |

### Chi tiết từng job

#### `coupon_expire` — Hết hạn Coupon
- **Làm gì:** Scan DB, tìm coupon có `expiresAt < now` + `isActive=true`, set `isActive=false`.
- **Tại sao cần:** Coupon hết hạn còn hiển thị → user click lỗi → mất uy tín.
- **Tần suất đề xuất:** 1 lần/ngày (00:00). Chạy nhiều hơn không có lợi.
- **Config:** Không có tham số.
- **Phụ thuộc:** Chỉ cần DB.

#### `embedding_gen` — Tạo Vector Embedding
- **Làm gì:** Lấy sản phẩm chưa có embedding, gọi OpenAI/Gemini API, lưu vector vào `ProductEmbedding`.
- **Tại sao cần:** Cần thiết cho tìm kiếm ngữ nghĩa và so sánh giá thông minh đa sàn.
- **Tần suất đề xuất:** 1 lần/tuần (Chủ nhật 03:00). Chạy sau khi `DealSyncService` đã import sản phẩm mới cả tuần.
- **Config:** `limit` — số sản phẩm xử lý mỗi lần (mặc định 50, tối đa 200). Giới hạn để tránh tốn API cost.
- **Phụ thuộc:** Cần `OPENAI_API_KEY` hoặc `GOOGLE_AI_API_KEY`.

#### `auto_classify` — AI Phân loại sản phẩm
- **Làm gì:** Gửi tên sản phẩm cho AI, nhận gợi ý danh mục, tự động cập nhật `categoryId`.
- **Tại sao cần:** Sản phẩm import từ Shopee thường bị gắn sai category → filter trang sai → UX kém.
- **Tần suất đề xuất:** Không nên chạy định kỳ — chỉ chạy thủ công sau khi import batch lớn hoặc thêm danh mục mới. Tốn token AI nhiều.
- **Config:** `limit` — số sản phẩm xử lý (mặc định 30, tối đa 100).
- **Phụ thuộc:** Cần AI provider (Claude/Gemini). Feature flag `post_generation` phải enabled.

#### `seo_gen` — Tạo SEO Metadata
- **Làm gì:** Gọi Claude, đưa vào top 5 sản phẩm hot nhất của ngách, Claude viết title/description SEO, cache vào `AppSetting`.
- **Tại sao cần:** SEO title/desc tốt → CTR từ Google cao hơn. Nội dung đề cập sản phẩm đang sale thực tế thay vì template cứng.
- **Tần suất đề xuất:** 2 lần/tuần (Thứ 2 & Thứ 5 sáng). Quá nhiều = Google không kịp index, lãng phí API.
- **Config:** `niche` — chọn 1 ngách hoặc "tất cả".
- **Phụ thuộc:** Cần `ANTHROPIC_API_KEY`.

#### `price_analysis` — Phân tích & Dự đoán giá
- **Làm gì:** Lấy 180 ngày lịch sử giá của từng sản phẩm, nhóm theo ngày trong tuần, tìm ngày nào giá thấp nhất so với trung bình (statistical, không cần AI).
- **Tại sao cần:** Hiển thị "nên mua vào thứ 3" trên trang sản phẩm — tính năng phân biệt cạnh tranh, tăng trust.
- **Tần suất đề xuất:** 1 lần/ngày (02:00 — server ít tải). Cần tối thiểu 14 data points mới phân tích được.
- **Config:** `limit` — số sản phẩm phân tích (mặc định 100, tối đa 500).
- **Phụ thuộc:** Chỉ cần DB (không cần AI hay external API).

#### `zalo_broadcast` — Broadcast Zalo OA
- **Làm gì:** Query top 5 sản phẩm (score = discount 60% + click 40%), ghép message text có emoji + giá + link, POST lên Zalo OA Broadcast API, ghi log vào `BroadcastLog`.
- **Tại sao cần:** Zalo OA followers là nguồn traffic warm nhất, 0 đồng quảng cáo.
- **Tần suất đề xuất:** Tối đa 2 lần/ngày (12:00 & 20:00). OA miễn phí giới hạn ~4 broadcast/ngày. Chạy quá nhiều → user unfollow.
- **Config:** `niche` — lọc theo ngách hoặc gửi tất cả deal.
- **Phụ thuộc:** Cần Zalo access token (cấu hình ở `/admin/zalo`). `ZaloTokenService` trong NestJS API tự refresh token hàng tuần.

---

## 3. Cơ chế Tick (chạy tự động Web Jobs)

Web Jobs cần **một nguồn gọi** định kỳ vào endpoint:

```
GET /api/admin/cron/tick
Authorization: Bearer <CRON_SECRET>
```

Endpoint này:
1. Tìm tất cả `SyncJob` có `scheduleEnabled=true` và `scheduleNextRunAt <= now`
2. Chạy từng job theo thứ tự
3. Cập nhật `scheduleNextRunAt` sang lần tiếp theo
4. Trả về danh sách job đã chạy + kết quả

### Cách thiết lập Tick

**Option A — Docker cron (khuyến nghị cho self-host):**

Thêm vào `docker-compose.local.yml`:
```yaml
cron:
  image: alpine
  command: crond -f
  volumes:
    - ./crontab:/etc/crontabs/root
  networks:
    - affiliate_net
```

File `crontab`:
```cron
* * * * * wget -qO- "http://web:3000/api/admin/cron/tick" -H "Authorization: Bearer ${CRON_SECRET}" > /dev/null 2>&1
```

**Option B — cron-job.org (miễn phí, không cần server thêm):**
- Tạo job tại https://cron-job.org
- URL: `https://yourdomain.com/api/admin/cron/tick`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Interval: Every 1 minute

**Option C — GitHub Actions:**
```yaml
on:
  schedule:
    - cron: '* * * * *'  # every minute
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - run: curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" ${{ secrets.SITE_URL }}/api/admin/cron/tick
```

### Biến môi trường cần thêm

```env
CRON_SECRET=your-random-secret-here
```

---

## 4. Quan hệ giữa API Jobs và Web Jobs

Một số jobs trùng tên nhưng **khác nhau hoàn toàn**:

| Chức năng | API Job (NestJS) | Web Job (Next.js) |
|---|---|---|
| Embedding | `EmbeddingService` — embedding cho platform matching | `embedding_gen` — embedding cho semantic search |
| Price analysis | `PricePredictionService` — viết vào AppLog | `price_analysis` — in-memory, trả về kết quả ngay |
| Zalo broadcast | `ZaloBroadcastService` — chạy hằng ngày | `zalo_broadcast` — chạy khi admin muốn broadcast thêm |
| Coupon | `CouponSyncService` — fetch coupon mới từ ngoài + expire | `coupon_expire` — chỉ expire, không fetch |

> Nếu `apps/api` đang chạy bình thường, các Web Jobs chủ yếu dùng để **trigger thủ công** hoặc **chạy thêm ngoài lịch** của NestJS.
