import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/coupons/counts → { [platform]: count } cho active coupons
// Dùng để render badge "X voucher" trên product card
export async function GET() {
  const now = new Date()

  const rows = await prisma.coupon.groupBy({
    by: ["platform"],
    where: {
      isActive: true,
      discountType: { not: "lead" },
      platform: { not: null },
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    _count: { id: true },
  })

  const counts: Record<string, number> = {}
  for (const row of rows) {
    if (row.platform) counts[row.platform] = row._count.id
  }

  return NextResponse.json(counts, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  })
}
