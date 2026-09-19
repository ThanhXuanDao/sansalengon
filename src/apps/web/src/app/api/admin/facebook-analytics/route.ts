import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { getActiveNiches } from "@/lib/niches"

// GET /api/admin/facebook-analytics?period=7d|30d|all
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

  const where = {
    source: "facebook",
    ...(since ? { clickedAt: { gte: since } } : {}),
  }

  // All facebook clicks in period (lightweight — only select needed fields)
  const allClicks = await prisma.clickLog.findMany({
    where,
    select: { clickedAt: true, productId: true },
  })

  if (allClicks.length === 0) {
    return NextResponse.json({
      totalClicks: 0,
      byNiche: (await getActiveNiches()).map((n) => ({ id: n.id, name: n.name, emoji: n.emoji, clicks: 0 })),
      topProducts: [],
      timeSeries: [],
      period,
    })
  }

  // Time series: aggregate by date (YYYY-MM-DD in Asia/Ho_Chi_Minh)
  const byDate = new Map<string, number>()
  const productClickCount = new Map<string, number>()

  for (const c of allClicks) {
    const key = c.clickedAt.toISOString().slice(0, 10)
    byDate.set(key, (byDate.get(key) ?? 0) + 1)
    productClickCount.set(c.productId, (productClickCount.get(c.productId) ?? 0) + 1)
  }

  // Fill time series gaps so chart is continuous
  const days = period === "all" ? 90 : period === "30d" ? 30 : 7
  const timeSeries: { date: string; clicks: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    timeSeries.push({ date: key, clicks: byDate.get(key) ?? 0 })
  }

  // Top products (fetch product + category info)
  const sortedProducts = [...productClickCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const productIds = sortedProducts.map(([id]) => id)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, imageUrl: true, category: { select: { id: true } } },
  })

  const productMap = new Map(products.map((p) => [p.id, p]))

  // Niche breakdown from product→category mapping
  const NICHES = await getActiveNiches()
  const nicheClickMap = new Map<string, number>(NICHES.map((n) => [n.id, 0]))

  for (const [productId, count] of productClickCount) {
    const product = productMap.get(productId)
    if (!product) continue
    const niche = NICHES.find((n) => n.categorySlug === product.category?.id)
    if (!niche) continue
    nicheClickMap.set(niche.id, (nicheClickMap.get(niche.id) ?? 0) + count)
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

  return NextResponse.json({
    totalClicks: allClicks.length,
    byNiche,
    topProducts,
    timeSeries,
    period,
  })
}
