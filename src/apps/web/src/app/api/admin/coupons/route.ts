import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET — list all (active + inactive) for admin
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const take = Math.min(100, Number(searchParams.get("take") ?? "30"))
  const skip = Number(searchParams.get("skip") ?? "0")
  const q = searchParams.get("q")?.trim()

  const where = q
    ? {
        OR: [
          { merchant: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [data, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.coupon.count({ where }),
  ])

  return NextResponse.json({ data, total })
}

// POST — create manual coupon
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      merchant, platform, code, description,
      discountValue, discountType, minOrderValue, maxDiscount,
      affiliateUrl, expiresAt,
    } = body

    if (!merchant || !description || !discountValue || !affiliateUrl) {
      return NextResponse.json({ error: "Thiếu trường bắt buộc" }, { status: 400 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        source: "manual",
        platform: platform ?? null,
        merchant: String(merchant),
        code: code ? String(code).toUpperCase().trim() : null,
        description: String(description).slice(0, 200),
        discountValue: Number(discountValue),
        discountType: discountType === "fixed" ? "fixed" : "percent",
        minOrderValue: minOrderValue ? Number(minOrderValue) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        affiliateUrl: String(affiliateUrl),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
    })

    return NextResponse.json({ ok: true, coupon })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
