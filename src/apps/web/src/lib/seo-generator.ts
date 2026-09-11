import { prisma } from "./prisma"
import { getProviderForTask, isFeatureEnabled } from "./ai-config"
import type { NicheConfig } from "./niches"

const SEO_KEY = {
  nicheTitle: (id: string) => `seo:niche:${id}:title`,
  nicheDesc:  (id: string) => `seo:niche:${id}:description`,
  nicheAt:    (id: string) => `seo:niche:${id}:generatedAt`,
  compareDesc:(id: string) => `seo:compare:${id}:description`,
}

// ── Niche SEO ─────────────────────────────────────────────────────────────────

interface TopProduct { name: string; discountPct: number | null; price: number }

export interface NicheSeoResult {
  title: string
  description: string
  model: "ai" | "template"
  generatedAt?: string
}

export async function generateNicheSeo(
  niche: NicheConfig,
  topProducts: TopProduct[],
): Promise<NicheSeoResult> {
  const templateTitle = `${niche.emoji} Deal ${niche.name} hôm nay — giảm giá sâu nhất`
  const templateDesc  = niche.description

  const productLines = topProducts.slice(0, 5).map((p) => {
    const discount = p.discountPct ? `giảm ${p.discountPct}%` : `${fmtPrice(p.price)}`
    return `- ${p.name} (${discount})`
  }).join("\n")

  const prompt = `Bạn là SEO writer Việt Nam chuyên viết meta tag cho trang affiliate deal. Viết title và description SEO cho trang deal ngách "${niche.name}".

Top sản phẩm hôm nay:
${productLines || "(chưa có sản phẩm)"}

Yêu cầu title (≤60 ký tự):
- Bắt đầu bằng emoji ${niche.emoji}
- Có chứa "${niche.name}" và "giảm giá" hoặc "deal"
- Hấp dẫn, ngắn gọn

Yêu cầu description (140–155 ký tự):
- Tự nhiên như người viết, không cứng nhắc
- Có ít nhất 1 keyword dài (long-tail) về ${niche.name}
- Không sao chép y title
- Kết thúc bằng dấu chấm

Trả về JSON hợp lệ, không giải thích:
{"title":"...","description":"..."}`

  try {
    const provider = await getProviderForTask("seo_meta")
    const raw = (await provider.generateText(prompt, { maxTokens: 300 })).trim()
    const json = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "")
    const parsed = JSON.parse(json) as { title: string; description: string }

    if (!parsed.title || !parsed.description) throw new Error("Invalid response")

    const now = new Date().toISOString()
    await Promise.all([
      prisma.appSetting.upsert({ where: { key: SEO_KEY.nicheTitle(niche.id) }, update: { value: parsed.title }, create: { key: SEO_KEY.nicheTitle(niche.id), value: parsed.title } }),
      prisma.appSetting.upsert({ where: { key: SEO_KEY.nicheDesc(niche.id) }, update: { value: parsed.description }, create: { key: SEO_KEY.nicheDesc(niche.id), value: parsed.description } }),
      prisma.appSetting.upsert({ where: { key: SEO_KEY.nicheAt(niche.id) }, update: { value: now }, create: { key: SEO_KEY.nicheAt(niche.id), value: now } }),
    ])

    return { title: parsed.title, description: parsed.description, model: "ai", generatedAt: now }
  } catch {
    return { title: templateTitle, description: templateDesc, model: "template" }
  }
}

export async function getNicheSeoFromCache(niche: NicheConfig): Promise<NicheSeoResult | null> {
  try {
    const [titleRow, descRow, atRow] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: SEO_KEY.nicheTitle(niche.id) } }),
      prisma.appSetting.findUnique({ where: { key: SEO_KEY.nicheDesc(niche.id) } }),
      prisma.appSetting.findUnique({ where: { key: SEO_KEY.nicheAt(niche.id) } }),
    ])
    if (!titleRow?.value || !descRow?.value) return null
    return {
      title: titleRow.value,
      description: descRow.value,
      model: "ai",
      generatedAt: atRow?.value,
    }
  } catch {
    return null
  }
}

// ── Compare page SEO ──────────────────────────────────────────────────────────

export interface CompareSeoResult {
  description: string
  model: "ai" | "template"
}

export async function getOrGenerateCompareSeo(
  productId: string,
  productName: string,
  nicheName: string,
  discountPct: number | null,
  price: number,
): Promise<CompareSeoResult> {
  const templateDesc = `Tìm giá rẻ nhất cho ${productName} trên Shopee, Lazada và Tiki. So sánh giá tất cả sàn, cập nhật tự động.`

  // Return cached version if available
  const cached = await prisma.appSetting
    .findUnique({ where: { key: SEO_KEY.compareDesc(productId) } })
    .catch(() => null)
  if (cached?.value) return { description: cached.value, model: "ai" }

  // Respect feature flag — don't generate if seo_meta is disabled
  const enabled = await isFeatureEnabled("seo_meta")
  if (!enabled) return { description: templateDesc, model: "template" }

  const discountNote = discountPct ? `đang giảm ${discountPct}%` : `giá hiện tại ${fmtPrice(price)}`
  const prompt = `Viết meta description SEO cho trang so sánh giá sản phẩm Việt Nam.

Sản phẩm: ${productName}
Ngách: ${nicheName}
Tình trạng: ${discountNote}, có mặt trên Shopee, Lazada, Tiki

Yêu cầu:
- 140–155 ký tự
- Tự nhiên, hấp dẫn, nêu được lợi ích so sánh giá
- Có thể đề cập giảm giá hoặc tiết kiệm cụ thể
- Không phải dịch word-for-word tên sản phẩm
- Kết thúc bằng dấu chấm

Chỉ trả về description text thuần, không JSON, không giải thích.`

  try {
    const provider = await getProviderForTask("seo_meta")
    const desc = (await provider.generateText(prompt, { maxTokens: 200 })).trim()
    if (!desc || desc.length < 50) throw new Error("Too short")

    await prisma.appSetting.upsert({
      where:  { key: SEO_KEY.compareDesc(productId) },
      update: { value: desc },
      create: { key: SEO_KEY.compareDesc(productId), value: desc },
    }).catch(() => {}) // fire-and-forget, don't block response

    return { description: desc, model: "ai" }
  } catch {
    return { description: templateDesc, model: "template" }
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price)
}
