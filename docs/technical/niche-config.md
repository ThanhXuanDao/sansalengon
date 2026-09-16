# Cấu hình ngách (Niche Config)
*Last updated: 2026-09-13*

Toàn bộ ngách được lưu trong bảng `Niche` của PostgreSQL.  
Thêm / sửa / xoá ngách qua **Admin UI** tại `/admin/niches/manage` — **không cần sửa file hay restart**.

---

## Nguồn dữ liệu duy nhất (Single Source of Truth)

| Trước | Sau |
|---|---|
| `src/config/niches.yaml` (API sync) | ❌ Đã xoá |
| `src/apps/web/src/lib/niches.ts` (hardcoded array) | ❌ Đã xoá |
| Jobs registry `NICHE_OPTIONS` (hardcoded) | ❌ Đã xoá |
| **Bảng `Niche` trong PostgreSQL** | ✅ Nguồn duy nhất |

---

## Schema bảng `Niche`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | `String` PK | Slug định danh — dùng làm URL slug và `categorySlug` |
| `name` | `String` | Tên hiển thị trên UI |
| `emoji` | `String` | Emoji đại diện (mặc định `🏷️`) |
| `status` | `String` | `active` \| `draft` \| `inactive` |
| `description` | `String?` | Mô tả ngắn |
| `metaKeywords` | `String?` | Meta keywords SEO (chuỗi phân cách bằng dấu phẩy) |
| `sortOrder` | `Int` | Thứ tự hiển thị (tăng dần) |
| `shopeeKeywords` | `Json` | Mảng từ khoá tìm kiếm Shopee Affiliate |
| `atCampaignIds` | `Json` | Mảng ID campaign AccessTrade (trống = auto-match) |
| `atKeywords` | `Json` | Mảng từ khoá match tên campaign AT |
| `minDiscountPct` | `Int` | Giảm tối thiểu để sync (%) |
| `minPrice` | `Int` | Giá tối thiểu (VND) |
| `maxPrice` | `Int` | Giá tối đa (VND) |
| `postPrefix` | `String?` | Tiền tố nội dung Facebook post |
| `hashtags` | `String?` | Hashtag kèm theo nội dung |
| `zaloOaId` | `String?` | ID Zalo OA cho ngách (null = dùng OA chung) |
| `launchedAt` | `DateTime?` | Ngày kích hoạt lần đầu |
| `createdAt` | `DateTime` | Tự động |
| `updatedAt` | `DateTime` | Tự động |

---

## Trạng thái ngách

| Status | Ý nghĩa |
|---|---|
| `active` | Sync chạy đủ chu kỳ, hiển thị trên website |
| `draft` | Đã cấu hình, chưa activate — không sync, không hiển thị |
| `inactive` | Tạm ngừng — không sync, không hiển thị |

---

## AccessTrade campaign — Auto-match vs Manual

### Tự động (mặc định, `atCampaignIds: []`)

Khi `atCampaignIds` để trống, hệ thống:
1. Gọi `GET /v1/campaigns?approval=successful` → lấy tất cả campaign đã được duyệt
2. Filter campaign có tên/merchant **chứa** bất kỳ từ trong `atKeywords`
3. Nếu `atKeywords` cũng trống → fallback match theo `name` và `id` của ngách
4. Dùng các campaign matched đó để fetch sản phẩm

**Ví dụ:** Ngách `fashion`, `atKeywords: ["thời trang", "fashion"]` sẽ match:
- "Shopee Fashion VN Campaign" ✅
- "Lazada Thời Trang Q4" ✅  
- "Shopee Electronics" ❌

> Campaign list được cache 4h — không gọi API lặp lại cho mỗi ngách.

### Thủ công (override)

Điền ID cụ thể khi campaign có tên không chứa keyword nào liên quan.  
Trong form `/admin/niches/manage` → trường **AccessTrade Campaign IDs**.

---

## Shopee Keywords

Mỗi keyword → 1 lần gọi `productSearch(keyword, pageSize=20, sort=SALES_DESC)`.  
Kết quả tự động tạo affiliate tracking link qua Shopee Affiliate API.

- Dùng keyword ngắn, phổ biến — nhiều kết quả hơn keyword dài
- Shopee trả về top 20 sản phẩm best-seller theo keyword
- Nên có 3–8 keyword per ngách, tránh trùng lặp

---

## Quy trình thêm ngách mới

```
1. Vào Admin → Quản lý ngách (/admin/niches/manage)
   → Nhấn "Thêm ngách" → điền form
   ↓
2. Điền shopeeKeywords (ít nhất 3 từ khoá)
   ↓
3. (Tùy chọn) Điền atKeywords để auto-match campaign AT
   Hoặc để trống → hệ thống fallback về tên ngách
   ↓
4. Đặt status = "draft" → lưu
   ↓
5. Vào Admin → Sync Jobs → Đồng bộ sản phẩm → chọn ngách → Chạy ngay
   → Xem kết quả: bao nhiêu sản phẩm được fetch?
   ↓
6. Nếu ổn, đổi status = "active" tại /admin/niches/manage
   → cron tự động chạy từ đây
```

> **Không cần** tạo tay DB record, migrate, hay sửa code — `syncNiche()` tự `upsert` Category vào DB.

---

## API admin

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/admin/niches/manage` | GET | Danh sách tất cả ngách (kể cả draft) |
| `/api/admin/niches/manage` | POST | Tạo ngách mới |
| `/api/admin/niches/manage/[id]` | PUT | Cập nhật ngách (partial update) |
| `/api/admin/niches/manage/[id]` | DELETE | Xoá ngách |

Tất cả endpoint yêu cầu session admin và CSRF token.

---

## Truy cập trong code

```typescript
// Server component / API route / NestJS service
import { getActiveNiches, getNiche } from "@/lib/niches"

const niches = await getActiveNiches()          // chỉ active, theo sortOrder
const niche  = await getNiche("fashion")         // 1 ngách
```

```typescript
// Client component (nhận từ NicheProvider ở (public)/layout.tsx)
import { useNiches, useNiche } from "@/lib/niche-context"

const niches = useNiches()
const niche  = useNiche("fashion")
```
