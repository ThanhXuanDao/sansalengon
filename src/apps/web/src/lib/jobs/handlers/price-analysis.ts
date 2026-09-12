import { prisma } from "@/lib/prisma"
import { analyzePricePrediction } from "@/lib/price-prediction"
import type { JobConfig, JobResult, JobError } from "../types"

export async function priceAnalysisHandler(config: JobConfig): Promise<JobResult> {
  const limit = Math.min(Number(config.limit ?? 100), 500)

  // Only analyze products that have enough price history (>= 14 records)
  const candidates = await prisma.product.findMany({
    select: { id: true, name: true },
    where: {
      priceHistory: { some: {} },
    },
    take: limit,
  })

  const total = candidates.length
  if (total === 0) {
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0, summary: "Không có sản phẩm nào có lịch sử giá." }
  }

  let analyzed = 0
  let skipped = 0
  let failed = 0
  const errors: JobError[] = []
  let highConfidence = 0
  let mediumConfidence = 0

  for (const p of candidates) {
    try {
      const result = await analyzePricePrediction(p.id)
      if (!result) { skipped++; continue }
      analyzed++
      if (result.confidence === "high") highConfidence++
      else if (result.confidence === "medium") mediumConfidence++
    } catch (err) {
      failed++
      errors.push({ item: p.name, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    itemsTotal: total,
    itemsSuccess: analyzed,
    itemsFailed: failed,
    summary: `Phân tích ${analyzed}/${total} sản phẩm. ${highConfidence} high confidence, ${mediumConfidence} medium. ${skipped} bỏ qua (thiếu data).`,
    errors: errors.slice(0, 20),
    meta: { analyzed, skipped, highConfidence, mediumConfidence },
  }
}
