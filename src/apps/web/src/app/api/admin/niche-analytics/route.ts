import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { getActiveNiches } from "@/lib/niches"

// GET /api/admin/niche-analytics?period=7d|30d|all&niche=<id>
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "7d"
  const nicheFilter = searchParams.get("niche") ?? undefined

  const since = period === "all"
    ? undefined
    : period === "30d"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const clickWhere = since ? { clickedAt: { gte: since } } : {}

  // Get click counts grouped by productId + source
  const clicksByProduct = await prisma.clickLog.groupBy({
    by: ["productId", "source"],
    where: clickWhere,
    _count: { id: true },
  })

  const NICHES = await getActiveNiches()

  if (clicksByProduct.length === 0) {
    return NextResponse.json({
      niches: NICHES.map((n) => ({
        id: n.id,
        name: n.name,
        emoji: n.emoji,
        totalClicks: 0,
        bySource: { website: 0, zalo: 0, facebook: 0, direct: 0, unknown: 0 },
        topProducts: [],
      })),
      period,
      total: 0,
    })
  }

  const productIds = [...new Set(clicksByProduct.map((c) => c.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, imageUrl: true, category: { select: { slug: true } } },
  })

  const productMap = new Map(products.map((p) => [p.id, p]))

  // Aggregate per niche
  type SourceMap = { website: number; zalo: number; facebook: number; direct: number; unknown: number }
  const nicheStats = new Map<string, { totalClicks: number; bySource: SourceMap; productClicks: Map<string, number> }>()

  for (const niche of NICHES) {
    nicheStats.set(niche.id, {
      totalClicks: 0,
      bySource: { website: 0, zalo: 0, facebook: 0, direct: 0, unknown: 0 },
      productClicks: new Map(),
    })
  }

  for (const row of clicksByProduct) {
    const product = productMap.get(row.productId)
    if (!product) continue
    const nicheId = NICHES.find((n) => n.categorySlug === product.category?.slug)?.id
    if (!nicheId) continue
    if (nicheFilter && nicheId !== nicheFilter) continue

    const stats = nicheStats.get(nicheId)
    if (!stats) continue

    const count = row._count.id
    stats.totalClicks += count

    const src = (row.source ?? "unknown") as keyof SourceMap
    if (src in stats.bySource) {
      stats.bySource[src] += count
    } else {
      stats.bySource.unknown += count
    }

    const prev = stats.productClicks.get(row.productId) ?? 0
    stats.productClicks.set(row.productId, prev + count)
  }

  // Build top products per niche
  const nicheResults = await Promise.all(
    NICHES.filter((n) => !nicheFilter || n.id === nicheFilter).map(async (n) => {
      const stats = nicheStats.get(n.id)!
      const sorted = [...stats.productClicks.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      const topProducts = sorted.map(([id, clicks]) => {
        const p = productMap.get(id)
        return { id, name: p?.name ?? "Deleted", imageUrl: p?.imageUrl ?? null, clicks }
      })

      return {
        id: n.id,
        name: n.name,
        emoji: n.emoji,
        totalClicks: stats.totalClicks,
        bySource: stats.bySource,
        topProducts,
      }
    })
  )

  const total = nicheResults.reduce((sum, n) => sum + n.totalClicks, 0)

  return NextResponse.json({ niches: nicheResults, period, total })
}
