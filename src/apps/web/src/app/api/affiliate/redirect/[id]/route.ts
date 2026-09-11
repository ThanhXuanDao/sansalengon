import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VALID_SOURCES = new Set(["website", "zalo", "facebook", "direct"])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id },
    select: { shopeeUrl: true, affiliateUrl: true, isSoldOut: true },
  })

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const rawSource = request.nextUrl.searchParams.get("src") ?? "website"
  const source = VALID_SOURCES.has(rawSource) ? rawSource : "website"
  const referer = request.headers.get("referer") ?? undefined

  // Fire-and-forget — không block redirect
  prisma.clickLog
    .create({ data: { productId: id, source, referer } })
    .catch(() => {})

  // Ưu tiên affiliateUrl (Shopee short link có tracking) — fallback về shopeeUrl
  const destination = product.affiliateUrl || product.shopeeUrl
  return NextResponse.redirect(destination, { status: 302 })
}
