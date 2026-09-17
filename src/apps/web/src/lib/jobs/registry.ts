import type { JobDefinition } from "./types"
import { couponExpireHandler } from "./handlers/coupon-expire"
import { embeddingGenHandler } from "./handlers/embedding-gen"
import { autoClassifyHandler } from "./handlers/auto-classify"
import { seoGenHandler } from "./handlers/seo-gen"
import { priceAnalysisHandler } from "./handlers/price-analysis"
import { zaloBroadcastHandler } from "./handlers/zalo-broadcast"
import { productSyncHandler } from "./handlers/product-sync"
import { couponSyncPlatformHandler } from "./handlers/coupon-sync-platform"
import { platformMatchHandler } from "./handlers/platform-match"

// Loaded dynamically from DB — jobs page fetches via /api/admin/niches/manage
// Fallback static list dùng khi DB chưa sẵn sàng
const NICHE_OPTIONS_FALLBACK = [{ value: "all", label: "Tất cả ngách" }]
export const NICHE_OPTIONS = NICHE_OPTIONS_FALLBACK

const PRODUCT_SOURCE_OPTIONS = [
  { value: "all",         label: "Tất cả nguồn (Shopee + Lazada + AccessTrade)" },
  { value: "shopee",      label: "Shopee — Affiliate API hoặc qua AT tracking" },
  { value: "lazada",      label: "Lazada — Affiliate API hoặc qua AT tracking" },
  { value: "accesstrade", label: "AccessTrade — theo campaign (product / app / link)" },
]

const COUPON_SOURCE_OPTIONS = [
  { value: "all", label: "Tất cả nguồn (AccessTrade + Shopee/Tiki/Lazada)" },
  { value: "accesstrade", label: "Chỉ AccessTrade (theo ngách)" },
  { value: "platforms", label: "Chỉ sàn (Shopee / Tiki / Lazada)" },
]

