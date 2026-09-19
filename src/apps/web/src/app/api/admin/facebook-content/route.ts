import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { getActiveNiches, getNiche } from "@/lib/niches"
import { generatePostVariants } from "@/lib/claude"
import { pollinationsUrl } from "@/lib/image-generator"

const HASHTAGS: Record<string, string> = {
  fashion: "#thờitrang #deal #shopee #giảmgiá",
  electronics: "#điệntử #công nghệ #deal #shopee",
  home: "#nhàcửa #nộithất #deal #shopee",
  beauty: "#làmđẹp #skincare #deal #shopee",
  food: "#thựcphẩm #ẩmthực #deal #shopee",
  baby: "#mẹvàbé #baby #deal #shopee",
}

const PREFIX: Record<string, string> = {
  fashion: "👗 Deal thời trang siêu hot hôm nay!",
  electronics: "📱 Công nghệ giảm giá không thể bỏ qua!",
  home: "🏠 Đồ gia dụng ưu đãi hôm nay!",
  beauty: "💄 Deal làm đẹp đỉnh của đỉnh!",
  food: "🛒 Thực phẩm tươi ngon giá tốt!",
  baby: "👶 Mẹ & Bé — deal yêu thương mỗi ngày!",
}

function fmtPrice(price: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price)
}

function generatePost(p: {
  id: string
  name: string
  price: number
  discountPct: number | null
  imageUrl: string | null
  rating: number | null
}, nicheId: string, siteUrl: string): string {
  const prefix = PREFIX[nicheId] ?? "🔥 Deal hôm nay không thể bỏ qua!"
  const hashtags = HASHTAGS[nicheId] ?? "#deal #shopee"
  const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price
  const redirectUrl = `${siteUrl}/api/affiliate/redirect/${p.id}?src=facebook`

  return [
    prefix,
    "",
    `📦 ${p.name}`,
    p.discountPct
      ? `💰 Giá sale: ${fmtPrice(salePrice)} (giảm ${p.discountPct}% — gốc ${fmtPrice(p.price)})`
      : `💰 Giá: ${fmtPrice(p.price)}`,
    p.rating && p.rating > 0 ? `⭐ ${p.rating.toFixed(1)}/5` : null,
    "",
    `👉 Mua ngay: ${redirectUrl}`,
    "",
    hashtags,
  ]
    .filter((l): l is string => l !== null)
    .join("\n")
}

// GET /api/admin/facebook-content?niche=<id>
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const nicheId = searchParams.get("niche")
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

  const NICHES = await getActiveNiches()
  const targetNiches = nicheId ? [await getNiche(nicheId)].filter(Boolean) : NICHES
  if (targetNiches.length === 0) {
    return NextResponse.json({ error: "Niche not found" }, { status: 404 })
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const results = await Promise.all(
    targetNiches.map(async (niche) => {
      const [rawProducts, clickCounts] = await Promise.all([
        prisma.product.findMany({
          where: { isSoldOut: false, discountPct: { gte: 10 }, categoryId: niche!.categorySlug },
          select: { id: true, name: true, price: true, discountPct: true, imageUrl: true, rating: true },
          orderBy: { discountPct: "desc" },
          take: 20,
        }),
        prisma.clickLog.groupBy({
          by: ["productId"],
          where: { clickedAt: { gte: since } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 20,
        }),
      ])

      const clickMap = new Map(clickCounts.map((c) => [c.productId, c._count.id]))
      const maxClicks = Math.max(1, ...clickMap.values())

      const scored = rawProducts
        .map((p) => ({
          ...p,
          // Score = discount×0.45 + click×0.30 + rating×0.25 (max 100 pts)
          score:
            (p.discountPct ?? 0) * 0.45 +
            ((clickMap.get(p.id) ?? 0) / maxClicks) * 100 * 0.30 +
            ((p.rating ?? 0) / 5) * 100 * 0.25,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)

      const products = await Promise.all(
        scored.map(async (p) => {
          const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price
          const redirectUrl = `${siteUrl}/api/affiliate/redirect/${p.id}?src=facebook`
          const templatePost = generatePost(p, niche!.id, siteUrl)
          const { variants, model } = await generatePostVariants(
            { name: p.name, price: p.price, salePrice, discountPct: p.discountPct, rating: p.rating, redirectUrl },
            niche!.id,
            templatePost,
          )
          const dealImageUrl = pollinationsUrl(
            `${p.name} sale giảm ${p.discountPct ?? 0}% thương mại điện tử Việt Nam promotional banner`,
            1200, 630,
          )
          return {
            id: p.id,
            name: p.name,
            price: p.price,
            discountPct: p.discountPct,
            imageUrl: p.imageUrl,
            rating: p.rating,
            postText: variants[0],
            postVariants: variants,
            postModel: model,
            dealImageUrl,
          }
        })
      )

      return {
        nicheId: niche!.id,
        nicheName: niche!.name,
        nicheEmoji: niche!.emoji,
        products,
      }
    })
  )

  return NextResponse.json({ niches: results })
}
