import Link from "next/link"
import Image from "next/image"
import { Flame } from "lucide-react"
import Breadcrumb, { type BreadcrumbItem } from "@/components/ui/Breadcrumb"
import { getTopDealsDb, type TopDealData } from "@/lib/static-pages-db"
import { getActiveNiches, type NicheConfig } from "@/lib/niches"

interface ContentPageShellProps {
  title: string
  subtitle?: string
  /** "md" = 800px (default), "sm" = 600px cho các trang form/contact */
  width?: "sm" | "md"
  breadcrumb?: BreadcrumbItem[]
  /** Truyền slug hiện tại để bật 3-col layout với 2 sidebar */
  currentSlug?: string
  children: React.ReactNode
}

function formatPrice(n: number) {
  return n.toLocaleString("vi-VN") + "₫"
}

function CategoriesWidget({ niches }: { niches: NicheConfig[] }) {
  if (niches.length === 0) return null
  return (
    <div className="bg-white border border-[site-sand] clip-bevel-sm p-4">
      <p className="text-sm font-bold text-[#222E48] mb-3">Danh mục hot</p>
      <div className="grid grid-cols-2 gap-1.5">
        {niches.map((niche) => (
          <Link
            key={niche.id}
            href={`/${niche.id}`}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors group"
          >
            <span className="text-xl leading-none" aria-hidden="true">{niche.emoji}</span>
            <span className="text-[10px] font-medium text-[#4F586D] group-hover:text-primary text-center leading-tight line-clamp-2">
              {niche.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function DealsWidget({ deals }: { deals: TopDealData[] }) {
  if (deals.length === 0) return null
  return (
    <div className="bg-white border border-[site-sand] clip-bevel-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="size-4 text-secondary shrink-0" aria-hidden="true" />
        <span className="text-sm font-bold text-[#222E48]">Deal nổi bật</span>
      </div>
      <div className="flex flex-col divide-y divide-[site-sand]">
        {deals.map((deal) => (
          <Link
            key={deal.id}
            href={deal.affiliateUrl || deal.productUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="flex gap-2.5 py-2.5 group"
          >
            <div className="relative size-14 shrink-0 rounded-lg overflow-hidden border border-[site-sand] bg-[site-bg]">
              <Image
                src={deal.imageUrl}
                alt={deal.name}
                width={56}
                height={56}
                className="object-cover w-full h-full"
                loading="lazy"
              />
              {deal.discountPct && deal.discountPct > 0 && (
                <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold bg-secondary text-white leading-4">
                  -{deal.discountPct}%
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#222E48] line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                {deal.name}
              </p>
              <p className="text-[13px] font-bold text-secondary mt-1 tabular-nums">
                {formatPrice(deal.price)}
              </p>
              {deal.originalPrice && deal.originalPrice > deal.price && (
                <p className="text-[11px] text-[#4F586D] line-through tabular-nums">
                  {formatPrice(deal.originalPrice)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/"
        className="mt-2 block text-center text-[11px] font-semibold text-primary hover:underline"
      >
        Xem tất cả deals →
      </Link>
    </div>
  )
}

export default async function ContentPageShell({
  title,
  subtitle,
  width = "md",
  breadcrumb,
  currentSlug,
  children,
}: ContentPageShellProps) {
  const withSidebars = !!currentSlug

  const [deals, niches] = withSidebars
    ? await Promise.all([getTopDealsDb(5), getActiveNiches()])
    : [[], []]

  const card = (
    <>
      {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-4" />}
      <div className="bg-white border border-[site-sand] p-8 md:p-12 clip-bevel-2xl">
        <div className="text-center mb-10">
          <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-primary uppercase text-pretty">
            {title}
          </h1>
          {subtitle && (
            <p className="font-mono text-label-mono text-[site-brown] mt-2">
              {subtitle}
            </p>
          )}
          <div className="w-16 h-1 bg-primary mx-auto mt-4" />
        </div>
        {children}
      </div>
    </>
  )

  if (!withSidebars) {
    return (
      <main
        className={`flex-grow w-full ${width === "sm" ? "max-w-[600px]" : "max-w-[800px]"} mx-auto px-4 md:px-8 pt-[120px] sm:pt-[160px] pb-16`}
      >
        {card}
      </main>
    )
  }

  return (
    <div className="flex-grow w-full max-w-[1320px] mx-auto px-4 md:px-6 pt-[120px] sm:pt-[160px] pb-16 flex gap-5 items-start">
      {/* Sidebar trái — Danh mục hot */}
      <aside className="hidden lg:block w-[200px] shrink-0 sticky top-[168px]">
        <CategoriesWidget niches={niches} />
      </aside>

      {/* Nội dung chính */}
      <main className="flex-1 min-w-0">
        {card}
      </main>

      {/* Sidebar phải — Deal nổi bật */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-[168px]">
        <DealsWidget deals={deals} />
      </aside>
    </div>
  )
}
