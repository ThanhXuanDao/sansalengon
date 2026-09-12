import { prisma } from "@/lib/prisma"
import { classifyBatch } from "@/lib/auto-classifier"
import type { JobConfig, JobResult, JobError } from "../types"

export async function autoClassifyHandler(config: JobConfig): Promise<JobResult> {
  const limit = Math.min(Number(config.limit ?? 30), 100)

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  if (categories.length === 0) {
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0, summary: "Không có danh mục nào trong DB." }
  }

  const products = await prisma.product.findMany({
    select: { id: true, name: true, categoryId: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const total = products.length
  if (total === 0) {
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0, summary: "Không có sản phẩm nào." }
  }

  const results = await classifyBatch(products, categories)

  // Products that couldn't be classified (AI returned null)
  const classifyFailed = total - results.length
  let success = 0
  let applyFailed = 0
  const errors: JobError[] = []

  if (classifyFailed > 0) {
    errors.push({ reason: `${classifyFailed} sản phẩm không thể phân loại (AI unavailable hoặc feature disabled)` })
  }

  for (const r of results) {
    try {
      await prisma.product.update({
        where: { id: r.productId },
        data: { categoryId: r.suggestedNicheId },
      })
      success++
    } catch (err) {
      applyFailed++
      errors.push({ item: r.productName, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  const failed = classifyFailed + applyFailed

  return {
    itemsTotal: total,
    itemsSuccess: success,
    itemsFailed: failed,
    summary: `Phân loại ${success}/${total} sản phẩm thành công (${failed} lỗi).`,
    errors: errors.slice(0, 20),
  }
}
