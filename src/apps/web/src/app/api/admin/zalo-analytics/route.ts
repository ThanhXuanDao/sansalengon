import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { getActiveNiches } from "@/lib/niches"

// GET /api/admin/zalo-analytics?period=7d|30d|all
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "7d"

  const since =
    period === "all"
      ? undefined
      : period === "30d"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const clickWhere = {
    source: "zalo",
    ...(since ? { clickedAt: { gte: since } } : {}),
  }

  // Fetch clicks + recent broadcasts in parallel
  const [allClicks, broadcasts] = await Promise.all([
    prisma.clickLog.findMany({
      where: clickWhere,
      select: { clickedAt: true, productId: true },
    }),
    prisma.broadcastLog.findMany({
      where: { channel: "zalo", ...(since ? { sentAt: { gte: since } } : {}) },
      orderBy: { sentAt: "desc" },
      take: 20,
      select: {
        id: true,
        nicheId: true,
        status: true,
        sentAt: true,
        productIds: true,
        messageText: true,
        error: true,
      },
    }),
  ])

  // Build time series (fill all days in range)
  const days = period === "all" ? 90 : period === "30d" ? 30 : 7
  const byDate = new Map<string, number>()
  const productClickCount = new Map<string, number>()

  for (const c of allClicks) {
    const key = c.clickedAt.toISOString().slice(0, 10)
    byDate.set(key, (byDate.get(key) ?? 0) + 1)
    productClickCount.set(c.productId, (productClickCount.get(c.productId) ?? 0) + 1)
  }

  const timeSeries: { date: string; clicks: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    timeSeries.push({ date: key, clicks: byDate.get(key) ?? 0 })
  }

  // Top products
  const sortedProducts = [...productClickCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const productIds = sortedProducts.map(([id]) => id)
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, imageUrl: true, category: { select: { id: true } } },
      })
    : []

  const productMap = new Map(products.map((p) => [p.id, p]))

  // Niche breakdown
  const NICHES = await getActiveNiches()
  const nicheClickMap = new Map<string, number>(NICHES.map((n) => [n.id, 0]))
  for (const [productId, count] of productClickCount) {
    const product = productMap.get(productId)
    if (!product) continue
    const niche = NICHES.find((n) => n.categorySlug === product.category?.id)
    if (niche) nicheClickMap.set(niche.id, (nicheClickMap.get(niche.id) ?? 0) + count)
  }

  const byNiche = NICHES.map((n) => ({
    id: n.id,
    name: n.name,
    emoji: n.emoji,
    clicks: nicheClickMap.get(n.id) ?? 0,
  })).sort((a, b) => b.clicks - a.clicks)

  const topProducts = sortedProducts.map(([id, clicks]) => {
    const p = productMap.get(id)
    return { id, name: p?.name ?? "Deleted", imageUrl: p?.imageUrl ?? null, clicks }
  })

  // Enrich broadcasts with click counts in the 24h window after each send
  const enrichedBroadcasts = await Promise.all(
    broadcasts.map(async (b) => {
      const windowEnd = new Date(b.sentAt.getTime() + 24 * 60 * 60 * 1000)
      const productIdsInBroadcast = JSON.parse(b.productIds) as string[]
      const clicksAfter = await prisma.clickLog.count({
        where: {
          source: "zalo",
          clickedAt: { gte: b.sentAt, lte: windowEnd },
          productId: { in: productIdsInBroadcast },
        },
      })
      return {
        id: b.id,
        nicheId: b.nicheId,
        nicheName: b.nicheId ? (NICHES.find((n) => n.id === b.nicheId)?.name ?? b.nicheId) : "Tất cả",
        nicheEmoji: b.nicheId ? (NICHES.find((n) => n.id === b.nicheId)?.emoji ?? "") : "📢",
        status: b.status,
        sentAt: b.sentAt.toISOString(),
        productCount: productIdsInBroadcast.length,
        clicksAfter24h: clicksAfter,
        error: b.error,
        messagePreview: b.messageText.slice(0, 120),
      }
    })
  )

  return NextResponse.json({
    totalClicks: allClicks.length,
    byNiche,
    topProducts,
    timeSeries,
    broadcasts: enrichedBroadcasts,
    period,
  })
}
