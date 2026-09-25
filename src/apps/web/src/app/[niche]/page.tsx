import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { getActiveNiches, getNiche } from "@/lib/niches"
import { getProductNumberMap } from "@/lib/products-numbering"
import { getPostsByNicheDb } from "@/lib/blog-db"
import { getNicheSeoFromCache } from "@/lib/seo-generator"
import NichePageClient from "./NichePageClient"

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sansalengon.vn").replace(/\/$/, "")

export const revalidate = 1800 // ISR: rebuild mỗi 30 phút

// Tạo static pages cho tất cả niches đang active
export async function generateStaticParams() {
  try {
    const niches = await getActiveNiches()
    return niches.map((n) => ({ niche: n.id }))
  } catch {
    // DB unreachable during build — pages generated on demand at runtime
    return []
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ niche: string }> }
): Promise<Metadata> {
  const { niche: nicheId } = await params
  const niche = await getNiche(nicheId)
  if (!niche) return {}

  // Use AI-generated meta if available, else fall back to template
  const cached = await getNicheSeoFromCache(niche)
  const title = cached?.title ?? `${niche.emoji} Deal ${niche.name} hôm nay — giảm giá sâu nhất`
  const description = cached?.description ?? niche.description

  return {
    title,
    description,
    keywords: niche.metaKeywords,
    alternates: { canonical: `${BASE_URL}/${niche.id}` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${niche.id}`,
      type: "website",
    },
  }
}

export default async function NichePage(
  { params }: { params: Promise<{ niche: string }> }
) {
  const { niche: nicheId } = await params
  const niche = await getNiche(nicheId)
  if (!niche) notFound()

  // SSR: lấy trang đầu tiên để Google crawl được nội dung
  let initialProducts: { data: unknown[]; total: number } = { data: [], total: 0 }
  let initialCoupons: unknown[] = []

  try {
    const [products, numberMap, coupons] = await Promise.all([
      prisma.product.findMany({
        where: { categoryId: niche.categorySlug },
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
      getProductNumberMap(),
      prisma.coupon.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            { OR: [{ nicheId: niche.id }, { nicheId: null }] },
          ],
        },
        orderBy: { discountValue: "desc" },
        take: 6,
        select: {
          id: true, nicheId: true, merchant: true, merchantLogo: true,
          code: true, description: true, discountValue: true, discountType: true,
          minOrderValue: true, maxDiscount: true, affiliateUrl: true, expiresAt: true,
        },
      }),
    ])

    initialProducts = {
      data: products.map((p) => ({ ...p, number: numberMap.get(p.id) ?? 0 })),
      total: await prisma.product.count({ where: { categoryId: niche.categorySlug } }),
    }
    initialCoupons = coupons
  } catch {
    // DB chưa ready — render shell trống, client fetch lại
  }

  // Schema.org ItemList cho Google
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Deal ${niche.name} hôm nay`,
    description: niche.description,
    url: `${BASE_URL}/${niche.id}`,
    numberOfItems: initialProducts.total,
  }

  const blogPosts = (await getPostsByNicheDb(niche.id)).slice(0, 3)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <NichePageClient
        niche={niche}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialProducts={initialProducts as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialCoupons={initialCoupons as any}
        blogPosts={blogPosts}
      />
    </>
  )
}
