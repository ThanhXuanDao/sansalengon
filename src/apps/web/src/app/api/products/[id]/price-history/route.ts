import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = request.nextUrl
  const platformParam = searchParams.get("platform") // "all" | platform id | null

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // ── Multi-platform mode ─────────────────────────────────────
  if (platformParam === "all") {
    const rows = await prisma.priceHistory.findMany({
      where: { productId: id, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
      select: { price: true, recordedAt: true, platformId: true },
    })

    // Group by platform; null platformId → "shopee" (legacy rows)
    const byPlatform: Record<string, { price: number; recordedAt: string }[]> = {}
    for (const row of rows) {
      const pid = row.platformId ?? "shopee"
      if (!byPlatform[pid]) byPlatform[pid] = []
      byPlatform[pid].push({ price: row.price, recordedAt: row.recordedAt.toISOString() })
    }

    return NextResponse.json({ data: byPlatform, days: 30 })
  }

  // ── Single-platform (or default Shopee) mode ────────────────
  const platformFilter =
    platformParam && platformParam !== "shopee"
      ? { platformId: platformParam }
      : { platformId: null as null }   // null = legacy Shopee rows

  const history = await prisma.priceHistory.findMany({
    where: { productId: id, recordedAt: { gte: since }, ...platformFilter },
    orderBy: { recordedAt: "asc" },
    select: { price: true, recordedAt: true },
  })

  if (!history.length) {
    return NextResponse.json({ data: [] })
  }

  const prices = history.map((h) => h.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const currentPrice = prices[prices.length - 1]

  return NextResponse.json({
    data: history.map((h) => ({ price: h.price, recordedAt: h.recordedAt.toISOString() })),
    meta: { minPrice, maxPrice, currentPrice, isLowest: currentPrice === minPrice, days: 30 },
  })
}
