import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/admin/matches?status=PENDING&platform=lazada
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = (searchParams.get("status") ?? "PENDING") as "PENDING" | "CONFIRMED" | "REJECTED"
  const platformId = searchParams.get("platform") ?? undefined
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = 20

  const where = {
    status,
    ...(platformId ? { platformId } : {}),
  }

  const [matches, total] = await Promise.all([
    prisma.productMatch.findMany({
      where,
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: {
          select: { id: true, name: true, price: true, imageUrl: true },
        },
      },
    }),
    prisma.productMatch.count({ where }),
  ])

  return NextResponse.json({ data: matches, total, page, pages: Math.ceil(total / limit) })
}

// POST /api/admin/matches — manual override (paste URL)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { productId, platformId, candidateUrl, candidateName, candidatePrice } = body

  if (!productId || !platformId || !candidateUrl) {
    return NextResponse.json({ error: "productId, platformId, candidateUrl required" }, { status: 400 })
  }

  const match = await prisma.productMatch.create({
    data: {
      productId,
      platformId,
      candidateUrl,
      candidateName: candidateName ?? null,
      candidatePrice: candidatePrice ?? null,
      confidence: 1.0,
      status: "CONFIRMED",
      confirmedBy: "manual",
    },
  })

  // Immediately create/update PlatformProduct
  await prisma.platformProduct.upsert({
    where: { productId_platformId: { productId, platformId } },
    update: {
      platformUrl: candidateUrl,
      currentPrice: candidatePrice ?? 0,
      lastChecked: new Date(),
    },
    create: {
      productId,
      platformId,
      platformProductId: candidateUrl.slice(-30), // fallback id from URL tail
      platformUrl: candidateUrl,
      currentPrice: candidatePrice ?? 0,
      lastChecked: new Date(),
    },
  })

  return NextResponse.json({ ok: true, matchId: match.id }, { status: 201 })
}
