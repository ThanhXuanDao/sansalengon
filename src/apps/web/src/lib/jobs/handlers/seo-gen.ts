import { prisma } from "@/lib/prisma"
import { NICHES } from "@/lib/niches"
import { generateNicheSeo } from "@/lib/seo-generator"
import type { JobConfig, JobResult, JobError } from "../types"

export async function seoGenHandler(config: JobConfig): Promise<JobResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0,
      summary: "ANTHROPIC_API_KEY chưa được cấu hình.",
      errors: [{ reason: "ANTHROPIC_API_KEY not set" }],
    }
  }

  const nicheId = String(config.niche ?? "all")
  const targets = nicheId === "all" ? NICHES : NICHES.filter((n) => n.id === nicheId)

  if (targets.length === 0) {
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0, summary: `Không tìm thấy niche: ${nicheId}` }
  }

  let success = 0
  let failed = 0
  const errors: JobError[] = []

  await Promise.allSettled(
    targets.map(async (niche) => {
      try {
        const topProducts = await prisma.product.findMany({
          where: { category: { slug: niche.categorySlug }, isSoldOut: false },
          select: { name: true, discountPct: true, price: true },
          orderBy: { discountPct: "desc" },
          take: 5,
        })
        await generateNicheSeo(niche, topProducts)
        success++
      } catch (err) {
        failed++
        errors.push({ item: niche.name, reason: err instanceof Error ? err.message : String(err) })
      }
    }),
  )

  return {
    itemsTotal: targets.length,
    itemsSuccess: success,
    itemsFailed: failed,
    niche: nicheId,
    summary: `Tạo SEO metadata cho ${success}/${targets.length} ngách.`,
    errors: errors.slice(0, 20),
  }
}
