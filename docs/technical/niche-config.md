# Cấu hình ngách (Niche Config)

## Cách thêm ngách mới

Toàn bộ ngách được quản lý trong file `config/niches.yaml`.  
Thêm ngách mới = thêm 1 block vào file này, không cần sửa code.

---

## Ví dụ cấu hình

```yaml
niches:
  - id: fashion
    name: "Thời trang"
    status: active
    launched: "2026-09-01"
    accesstrade:
      category_ids: [1234, 5678]   # ID category trên AccessTrade
    filters:
      min_discount_pct: 30         # Chỉ lấy deal giảm ≥30%
      min_price: 50000             # Bỏ qua sản phẩm quá rẻ
      max_price: 5000000
    channels:
      zalo_oa_id: "oa_fashion_001"
      facebook_group_ids:
        - "group_123456"
        - "group_789012"
    content_template:
      post_prefix: "🔥 Deal thời trang hôm nay"
      hashtags: "#thoitrang #deal #shopee"

  - id: electronics
    name: "Điện tử"
    status: draft                  # draft = chưa active
    launched: null
    accesstrade:
      category_ids: [9012, 3456]
    filters:
      min_discount_pct: 20         # Điện tử giảm ít hơn nên threshold thấp hơn
      min_price: 200000
    channels:
      zalo_oa_id: null             # Chưa setup
      facebook_group_ids: []
    content_template:
      post_prefix: "⚡ Deal điện tử"
      hashtags: "#dientuvn #deal #lazada"
```

---

## Trạng thái ngách

| Status | Ý nghĩa |
|---|---|
| `active` | Đang sync + phân phối |
| `draft` | Đã cấu hình nhưng chưa chạy |
| `paused` | Tạm dừng (giữ data cũ) |
| `archived` | Đã ngừng, không sync thêm |

---

## Quy trình thêm ngách mới

1. Tìm category ID tương ứng trên AccessTrade dashboard
2. Thêm block mới vào `config/niches.yaml` với `status: draft`
3. Tạo kênh Zalo OA / Facebook Group cho ngách đó
4. Test bằng cách chạy sync thủ công 1 lần
5. Đổi `status: active` → hệ thống tự động chạy
