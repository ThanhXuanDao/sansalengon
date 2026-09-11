import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const niche = searchParams.get("niche")
  const platform = searchParams.get("platform")       // "shopee" | "tiki" | "lazada"
  const discountType = searchParams.get("type")       // "percent" | "fixed"
  const sort = searchParams.get("sort") ?? "value"    // "value" | "popular" | "expiring"
  const flashSale = searchParams.get("flash") === "1" // coupons expiring in <24h
  const take = Math.min(50, Number(searchParams.get("take") ?? "20"))
  const skip = Number(searchParams.get("skip") ?? "0")

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    isActive: true,
    AND: [
      {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      ...(niche && niche !== "all"
        ? [{ OR: [{ nicheId: niche }, { nicheId: null }] }]
        : []),
      ...(platform && platform !== "all" ? [{ platform }] : []),
      ...(discountType ? [{ discountType }] : []),
      ...(flashSale
        ? [{ expiresAt: { gt: now, lte: in24h } }]
        : []),
    ],
  }

  const orderBy =
    sort === "popular"
      ? [{ clickCount: "desc" as const }, { discountValue: "desc" as const }]
      : sort === "expiring"
      ? [{ expiresAt: "asc" as const }]
      : [{ discountValue: "desc" as const }, { createdAt: "desc" as const }]

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy,
      take,
      skip,
      select: {
        id: true,
        source: true,
        platform: true,
        nicheId: true,
        merchant: true,
        merchantLogo: true,
        code: true,
        description: true,
        discountValue: true,
        discountType: true,
        minOrderValue: true,
        maxDiscount: true,
        affiliateUrl: true,
        expiresAt: true,
        clickCount: true,
      },
    }),
    prisma.coupon.count({ where }),
  ])

  return NextResponse.json({ data: coupons, total })
}