export const JOB_DEFINITIONS: JobDefinition[] = [
  // ── 1. Sync — lấy data từ nguồn ngoài (thứ tự quan trọng: sản phẩm trước, matching sau) ──

  {
    key: "product_sync",
    name: "Đồng bộ sản phẩm",
    description: "Lấy sản phẩm từ 3 đầu mối: Shopee (Affiliate API hoặc qua AT tracking) → Lazada (Affiliate API hoặc qua AT tracking) → AccessTrade (campaign theo loại: product/app/link). Đồng thời upsert danh sách AT campaigns vào DB (xem Admin → AT Campaigns). Cập nhật giá, ghi PriceHistory, dedup theo source+externalId.",
    category: "sync",
    icon: "RefreshCw",
    defaultConfig: { niche: "all", source: "all" },
    configFields: [
      {
        key: "niche",
        label: "Ngách",
        type: "select",
        options: NICHE_OPTIONS,
        description: "Chạy tất cả ngách hoặc chỉ một ngách cụ thể",
      },
      {
        key: "source",
        label: "Nguồn",
        type: "select",
        options: PRODUCT_SOURCE_OPTIONS,
        description: "Chạy tất cả nguồn hoặc chỉ một nguồn cụ thể (dùng để debug hoặc retry)",
      },
    ],
    handler: productSyncHandler,
  },
  {
    key: "coupon_sync",
    name: "Đồng bộ Coupon/Voucher",
    description: "Lấy mã giảm giá từ 2 luồng song song: (1) AccessTrade /v1/vouchers — voucher theo từng ngách, cần ACCESSTRADE_ACCESS_KEY; (2) Platform direct — Shopee Affiliate /v1/vouchers + Tiki Affiliate /raas/v2/vouchers + Lazada Affiliate /affiliate/vouchers, cần API key tương ứng. Dedup theo composite key, deactivate coupon hết hạn.",
    category: "sync",
    icon: "Tag",
    defaultConfig: { sources: "all" },
    configFields: [
      {
        key: "sources",
        label: "Nguồn dữ liệu",
        type: "select",
        options: COUPON_SOURCE_OPTIONS,
        description: "Chọn nguồn nào để đồng bộ coupon/voucher",
      },
    ],
    handler: couponSyncPlatformHandler,
  },
  {
    key: "platform_match",
    name: "Matching đa sàn",
    description: "Ghép sản phẩm Shopee (base) với sản phẩm tương đương trên Tiki và Lazada để so sánh giá. Dùng embedding cosine similarity + token overlap + edit distance. Confidence ≥ 95% → auto-confirm; 85–95% → PENDING (cần duyệt thủ công tại Admin → Matches). Sau khi match, giá các sàn được refresh mỗi 4h30 tự động qua NestJS cron.",
    category: "sync",
    icon: "GitMerge",
    defaultConfig: {},
    configFields: [],
    handler: platformMatchHandler,
  },

  // ── 2. Maintenance — dọn dẹp data ─────────────────────────────────────────

  {
    key: "coupon_expire",
    name: "Hết hạn Coupon",
    description: "Scan toàn bộ coupon có isActive=true, deactivate những cái có expiresAt < now. Không xóa — chỉ set isActive=false để giữ lịch sử. Chạy sau coupon_sync để đảm bảo coupon vừa import không bị expire ngay.",
    category: "maintenance",
    icon: "Ticket",
    defaultConfig: {},
    configFields: [],
    handler: couponExpireHandler,
  },

  // ── 3. AI — xử lý ngữ nghĩa (thứ tự: embedding trước, classify sau) ───────

  {
    key: "embedding_gen",
    name: "Tạo Vector Embedding",
    description: "Sinh vector embedding cho sản phẩm chưa có vector (dùng cho semantic search và platform matching). OpenAI text-embedding-3-small (1536d) hoặc Gemini text-embedding-004 (768d) — tự detect từ env. Chạy sau product_sync để cover sản phẩm mới. Cần OPENAI_API_KEY hoặc GOOGLE_AI_API_KEY.",
    category: "ai",
    icon: "Cpu",
    defaultConfig: { limit: 50 },
    configFields: [
      {
        key: "limit",
        label: "Số sản phẩm xử lý",
        type: "number",
        min: 1,
        max: 200,
        description: "Tối đa 200 sản phẩm mỗi lần chạy để kiểm soát API cost",
      },
    ],
    handler: embeddingGenHandler,
  },
  {
    key: "auto_classify",
    name: "AI Phân loại sản phẩm",
    description: "Dùng AI (zero-shot) phân loại sản phẩm vào đúng Category. Nên chạy SAU embedding_gen vì dùng vector similarity để hỗ trợ phán đoán. Áp dụng kết quả ngay — không cần duyệt thủ công. Chỉ nên chạy sau khi import batch lớn hoặc thêm danh mục mới (tốn token). Cần AI provider và feature flag post_generation enabled.",
    category: "ai",
    icon: "Wand2",
    defaultConfig: { limit: 30 },
    configFields: [
      {
        key: "limit",
        label: "Số sản phẩm xử lý",
        type: "number",
        min: 1,
        max: 100,
        description: "Lấy sản phẩm chưa được phân loại hoặc phân loại sai",
      },
    ],
    handler: autoClassifyHandler,
  },

  // ── 4. Analytics — phân tích từ data đã sync ──────────────────────────────

  {
    key: "price_analysis",
    name: "Phân tích & Dự đoán giá",
    description: "Phân tích PriceHistory 180 ngày của từng sản phẩm, nhóm theo ngày trong tuần, tính ngày nào giá thấp hơn trung bình (statistical, không cần AI). Kết quả hiển thị 'nên mua vào thứ X' trên trang sản phẩm. Cần ít nhất 14 data points — chạy sau product_sync đã chạy ít nhất 2 tuần. Không cần external API.",
    category: "analytics",
    icon: "TrendingDown",
    defaultConfig: { limit: 100 },
    configFields: [
      {
        key: "limit",
        label: "Số sản phẩm phân tích",
        type: "number",
        min: 10,
        max: 500,
        description: "Chỉ phân tích sản phẩm có đủ lịch sử giá",
      },
    ],
    handler: priceAnalysisHandler,
  },

  // ── 5. Content — sinh nội dung từ data đã phân tích ───────────────────────

  {
    key: "seo_gen",
    name: "Tạo SEO Metadata",
    description: "Dùng AI (Claude) lấy top 5 sản phẩm hot nhất của ngách → sinh title và description SEO tối ưu → cache vào AppSetting. Nên chạy SAU price_analysis để top products được score đúng. Cần ANTHROPIC_API_KEY và feature flag seo_generation enabled.",
    category: "content",
    icon: "Search",
    defaultConfig: { niche: "all" },
    configFields: [
      {
        key: "niche",
        label: "Ngách",
        type: "select",
        options: NICHE_OPTIONS,
        description: "Chọn một ngách hoặc chạy cho tất cả",
      },
    ],
    handler: seoGenHandler,
  },

  // ── 6. Broadcast — phân phối ra kênh ngoài (sau cùng) ─────────────────────

  {
    key: "zalo_broadcast",
    name: "Broadcast Zalo OA",
    description: "Query top 5 deal (score = discount×45% + click×30% + rating×25%) → ghép message → POST lên Zalo OA Broadcast API → ghi BroadcastLog. Chạy SAU CÙNG trong ngày sau khi data đã đủ mới. Cần Zalo access token (cấu hình tại Admin → Zalo). ZaloTokenService tự refresh token mỗi thứ Hai 7h.",
    category: "broadcast",
    icon: "MessageCircle",
    defaultConfig: { niche: "all" },
    configFields: [
      {
        key: "niche",
        label: "Ngách",
        type: "select",
        options: NICHE_OPTIONS,
        description: "Lọc deal theo ngách hoặc gửi tất cả deal tốt nhất",
      },
    ],
    handler: zaloBroadcastHandler,
  },
]

