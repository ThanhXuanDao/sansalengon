import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

// PATCH /api/admin/matches/[id]  body: { action: "confirm" | "reject" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(req)
  if (csrf) return csrf

  const { id } = await params
  const { action } = await req.json()

  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "action must be confirm or reject" }, { status: 400 })
  }

  const match = await prisma.productMatch.findUnique({ where: { id } })
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (action === "reject") {
    await prisma.productMatch.update({ where: { id }, data: { status: "REJECTED" } })
    return NextResponse.json({ ok: true })
  }

  // confirm — create/update PlatformProduct
  await prisma.$transaction([
    prisma.productMatch.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedBy: "admin" },
    }),
    prisma.platformProduct.upsert({
      where: {
        productId_platformId: {
          productId: match.productId,
          platformId: match.platformId,
        },
      },
      update: {
        platformUrl: match.candidateUrl,
        currentPrice: match.candidatePrice ?? 0,
        lastChecked: new Date(),
      },
      create: {
        productId: match.productId,
        platformId: match.platformId,
        platformProductId: match.candidateUrl.slice(-30),
        platformUrl: match.candidateUrl,
        currentPrice: match.candidatePrice ?? 0,
        lastChecked: new Date(),
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
