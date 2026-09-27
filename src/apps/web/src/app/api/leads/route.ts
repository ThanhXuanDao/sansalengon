import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const nicheParam    = searchParams.get("niche")
  const platformParam = searchParams.get("platform")
  const niches    = nicheParam    ? nicheParam.split(",").filter(Boolean)    : []
  const platforms = platformParam ? platformParam.split(",").filter(Boolean) : []
  const sort = searchParams.get("sort") ?? "newest"  // "newest" | "popular"
  const take = Math.min(50, Number(searchParams.get("take") ?? "50"))
  const skip = Number(searchParams.get("skip") ?? "0")

  const where = {
    isActive: true,
    discountType: "lead",
    ...(niches.length    > 0 ? { nicheId:  { in: niches    } } : {}),
    ...(platforms.length > 0 ? { platform: { in: platforms } } : {}),
  }

  const orderBy =
    sort === "popular"
      ? [{ clickCount: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }]

  const [leads, total] = await Promise.all([
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
        imageUrl: true,
        code: true,
        description: true,
        discountValue: true,
        discountType: true,
        minOrderValue: true,
        maxDiscount: true,
        affiliateUrl: true,
        expiresAt: true,
        clickCount: true,
        terms: true,
      },
    }),
    prisma.coupon.count({ where }),
  ])

  return NextResponse.json({ data: leads, total })
}
