import { notFound } from "next/navigation"
import type { Metadata } from "next"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ChevronRight, ExternalLink, TrendingDown, CheckCircle2, ShoppingBag, Tag } from "lucide-react"
import Breadcrumb from "@/components/ui/Breadcrumb"
import { prisma } from "@/lib/prisma"
import { getActiveNiches, getNiche } from "@/lib/niches"
import { formatPrice } from "@/lib/utils"
import { getSiteSettings } from "@/lib/get-site-settings"
import { getOrGenerateCompareSeo } from "@/lib/seo-generator"
import PriceCompareChart from "@/components/compare/PriceCompareChart"

const Navbar = dynamic(() => import("@/components/layout/Navbar"))
const Footer = dynamic(() => import("@/components/layout/Footer"))

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sansalengon.com").replace(/\/$/, "")

export const revalidate = 1800

export async function generateStaticParams() {
  try {
    const [products, niches] = await Promise.all([
      prisma.product.findMany({
        select: { id: true, categoryId: true, category: { select: { id: true } } },
      }),
      getActiveNiches(),
    ])
    const params: { niche: string; slug: string }[] = []
    for (const p of products) {
      const niche = niches.find((n) => n.categorySlug === p.category.id)
      if (niche) params.push({ niche: niche.id, slug: p.id })
    }
    return params
  } catch {
    return []
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ niche: string; slug: string }> },
): Promise<Metadata> {
  const { niche: nicheId, slug } = await params
  const niche = await getNiche(nicheId)
  if (!niche) return {}

  const product = await prisma.product.findUnique({ where: { id: slug }, select: { name: true } }).catch(() => null)
  if (!product) return {}

  const title = `So sánh giá ${product.name} — Shopee vs Lazada vs Tiki`

  // Lazy AI description: generate once and cache in AppSetting
  const productFull = await prisma.product.findUnique({
    where: { id: slug },
    select: { price: true, discountPct: true },
  }).catch(() => null)

  const { description } = await getOrGenerateCompareSeo(
    slug,
    product.name,
    niche.name,
    productFull?.discountPct ?? null,
    productFull?.price ?? 0,
  )

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/${nicheId}/compare/${slug}` },
    openGraph: { title, description, url: `${BASE_URL}/${nicheId}/compare/${slug}`, type: "website" },
  }
}

const PLATFORM_COLORS: Record<string, string> = {
  shopee: "#ee4d2d",
  lazada: "#0f146b",
  tiki:   "#189eff",
  tiktok: "#010101",
}

export default async function ComparePage(
  { params }: { params: Promise<{ niche: string; slug: string }> },
) {
  const { niche: nicheId, slug } = await params
  const niche = await getNiche(nicheId)
  if (!niche) notFound()

  const product = await prisma.product.findUnique({
    where: { id: slug },
    include: { category: true, platformProducts: { include: { platform: true } } },
  }).catch(() => null)

  if (!product) notFound()

  // Build unified platform list: Shopee first (from product.price), then others
  const platforms = [
    {
      platformId: "shopee",
      platformName: "Shopee",
      platformUrl: product.productUrl,
      currentPrice: product.price,
      originalPrice: product.discountPct
        ? Math.round(product.price / (1 - product.discountPct / 100))
        : null,
      inStock: !product.isSoldOut,
      rating: product.rating,
      lastChecked: null as string | null,
    },
    ...product.platformProducts.map((pp) => ({
      platformId: pp.platformId,
      platformName: pp.platform.name,
      platformUrl: pp.platformUrl,
      currentPrice: pp.currentPrice,
      originalPrice: pp.originalPrice,
      inStock: pp.inStock,
      rating: pp.rating,
      lastChecked: pp.lastChecked.toISOString(),
    })),
  ]

  const sorted = [...platforms].sort((a, b) => a.currentPrice - b.currentPrice)
  const inStockPrices = platforms.filter((p) => p.inStock).map((p) => p.currentPrice)
  const cheapestPrice = inStockPrices.length ? Math.min(...inStockPrices) : 0
  const highestPrice = inStockPrices.length ? Math.max(...inStockPrices) : 0
  const savings = highestPrice - cheapestPrice
  const cheapestPlatform = platforms.find((p) => p.inStock && p.currentPrice === cheapestPrice)

  // Schema.org Product with Offers
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.imageUrl,
    offers: platforms.map((p) => ({
      "@type": "Offer",
      url: p.platformUrl,
      price: p.currentPrice.toString(),
      priceCurrency: "VND",
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: p.platformName },
    })),
  }

  const compareUrl = `${BASE_URL}/${nicheId}/compare/${slug}`

  const siteSettings = await getSiteSettings()
  const priceOpts = {
    currencySymbol: siteSettings.currencySymbol || "₫",
    currencyPosition: siteSettings.currencyPosition || "after",
    thousandSeparator: siteSettings.thousandSeparator || ".",
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Navbar />

      <div className="w-full bg-white">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden h-[clamp(220px,38vw,380px)]"
        >
          {/* Product image as background */}
          <img
            src={product.imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-center"
          />

          {/* Gradient overlay — heavier at bottom for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-[site-ink]/95 via-[site-ink]/50 to-[site-ink]/20" />

          {/* Hero content overlaid at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-6 md:pb-10">
            {/* Breadcrumb */}
            <Breadcrumb
              variant="dark"
              items={[
                { label: "Trang chủ", href: "/" },
                { label: niche.name, href: `/${niche.id}` },
                { label: "So sánh giá" },
              ]}
              className="hidden sm:flex mb-3"
            />

            {/* Category tag */}
            <div className="mb-2">
              <span className="font-mono text-[9px] md:text-[10px] text-[site-yellow] border border-[site-yellow]/50 px-1.5 py-0.5 backdrop-blur-sm uppercase tracking-widest">
                {product.category.name}
              </span>
            </div>

            {/* Product name */}
            <h1
              className="font-mono font-bold text-white leading-tight mb-2.5 text-[clamp(15px,3.5vw,26px)]"
            >
              {product.name}
            </h1>

            {/* Savings badge */}
            {savings > 0 && (
              <div className="flex items-center gap-1.5 font-mono text-[11px] md:text-[12px] text-[#6ee7a7]">
                <TrendingDown className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Tiết kiệm tới <strong>{formatPrice(savings, priceOpts)}</strong> khi chọn đúng sàn</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile breadcrumb */}
        <div className="sm:hidden bg-white border-b border-[site-ink]/10 px-4 py-2.5 overflow-x-auto">
          <nav className="flex items-center gap-1.5 font-mono text-[10px] text-[site-ink]/50 whitespace-nowrap">
            <Link href={`/${niche.id}`} className="text-[site-red] flex items-center gap-1 font-medium">
              <ChevronRight className="size-3 rotate-180" />
              Deal {niche.name}
            </Link>
          </nav>
        </div>

        {/* ── Content + Sidebar ─────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 pb-24 lg:pb-10">
          <div className="flex gap-10 items-start">

            {/* ── Main article ────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Price comparison table */}
              <section className="mb-10" aria-label="Bảng so sánh giá">
                <div className="flex items-center gap-3 mb-4 border-b border-dashed border-[site-ink]/15 pb-3">
                  <h2 className="font-mono text-[12px] font-bold text-[site-ink] uppercase tracking-wider">
                    So sánh giá theo sàn
                  </h2>
                  <span className="font-mono text-[10px] text-[site-ink]/35">cập nhật mỗi 4 giờ</span>
                </div>

                <div className="flex flex-col gap-2">
                  {sorted.map((p) => {
                    const isCheapest = p.inStock && p.currentPrice === cheapestPrice
                    const discount = p.originalPrice && p.originalPrice > p.currentPrice
                      ? Math.round((1 - p.currentPrice / p.originalPrice) * 100)
                      : null

                    return (
                      <div
                        key={p.platformId}
                        className={`flex items-center gap-3 md:gap-4 p-3.5 md:p-4 border transition-colors ${
                          isCheapest
                            ? "border-[#1a6e3c] bg-[#edfaf1]"
                            : "border-[site-ink]/12 bg-white"
                        }`}
                      >
                        {/* Platform dot + name */}
                        <div className="flex items-center gap-2 w-24 shrink-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: PLATFORM_COLORS[p.platformId] ?? "#888" }}
                            aria-hidden="true"
                          />
                          <span className="font-mono text-[12px] font-bold text-[site-ink]">{p.platformName}</span>
                        </div>

                        {/* Price bar */}
                        <div className="flex-1 hidden sm:block">
                          <div className="h-1.5 bg-[#e8e8e5] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: highestPrice > 0
                                  ? `${(p.currentPrice / highestPrice) * 100}%`
                                  : "0%",
                                background: PLATFORM_COLORS[p.platformId] ?? "#888",
                                opacity: p.inStock ? 1 : 0.25,
                              }}
                            />
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0">
                          <p
                            className={`font-mono text-base font-bold tabular-nums ${
                              isCheapest ? "text-[#1a6e3c]" : "text-[site-ink]"
                            } ${!p.inStock ? "opacity-35" : ""}`}
                          >
                            {formatPrice(p.currentPrice, priceOpts)}
                          </p>
                          {p.originalPrice && p.originalPrice > p.currentPrice && (
                            <p className="font-mono text-[10px] text-[site-ink]/35 line-through">
                              {formatPrice(p.originalPrice, priceOpts)}
                            </p>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 shrink-0 w-20 justify-end">
                          {discount && (
                            <span className="font-mono text-[10px] font-bold text-white bg-[site-crimson] px-1.5 py-0.5">
                              -{discount}%
                            </span>
                          )}
                          {isCheapest && (
                            <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-[#1a6e3c]">
                              <CheckCircle2 className="size-3" aria-hidden="true" />
                              Rẻ nhất
                            </span>
                          )}
                          {!p.inStock && (
                            <span className="font-mono text-[10px] text-[site-ink]/35">Hết hàng</span>
                          )}
                        </div>

                        {/* CTA */}
                        <a
                          href={p.inStock ? p.platformUrl : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase border shrink-0 transition-colors ${
                            !p.inStock
                              ? "border-[site-ink]/15 text-[site-ink]/25 cursor-default pointer-events-none"
                              : isCheapest
                                ? "border-[#1a6e3c] bg-[#1a6e3c] text-white hover:bg-[#145c32]"
                                : "border-[site-ink] bg-white text-[site-ink] hover:bg-[site-ink] hover:text-white"
                          }`}
                          aria-disabled={!p.inStock}
                        >
                          Mua
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Price history chart */}
              <section className="mb-10" aria-label="Lịch sử giá theo sàn">
                <div className="flex items-center gap-3 mb-4 border-b border-dashed border-[site-ink]/15 pb-3">
                  <h2 className="font-mono text-[12px] font-bold text-[site-ink] uppercase tracking-wider">
                    Lịch sử giá 30 ngày
                  </h2>
                </div>
                <PriceCompareChart
                  productId={product.id}
                  platforms={platforms.map((p) => ({ platformId: p.platformId, platformName: p.platformName }))}
                />
              </section>

              {/* How we compare — editorial note */}
              <div className="mb-8 border-l-4 border-[site-yellow] pl-4">
                <p className="font-mono text-[12px] text-[site-ink]/55 leading-relaxed italic">
                  Giá được cập nhật tự động từ API chính thức của Shopee, Lazada và Tiki mỗi 4 giờ.
                  Chúng tôi không nhận phí để ưu tiên bất kỳ sàn nào — kết quả sắp xếp thuần túy theo giá.
                </p>
              </div>

              {/* Share row */}
              <div className="mt-5 flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-[10px] text-[site-ink]/40 uppercase tracking-wider">Chia sẻ:</span>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(compareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-2 bg-[#1877f2] text-white hover:bg-[#1877f2]/80 active:scale-95 transition-all"
                >
                  <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  Facebook
                </a>
                <a
                  href={`https://zalo.me/share/url?url=${encodeURIComponent(compareUrl)}&title=${encodeURIComponent(`So sánh giá ${product.name}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-2 bg-[#006af5] text-white hover:bg-[#006af5]/80 active:scale-95 transition-all"
                >
                  <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4C13 4 4 13 4 24c0 5.5 2.2 10.5 5.8 14.2L7 44l6.1-1.6C16.5 44.1 20.1 45 24 45c11 0 20-9 20-20S35 4 24 4z" /></svg>
                  Zalo
                </a>
              </div>

              {/* Bottom nav */}
              <div className="mt-8 md:mt-10 pt-5 border-t border-[site-ink]/10 flex items-center justify-between gap-3">
                <Link
                  href={`/${niche.id}`}
                  className="font-mono text-[12px] text-[site-brown] hover:text-[site-red] transition-colors flex items-center gap-1 py-1"
                >
                  <ChevronRight className="size-3.5 rotate-180 shrink-0" />
                  <span className="hidden sm:inline">Tất cả deal</span>
                  <span className="sm:hidden">Deal</span>
                </Link>
                <Link
                  href={`/${niche.id}`}
                  className="flex items-center gap-1.5 bg-[site-red] text-white font-mono text-[11px] px-4 py-2.5 hover:bg-[site-ink] active:scale-95 transition-all"
                >
                  <ShoppingBag className="size-3.5 shrink-0" />
                  <span>Deal {niche.emoji} {niche.name}</span>
                </Link>
              </div>
            </div>

            {/* ── Sidebar — desktop only ───────────────────────────── */}
            <aside className="hidden lg:block w-[260px] shrink-0 sticky top-24 space-y-5">

              {/* Best deal CTA */}
              {cheapestPlatform && (
                <div
                  className="bg-[site-ink] p-5 text-white clip-bevel-tr-lg"
                >
                  <span className="font-mono text-[10px] text-[site-yellow] uppercase tracking-widest block mb-1.5">
                    Giá rẻ nhất hôm nay
                  </span>
                  <p className="font-mono text-[22px] font-bold text-white leading-none mb-1 tabular-nums">
                    {formatPrice(cheapestPrice, priceOpts)}
                  </p>
                  <p className="font-mono text-[11px] text-white/50 mb-4">
                    tại {cheapestPlatform.platformName}
                    {savings > 0 && ` · tiết kiệm ${formatPrice(savings, priceOpts)}`}
                  </p>
                  <a
                    href={cheapestPlatform.platformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-[site-red] text-white font-mono text-[12px] px-4 py-2.5 hover:bg-[site-yellow] hover:text-[site-ink] transition-colors"
                  >
                    Mua tại {cheapestPlatform.platformName}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
              )}

              {/* Platform summary */}
              <div className="bg-white border border-[site-ink]/10 p-4">
                <h3 className="font-mono text-[10px] text-[site-ink]/40 uppercase tracking-widest border-b border-[site-ink]/10 pb-2 mb-3 flex items-center gap-1.5">
                  <Tag className="size-3 text-[site-red]" />
                  Giá trên tất cả sàn
                </h3>
                <div className="space-y-2.5">
                  {sorted.map((p) => {
                    const isCheapest = p.inStock && p.currentPrice === cheapestPrice
                    return (
                      <div key={p.platformId} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: PLATFORM_COLORS[p.platformId] ?? "#888" }}
                            aria-hidden="true"
                          />
                          <span className="font-mono text-[11px] text-[site-ink]/70 truncate">{p.platformName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`font-mono text-[12px] font-bold tabular-nums ${isCheapest ? "text-[#1a6e3c]" : "text-[site-ink]"} ${!p.inStock ? "opacity-35" : ""}`}
                          >
                            {p.inStock ? formatPrice(p.currentPrice, priceOpts) : "Hết hàng"}
                          </span>
                          {isCheapest && (
                            <CheckCircle2 className="size-3 text-[#1a6e3c] shrink-0" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Product meta */}
              <div className="bg-white border border-[site-ink]/10 p-4 space-y-3">
                <h3 className="font-mono text-[10px] text-[site-ink]/40 uppercase tracking-widest border-b border-[site-ink]/10 pb-2">
                  Thông tin sản phẩm
                </h3>
                <div className="flex gap-3 items-start">
                  <img
                    src={product.imageUrl}
                    alt={product.imageAlt}
                    className="w-14 h-14 object-cover border border-[site-ink]/10 shrink-0"
                  />
                  <p className="font-mono text-[11px] text-[site-ink]/70 leading-snug line-clamp-4">
                    {product.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="font-mono text-[9px] text-[site-brown] border border-[site-brown]/25 px-1.5 py-0.5">
                    {product.category.name}
                  </span>
                  <span className="font-mono text-[9px] text-[site-brown] border border-[site-brown]/25 px-1.5 py-0.5">
                    {niche.emoji} {niche.name}
                  </span>
                </div>
              </div>

              {/* Back to niche */}
              <div className="bg-white border border-[site-ink]/10 p-4">
                <h3 className="font-mono text-[10px] text-[site-ink]/40 uppercase tracking-widest border-b border-[site-ink]/10 pb-2 mb-3">
                  Xem thêm deal
                </h3>
                <Link
                  href={`/${niche.id}`}
                  className="block text-center bg-[site-ink] text-white font-mono text-[11px] px-4 py-2.5 hover:bg-[site-red] transition-colors"
                >
                  {niche.emoji} Tất cả deal {niche.name} →
                </Link>
                <Link
                  href={`/${niche.id}/blog`}
                  className="block text-center mt-2 font-mono text-[11px] text-[site-ink]/50 hover:text-[site-red] transition-colors py-1.5 border border-[site-ink]/10 hover:border-[site-red]/30"
                >
                  Blog {niche.name}
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
