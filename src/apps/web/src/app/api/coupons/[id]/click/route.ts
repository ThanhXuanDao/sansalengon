import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed } = await rateLimit(`coupon_click:${ip}`, { max: 10, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { id } = await params

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { id: true, affiliateUrl: true, isActive: true },
  })

  if (!coupon || !coupon.isActive) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  // fire-and-forget increment
  prisma.coupon.update({
    where: { id },
    data: { clickCount: { increment: 1 } },
  }).catch(() => {})

  return NextResponse.json({ affiliateUrl: coupon.affiliateUrl })
}
