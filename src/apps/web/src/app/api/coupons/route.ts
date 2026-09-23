import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // niche: comma-separated Category IDs (matches Coupon.nicheId), e.g. "food,beauty"
  const nicheParam = searchParams.get("niche")
  const niches = nicheParam ? nicheParam.split(",").filter(Boolean) : []
  // platform: comma-separated SyncSource slugs (matches Coupon.platform), e.g. "shopee,tch"
  const platformParam = searchParams.get("platform")
  const platforms = platformParam ? platformParam.split(",").filter(Boolean) : []
  // type: comma-separated discount types, e.g. "percent,fixed"
  const typeParam = searchParams.get("type")
  const discountTypes = typeParam ? typeParam.split(",").filter(Boolean) : []
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
      ...(niches.length > 0
        ? [{ nicheId: { in: niches } }]
        : []),
      ...(platforms.length > 0 ? [{ platform: { in: platforms } }] : []),
      ...(discountTypes.length > 0 ? [{ discountType: { in: discountTypes } }] : []),
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
        imageUrl: true,
      },
    }),
    prisma.coupon.count({ where }),
  ])

  return NextResponse.json({ data: coupons, total })
}