export function getJobDefinition(key: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find((j) => j.key === key)
}

// Default config and metadata for upsert into DB
// Default schedules per job key (cron expressions)
export const JOB_DEFAULT_SCHEDULES: Record<string, { cron: string; enabled: boolean }> = {
  // Sync — schedule khớp NestJS @Cron (web job là backup + manual trigger)
  product_sync:   { cron: "*/30 * * * *",  enabled: true  },  // mỗi 30 phút
  coupon_sync:    { cron: "0 6,18 * * *",  enabled: true  },  // 6h & 18h
  platform_match: { cron: "0 2 * * *",     enabled: true  },  // hằng ngày 2h
  // Maintenance
  coupon_expire:  { cron: "0 0 * * *",     enabled: true  },  // daily midnight
  // AI
  embedding_gen:  { cron: "0 4 * * 0",     enabled: false },  // Chủ nhật 4h (sau product_sync 0h)
  auto_classify:  { cron: "",              enabled: false },  // manual only
  // Analytics — 3h để tránh trùng platform_match (2h)
  price_analysis: { cron: "0 3 * * *",     enabled: true  },  // daily 3am
  // Content — sáng để data đã phân tích xong
  seo_gen:        { cron: "0 8 * * 1,4",   enabled: false },  // Thứ 2 & Thứ 5 8h
  // Broadcast — cuối ngày
  zalo_broadcast: { cron: "0 12,20 * * *", enabled: false },  // 12h & 20h
}

export const JOB_SEEDS = JOB_DEFINITIONS.map((j) => {
  const schedule = JOB_DEFAULT_SCHEDULES[j.key] ?? { cron: "", enabled: false }
  return {
    key: j.key,
    name: j.name,
    description: j.description,
    config: JSON.stringify(j.defaultConfig),
    scheduleCron: schedule.cron || null,
    scheduleEnabled: schedule.enabled,
  }
})
