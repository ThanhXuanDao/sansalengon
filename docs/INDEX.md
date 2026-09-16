# Affiliate System — Index & Routing Guide
*Last updated: 2026-09-13*

---

## Routing guide — "thay đổi X, update file nào?"

| Khi nào | File cần update |
|---|---|
| Thêm/sửa env var | `setup-guide.md` §1 + `deploy-guide.md` §0.2 / A.5 / D.7 / E.2 / Tips |
| Thêm/sửa sync job (API hoặc Web) | `sync-jobs.md` |
| Thêm/sửa ngách (field, sort, status) | `/admin/niches/manage` → `niche-config.md` |
| Sửa cách deploy / docker-compose | `deploy-guide.md` |
| Sửa cách setup lần đầu / API keys | `setup-guide.md` |
| Thêm tính năng mới (implement xong) | `implementation-status.md` |
| Thêm DB model mới | `implementation-status.md` §Database |
| Thay đổi kiến trúc hệ thống (2 app, luồng data) | `architecture.md` |
| Thay đổi tech stack / dependencies | `stack.md` |
| Thêm kênh phân phối mới | `channels.md` |
| Thay đổi business model / dự báo doanh thu | `model.md` |
| Cập nhật lộ trình tháng | `roadmap.md` |
| Cập nhật ước tính chi phí vận hành | `costs.md` |

> **Rule ngắn:** env var → setup + deploy | sync behavior → sync-jobs | niche config → niche-config | new feature → implementation-status

---

## Mỗi file chứa gì

### Operations (vận hành)

| File | Phạm vi | KHÔNG chứa |
|---|---|---|
| [`setup-guide.md`](operations/setup-guide.md) | Cấu hình **lần đầu**: tất cả env vars, DB schema, từng API key (AccessTrade/Shopee/Zalo/AI). Các bước theo thứ tự để hệ thống lên từ con số 0. | Cách deploy lên server |
| [`deploy-guide.md`](operations/deploy-guide.md) | Cách **deploy lên server**: Docker local, Railway, Vercel, VPS PM2, Docker Compose production. Env vars theo từng phương án. | Cách lấy API key |
| [`sync-jobs.md`](operations/sync-jobs.md) | Tất cả jobs: API Jobs (NestJS @Cron), Web Jobs (Admin UI), cơ chế tick, quan hệ giữa hai tầng. AccessTrade auto-discovery campaign. | Cách cấu hình env |
| [`channels.md`](operations/channels.md) | Kênh phân phối: Website, Coupon page, Zalo OA, Facebook, TikTok | Logic sync |
| [`costs.md`](operations/costs.md) | Chi phí vận hành, AI cost breakdown | Setup steps |

### Technical (kỹ thuật)

| File | Phạm vi | KHÔNG chứa |
|---|---|---|
| [`implementation-status.md`](technical/implementation-status.md) | **Danh sách tính năng đã/chưa implement**: backend NestJS, DB models, frontend Next.js, admin, API routes. Cập nhật mỗi khi xong tính năng mới. | Hướng dẫn vận hành |
| [`niche-config.md`](technical/niche-config.md) | Bảng `Niche` DB: tất cả field, ý nghĩa, cách thêm ngách mới qua Admin UI. Shopee keywords, AccessTrade campaign_ids + atKeywords (auto-match). | Business logic |
| [`architecture.md`](technical/architecture.md) | Kiến trúc 2-tier: NestJS API + Next.js Web, luồng data từ nguồn → DB → frontend | Chi tiết implementation |
| [`stack.md`](technical/stack.md) | Tech stack, versions, cấu trúc thư mục | Vận hành |

### Business

| File | Phạm vi |
|---|---|
| [`model.md`](business/model.md) | Mô hình kinh doanh, kênh phân phối, dự báo thu nhập |
| [`roadmap.md`](business/roadmap.md) | Lộ trình theo tháng, milestones |

---

## Navigation nhanh

- **Setup lần đầu** → [setup-guide.md](operations/setup-guide.md)
- **Deploy lên server** → [deploy-guide.md](operations/deploy-guide.md)
- **Tìm hiểu jobs/sync** → [sync-jobs.md](operations/sync-jobs.md)
- **Thêm ngách mới** → [niche-config.md](technical/niche-config.md)
- **Xem đã implement gì** → [implementation-status.md](technical/implementation-status.md) ← đọc đây trước khi hỏi "cái X đã có chưa"
