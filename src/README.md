# Affiliate Deal Aggregator

Hệ thống affiliate marketing tự động: sync deal từ Shopee/AccessTrade → website + Zalo OA + Facebook.

## Cấu trúc

```
src/
├── apps/
│   ├── api/          NestJS backend — sync deal, generate affiliate link, Zalo broadcast
│   └── web/          Next.js frontend — hiển thị deal, admin panel, click tracking
├── packages/
│   └── db/prisma/    Schema database (PostgreSQL)
├── config/
│   └── niches.yaml   Cấu hình ngách — thêm ngách mới ở đây
└── .env.example      Biến môi trường cần thiết
```

## Nguồn code

| Thành phần | Từ repo | Ghi chú |
|---|---|---|
| Shopee Affiliate API client | `cyberskill/sale-noti` | Có retry, circuit breaker, rate limit |
| AccessTrade API client | `cyberskill/sale-noti` | listCampaigns, createTrackingLink |
| Web frontend + Admin | `bayy-kim/shopby` | Next.js 16, click tracking, filter/sort |
| Deal sync job | Mới | Cron mỗi 4h, filter deal tốt |
| Content generator | Mới | Tạo nội dung post tự động |
| Zalo OA broadcast | Mới | Broadcast 9h sáng hàng ngày |
| Prisma schema | Ghép + mở rộng | Thêm Deal, PriceHistory, PostLog, Niche |

## Setup

```bash
cp .env.example .env
# Điền các API key vào .env

pnpm install
pnpm db:migrate
pnpm dev
```

## Thêm ngách mới

Chỉnh sửa `config/niches.yaml`, thêm 1 block mới với `status: active`.  
Không cần sửa code.

## API keys cần có

1. **Shopee Affiliate**: Đăng ký tại https://affiliate.shopee.vn → App Management
2. **AccessTrade**: Đăng ký tại https://accesstrade.vn → API Key trong Publisher dashboard
3. **Zalo OA**: Tạo Official Account → https://developers.zalo.me → lấy Access Token
