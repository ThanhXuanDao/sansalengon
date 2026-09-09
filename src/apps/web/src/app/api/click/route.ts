import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const { allowed } = rateLimit(`click:${ip}`, { max: 30, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const referer = request.headers.get("referer") || request.headers.get("origin")
    if (referer) {
      try {
        const allowedOrigins = [request.headers.get("host") || "localhost:3000"]
        const refUrl = new URL(referer)
        if (!allowedOrigins.some((o) => refUrl.host === o)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: "Invalid referer" }, { status: 400 })
      }
    }

    const { productId } = await request.json()

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Valid productId is required" },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, shopeeUrl: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      )
    }

    await prisma.clickLog.create({
      data: { productId: product.id },
    })

    return NextResponse.json({ shopeeUrl: product.shopeeUrl })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
