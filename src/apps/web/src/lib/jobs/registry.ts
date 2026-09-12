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

const NICHE_OPTIONS = [
  { value: "all", label: "Tất cả ngách" },
  { value: "fashion", label: "👗 Thời trang" },
  { value: "electronics", label: "📱 Điện tử" },
  { value: "home", label: "🏠 Nhà cửa" },
  { value: "beauty", label: "💄 Làm đẹp" },
  { value: "food", label: "🍜 Thực phẩm" },
  { value: "baby", label: "🍼 Mẹ & Bé" },
]

const COUPON_SOURCE_OPTIONS = [
  { value: "all", label: "Tất cả nguồn (AccessTrade + Shopee/Tiki/Lazada)" },
  { value: "accesstrade", label: "Chỉ AccessTrade (theo ngách)" },
  { value: "platforms", label: "Chỉ sàn (Shopee / Tiki / Lazada)" },
]

export const JOB_DEFINITIONS: JobDefinition[] = [
  // ── Sync jobs (lấy data từ nguồn ngoài) ───────────────────────────────────
  {
    key: "product_sync",
    name: "Đồng bộ sản phẩm",
    description: "Lấy sản phẩm mới nhất từ Shopee Affiliate API theo từng ngách. Cập nhật giá, ghi lịch sử, đánh dấu deal nổi bật. Cần SHOPEE_AFFILIATE_APP_ID + APP_SECRET.",
    category: "sync",
    icon: "RefreshCw",
    defaultConfig: { niche: "all" },
    configFields: [
      {
        key: "niche",
        label: "Ngách",
        type: "select",
        options: NICHE_OPTIONS,
        description: "Chạy tất cả ngách hoặc chỉ một ngách cụ thể",
      },
    ],
    handler: productSyncHandler,
  },
  {
    key: "coupon_sync",
    name: "Đồng bộ Coupon/Voucher",
    description: "Lấy mã giảm giá từ AccessTrade (theo ngách) + Shopee/Tiki/Lazada affiliate. Cần API key tương ứng trong .env.",
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
    description: "Tìm sản phẩm tương đương trên Lazada và Tiki để so sánh giá. Dùng AI embedding để ghép nối tự động (confidence ≥ 95% → auto-confirm).",
    category: "sync",
    icon: "GitMerge",
    defaultConfig: {},
    configFields: [],
    handler: platformMatchHandler,
  },
  // ── Maintenance ────────────────────────────────────────────────────────────
  {
    key: "coupon_expire",
    name: "Hết hạn Coupon",
    description: "Tìm và deactivate các coupon đã quá hạn trong database.",
    category: "maintenance",
    icon: "Ticket",
    defaultConfig: {},
    configFields: [],
    handler: couponExpireHandler,
  },
  {
    key: "embedding_gen",
    name: "Tạo Vector Embedding",
    description: "Sinh vector embedding cho sản phẩm chưa có (dùng cho tìm kiếm ngữ nghĩa). Cần OPENAI_API_KEY hoặc GOOGLE_AI_API_KEY.",
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
        description: "Tối đa 200 sản phẩm mỗi lần chạy",
      },
    ],
    handler: embeddingGenHandler,
  },
  {
    key: "auto_classify",
    name: "AI Phân loại sản phẩm",
    description: "Tự động phân loại sản phẩm vào danh mục đúng bằng AI. Áp dụng ngay kết quả phân loại.",
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
        description: "Lấy sản phẩm mới nhất để phân loại",
      },
    ],
    handler: autoClassifyHandler,
  },
  {
    key: "seo_gen",
    name: "Tạo SEO Metadata",
    description: "Dùng AI (Claude) sinh title và description SEO tối ưu cho các ngách sản phẩm.",
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
  {
    key: "price_analysis",
    name: "Phân tích & Dự đoán giá",
    description: "Phân tích lịch sử giá theo ngày trong tuần, tính ngày mua rẻ nhất. Cần ít nhất 14 data points.",
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
        description: "Chỉ phân tích sản phẩm có lịch sử giá",
      },
    ],
    handler: priceAnalysisHandler,
  },
  {
    key: "zalo_broadcast",
    name: "Broadcast Zalo OA",
    description: "Gửi tin nhắn top deal đến followers Zalo Official Account. Cần Zalo access token.",
    category: "broadcast",
    icon: "MessageCircle",
    defaultConfig: { niche: "all" },
    configFields: [
      {
        key: "niche",
        label: "Ngách",
        type: "select",
        options: NICHE_OPTIONS,
        description: "Lọc deal theo ngách hoặc gửi tất cả",
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
  // Sync jobs — schedule khớp với NestJS @Cron (web trigger là backup + manual)
  product_sync:   { cron: "0 */4 * * *",   enabled: true  },  // mỗi 4h
  coupon_sync:    { cron: "0 6,18 * * *",  enabled: true  },  // 6h & 18h
  platform_match: { cron: "0 2 * * *",     enabled: true  },  // hằng ngày 2h
  // Maintenance & AI
  coupon_expire:  { cron: "0 0 * * *",     enabled: true  },  // daily midnight
  embedding_gen:  { cron: "0 3 * * 0",     enabled: false },  // Sunday 3am
  auto_classify:  { cron: "",              enabled: false },  // manual only
  seo_gen:        { cron: "0 8 * * 1,4",   enabled: false },  // Mon & Thu 8am
  price_analysis: { cron: "0 2 * * *",     enabled: true  },  // daily 2am
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
