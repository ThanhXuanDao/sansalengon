import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST — trigger coupon sync + deactivate expired
export async function POST() {
  try {
    const now = new Date()

    // Deactivate expired coupons
    const { count: deactivated } = await prisma.coupon.updateMany({
      where: { isActive: true, expiresAt: { lt: now } },
      data: { isActive: false },
    })

    // Count active
    const active = await prisma.coupon.count({ where: { isActive: true } })

    return NextResponse.json({
      ok: true,
      count: active,
      deactivated,
      message: `${deactivated} coupon hết hạn đã tắt, ${active} coupon đang hoạt động`,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
