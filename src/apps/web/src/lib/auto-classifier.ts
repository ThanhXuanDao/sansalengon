/**
 * AI-powered product auto-classification.
 * Zero-shot: given a product name, classify it into the correct niche slug.
 * Respects the post_generation feature flag.
 */

import { getProviderForTask, isFeatureEnabled } from "./ai-config"

export interface ClassificationResult {
  productId: string
  productName: string
  suggestedNicheId: string
  suggestedNicheName: string
  confidence: number // 0.0–1.0
  reasoning: string
  model: string
}

interface Niche {
  id: string
  name: string
}

const buildSystemPrompt = (niches: Niche[]) =>
  `You are a product categorization expert for a Vietnamese e-commerce affiliate website.
Given a product name, classify it into exactly one of these niches:
${niches.map((n) => `- ${n.id}: ${n.name}`).join("\n")}

Respond with ONLY a JSON object:
{"nicheId":"<id>","nicheName":"<name>","confidence":<0.0-1.0>,"reasoning":"<one sentence>"}`

export async function classifyProduct(
  productId: string,
  productName: string,
  niches: Niche[],
): Promise<ClassificationResult | null> {
  if (niches.length === 0) return null

  const enabled = await isFeatureEnabled("post_generation")
  if (!enabled) return null

  try {
    const provider = await getProviderForTask("post_generation")
    const raw = await provider.generateText(
      `Classify this product:\n"${productName.slice(0, 300)}"`,
      {
        systemPrompt: buildSystemPrompt(niches),
        maxTokens: 150,
        temperature: 0,
      },
    )

    const json = JSON.parse(raw.trim()) as {
      nicheId: string
      nicheName: string
      confidence: number
      reasoning: string
    }

    if (!niches.some((n) => n.id === json.nicheId)) return null

    return {
      productId,
      productName,
      suggestedNicheId: json.nicheId,
      suggestedNicheName: json.nicheName,
      confidence: Math.max(0, Math.min(1, Number(json.confidence) || 0.5)),
      reasoning: json.reasoning ?? "",
      model: provider.id,
    }
  } catch {
    return null
  }
}

export async function classifyBatch(
  products: { id: string; name: string }[],
  niches: Niche[],
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = []
  for (const p of products) {
    const r = await classifyProduct(p.id, p.name, niches).catch(() => null)
    if (r) results.push(r)
  }
  return results
}
