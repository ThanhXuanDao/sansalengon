import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const revalidate = 60

// GET /api/trending?window=1h|24h — products being clicked right now
// Tries 1h window first; if fewer than 3 results, falls back to 24h
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const forceWindow = searchParams.get("window") // "1h" | "24h"

  const storeSetting = await prisma.appSetting.findUnique({ where: { key: "store_settings" } })
  const storeJson = storeSetting ? JSON.parse(storeSetting.value) as Record<string, unknown> : {}
  const trendingCount = (typeof storeJson.trendingCount === "number" && storeJson.trendingCount > 0)
    ? storeJson.trendingCount
    : 10

  async function queryWindow(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const groups = await prisma.clickLog.groupBy({
      by: ["productId"],
      where: { clickedAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: trendingCount,
    })
    return groups
  }

  let groups = await queryWindow(forceWindow === "24h" ? 24 : 1)
  let windowHours = 1

  // Fallback to 24h if fewer than 3 products trending in the last hour
  if (groups.length < 3 && forceWindow !== "1h") {
    groups = await queryWindow(24)
    windowHours = 24
  }

  if (groups.length === 0) {
    return NextResponse.json({ data: [], windowHours, total: 0 })
  }

  const productIds = groups.map((g) => g.productId)
  const clickMap = new Map(groups.map((g) => [g.productId, g._count.id]))

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isSoldOut: false },
    select: {
      id: true,
      name: true,
      price: true,
      originalPrice: true,
      commission: true,
      discountPct: true,
      imageUrl: true,
      productUrl: true,
      affiliateUrl: true,
      rating: true,
      source: true,
      sourceLogoUrl: true,
      isFeatured: true,
      isSoldOut: true,
      createdAt: true,
      categoryId: true,
      category: { select: { id: true, name: true, emoji: true } },
    },
  })

  // Preserve click-count sort order and attach viewCount
  const sorted = productIds
    .map((id) => {
      const p = products.find((x) => x.id === id)
      if (!p) return null
      return { ...p, viewCount: clickMap.get(id) ?? 0 }
    })
    .filter(Boolean)

  return NextResponse.json({ data: sorted, windowHours, total: sorted.length })
}
