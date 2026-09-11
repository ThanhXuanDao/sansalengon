import Anthropic from "@anthropic-ai/sdk"
import { getProviderForTask, getProviderIdForTask, isFeatureEnabled } from "./ai-config"
import { isProviderAvailable } from "./ai-provider"

let _client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set")
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export interface PostVariants {
  variants: string[]
  model: "ai" | "template"
}

/**
 * Generate Facebook/Zalo post variants using Claude Haiku.
 * Returns 3 natural-language variants ready for A/B testing.
 * Falls back to templateFallback if API key is missing or call fails.
 */
export async function generatePostVariants(
  product: {
    name: string
    price: number
    salePrice: number
    discountPct: number | null
    rating: number | null
    redirectUrl: string
  },
  niche: string,
  templateFallback: string,
): Promise<PostVariants> {
  // Check feature flag and whether configured provider has an API key
  const [featureOn, providerId] = await Promise.all([
    isFeatureEnabled("post_generation"),
    getProviderIdForTask("post_generation"),
  ])
  if (!featureOn || !isProviderAvailable(providerId)) {
    return { variants: [templateFallback], model: "template" }
  }

  const ratingLine = product.rating && product.rating > 0
    ? `Đánh giá: ${product.rating.toFixed(1)}/5`
    : ""

  const discountLine = product.discountPct
    ? `Giảm ${product.discountPct}% — gốc ${fmtPrice(product.price)}, sale chỉ còn ${fmtPrice(product.salePrice)}`
    : `Giá: ${fmtPrice(product.price)}`

  const prompt = `Bạn là copywriter affiliate marketing chuyên thị trường Việt Nam. Viết 3 post Facebook/Zalo khác nhau để quảng bá sản phẩm sau. Mỗi post phải:
- Tự nhiên, không quá sales-y
- Dưới 200 từ
- Có emoji phù hợp
- Kết thúc bằng link mua: ${product.redirectUrl}
- Phù hợp ngách: ${niche}

Thông tin sản phẩm:
Tên: ${product.name}
${discountLine}
${ratingLine}

Trả về đúng 3 variant, cách nhau bằng dòng ---`

  try {
    const provider = await getProviderForTask("post_generation")
    const raw = await provider.generateText(prompt, { maxTokens: 800 })
    const variants = raw
      .split(/\n---+\n/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .slice(0, 3)

    if (variants.length === 0) return { variants: [templateFallback], model: "template" }
    return { variants, model: "ai" }
  } catch {
    return { variants: [templateFallback], model: "template" }
  }
}

function fmtPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price)
}
