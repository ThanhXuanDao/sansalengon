import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
