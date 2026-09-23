import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

// PATCH — toggle isActive or update fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const { id } = await params
    const body = await request.json()

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.merchant !== undefined ? { merchant: body.merchant } : {}),
        ...(body.platform !== undefined ? { platform: body.platform || null } : {}),
        ...(body.code !== undefined ? { code: body.code || null } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.terms !== undefined ? { terms: body.terms || null } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
        ...(body.discountValue !== undefined ? { discountValue: Number(body.discountValue) } : {}),
        ...(body.discountType !== undefined ? { discountType: body.discountType } : {}),
        ...(body.minOrderValue !== undefined ? { minOrderValue: body.minOrderValue ? Number(body.minOrderValue) : null } : {}),
        ...(body.maxDiscount !== undefined ? { maxDiscount: body.maxDiscount ? Number(body.maxDiscount) : null } : {}),
        ...(body.affiliateUrl !== undefined ? { affiliateUrl: body.affiliateUrl } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
      },
    })

    return NextResponse.json({ ok: true, coupon })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const { id } = await params
    await prisma.coupon.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
