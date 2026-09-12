import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"
import { NICHES } from "@/lib/niches"
import { generateNicheSeo, getNicheSeoFromCache } from "@/lib/seo-generator"

// GET — trạng thái SEO cache cho tất cả niches
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const statuses = await Promise.all(
    NICHES.map(async (niche) => {
      const cached = await getNicheSeoFromCache(niche)
      return {
        id: niche.id,
        name: niche.name,
        emoji: niche.emoji,
        hasAiMeta: !!cached,
        cached,
        templateTitle: `${niche.emoji} Deal ${niche.name} hôm nay — giảm giá sâu nhất`,
        templateDesc: niche.description,
      }
    })
  )

  return NextResponse.json({
    aiAvailable: !!process.env.ANTHROPIC_API_KEY,
    niches: statuses,
  })
}

// POST — trigger generation
// body: { target: "niche", nicheId: string } | { target: "all_niches" }
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { target, nicheId } = body as { target: string; nicheId?: string }

  if (target === "niche") {
    if (!nicheId) return NextResponse.json({ error: "nicheId required" }, { status: 400 })
    const niche = NICHES.find((n) => n.id === nicheId)
    if (!niche) return NextResponse.json({ error: "Unknown niche" }, { status: 400 })

    const topProducts = await prisma.product.findMany({
      where: { category: { slug: niche.categorySlug }, isSoldOut: false },
      select: { name: true, discountPct: true, price: true },
      orderBy: { discountPct: "desc" },
      take: 5,
    })

    const result = await generateNicheSeo(niche, topProducts)
    return NextResponse.json({ ok: true, niche: niche.id, result })
  }

  if (target === "all_niches") {
    const results = await Promise.allSettled(
      NICHES.map(async (niche) => {
        const topProducts = await prisma.product.findMany({
          where: { category: { slug: niche.categorySlug }, isSoldOut: false },
          select: { name: true, discountPct: true, price: true },
          orderBy: { discountPct: "desc" },
          take: 5,
        })
        const result = await generateNicheSeo(niche, topProducts)
        return { niche: niche.id, result }
      })
    )

    const summary = results.map((r, i) => ({
      niche: NICHES[i].id,
      status: r.status,
      model: r.status === "fulfilled" ? r.value.result.model : "error",
      error: r.status === "rejected" ? String(r.reason) : undefined,
    }))

    return NextResponse.json({ ok: true, summary })
  }

  return NextResponse.json({ error: "Unknown target" }, { status: 400 })
}
