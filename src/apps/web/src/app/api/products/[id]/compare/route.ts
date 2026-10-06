import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, price: true, productUrl: true },
  })

  if (!product) {
    return NextResponse.json({ platforms: [], cheapestPrice: 0, savings: 0 })
  }

  const platformProducts = await prisma.platformProduct.findMany({
    where: { productId: id },
    include: { platform: true },
    orderBy: { currentPrice: "asc" },
  })

  // Include Shopee as the baseline platform entry (from product.price)
  const shopeeEntry = {
    platformId: "shopee",
    platformName: "Shopee",
    platformUrl: product.productUrl,
    currentPrice: product.price,
    originalPrice: null as number | null,
    inStock: true,
    rating: null as number | null,
    lastChecked: null as string | null,
    isCheapest: false,
  }

  const others = platformProducts.map((pp) => ({
    platformId: pp.platformId,
    platformName: pp.platform.name,
    platformUrl: pp.platformUrl,
    currentPrice: pp.currentPrice,
    originalPrice: pp.originalPrice,
    inStock: pp.inStock,
    rating: pp.rating,
    lastChecked: pp.lastChecked.toISOString(),
    isCheapest: false,
  }))

  const all = [shopeeEntry, ...others]

  // Mark cheapest among in-stock entries
  const cheapestPrice = Math.min(
    ...all.filter((e) => e.inStock).map((e) => e.currentPrice),
  )
  all.forEach((e) => {
    e.isCheapest = e.inStock && e.currentPrice === cheapestPrice
  })

  return NextResponse.json({
    productId: id,
    productName: product.name,
    platforms: all,
    cheapestPrice,
    savings:
      all.length > 1
        ? Math.max(...all.map((e) => e.currentPrice)) - cheapestPrice
        : 0,
  })
}
