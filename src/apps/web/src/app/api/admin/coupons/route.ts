import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { matchesQueryWords, normalizeText } from "@/lib/text"

// GET — list all (active + inactive) for admin
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const take = Math.min(100, Number(searchParams.get("take") ?? "25"))
  const skip = Number(searchParams.get("skip") ?? "0")
  const q            = searchParams.get("q")?.trim() || undefined
  const platform     = searchParams.get("platform") || undefined
  const status       = searchParams.get("status") || "all"
  const discountType = searchParams.get("discountType") || "all"
  const sort         = searchParams.get("sort") || "newest"

  const where: Record<string, unknown> = {}
  if (platform)               where.platform     = platform
  if (status === "active")    where.isActive     = true
  if (status === "inactive")  where.isActive     = false
  if (discountType !== "all") where.discountType = discountType

  const orderBy =
    sort === "value"   ? [{ discountValue: "desc" as const }] :
    sort === "expires" ? [{ expiresAt: "asc"  as const }]     :
                         [{ isActive: "desc" as const }, { createdAt: "desc" as const }]

  // Fetch without text filter, apply normalized JS filter for accent-insensitive search
  const all = await prisma.coupon.findMany({ where, orderBy })
  const filtered = q
    ? (() => {
        const qw = normalizeText(q).split(/\s+/).filter(Boolean)
        return all.filter((c) =>
          matchesQueryWords(c.merchant, qw) ||
          matchesQueryWords(c.code ?? "", qw) ||
          matchesQueryWords(c.description, qw)
        )
      })()
    : all

  const total = filtered.length
  const data  = filtered.slice(skip, skip + take)

  return NextResponse.json({ data, total })
}

// POST — create manual coupon
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const body = await request.json()
    const {
      merchant, platform, code, description, terms, imageUrl,
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
        description: String(description).slice(0, 500),
        terms: terms ? String(terms).slice(0, 1000) : null,
        imageUrl: imageUrl ? String(imageUrl) : null,
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
