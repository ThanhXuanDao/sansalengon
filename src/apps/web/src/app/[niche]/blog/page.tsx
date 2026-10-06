import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { BookOpen, Clock } from "lucide-react"
import Breadcrumb from "@/components/ui/Breadcrumb"
import { getActiveNiches } from "@/lib/niches"
import { getPostsByNicheDb } from "@/lib/blog-db"
import FormattedDate from "@/components/ui/FormattedDate"

const Navbar = dynamic(() => import("@/components/layout/Navbar"))
const Footer = dynamic(() => import("@/components/layout/Footer"))

export const revalidate = 300

interface Props {
  params: Promise<{ niche: string }>
}

export async function generateStaticParams() {
  try {
    const niches = await getActiveNiches()
    return niches.map((n) => ({ niche: n.id }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const NICHES = await getActiveNiches()
  const { niche: nicheId } = await params
  const niche = NICHES.find((n) => n.id === nicheId)
  if (!niche) return {}
  return {
    title: `Blog ${niche.name} — Mẹo mua sắm & Review sản phẩm | SanSaleNgon`,
    description: `Bài viết chuyên sâu về ${niche.name.toLowerCase()} — review thực tế, mẹo mua sắm thông minh và deal tốt nhất trên Shopee.`,
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://sansalengon.com"}/${nicheId}/blog`,
    },
  }
}

type Post = { slug: string; title: string; description: string; coverImage?: string | null; tags: string[]; readTime: number; date: string }

function CategoryBadge({ tag }: { tag: string }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-widest text-site-red border border-site-red/40 px-1.5 py-0.5">
      {tag}
    </span>
  )
}

function PostMeta({ post }: { post: Post }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] text-site-ink/40">
      <FormattedDate date={post.date} />
      <span>·</span>
      <span className="flex items-center gap-0.5">
        <Clock className="size-3" />
        {post.readTime} phút
      </span>
    </div>
  )
}

/** Hero — bài đầu tiên, full width, ảnh lớn bên trái */
function HeroPost({ post, nicheId }: { post: Post; nicheId: string }) {
  return (
    <Link
      href={`/${nicheId}/blog/${post.slug}`}
      className="group block"
    >
      <div className="flex flex-col md:flex-row border border-site-sand hover:border-[color-mix(in_oklab,var(--ring)_50%,transparent)] transition-colors">
        {post.coverImage ? (
          <div className="relative md:w-[55%] aspect-[16/9] md:aspect-auto min-h-[220px] overflow-hidden border-b md:border-b-0 md:border-r border-site-sand">
            <img src={post.coverImage} alt="" aria-hidden className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        ) : (
          <div className="md:w-[55%] min-h-[180px] bg-site-cream border-b md:border-b-0 md:border-r border-site-sand flex items-center justify-center">
            <BookOpen className="size-12 text-site-red/15" />
          </div>
        )}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white bg-site-red px-2 py-0.5">
                NỔI BẬT
              </span>
              {post.tags[0] && <CategoryBadge tag={post.tags[0]} />}
            </div>
            <h2 className="font-mono text-[20px] md:text-[24px] font-bold text-site-ink leading-tight group-hover:text-[color-mix(in_oklab,var(--ring)_70%,var(--color-site-ink))] transition-colors">
              {post.title}
            </h2>
            {post.description && (
              <p className="font-mono text-[12px] text-site-ink/55 line-clamp-3 leading-relaxed">
                {post.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-site-sand">
            <PostMeta post={post} />
            <span className="font-mono text-[11px] text-site-ink/40 group-hover:text-[color-mix(in_oklab,var(--ring)_80%,transparent)] group-hover:underline transition-colors">
              Đọc ngay →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Strip — 3 bài nhỏ ngang nhau bên trên hoặc dưới hero */
function StripCard({ post, nicheId }: { post: Post; nicheId: string }) {
  return (
    <Link
      href={`/${nicheId}/blog/${post.slug}`}
      className="group flex flex-col"
    >
      <div className="flex flex-col flex-1 border border-site-sand hover:border-[color-mix(in_oklab,var(--ring)_50%,transparent)] transition-colors">
      {post.coverImage ? (
        <div className="relative aspect-[16/9] overflow-hidden border-b border-site-sand">
          <img src={post.coverImage} alt="" aria-hidden className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-site-cream border-b border-site-sand flex items-center justify-center">
          <BookOpen className="size-6 text-site-red/15" />
        </div>
      )}
      <div className="p-3 flex flex-col gap-2 bg-white flex-1">
        {post.tags[0] && <CategoryBadge tag={post.tags[0]} />}
        <p className="font-mono text-[12px] font-bold text-site-ink leading-snug line-clamp-2 group-hover:text-[color-mix(in_oklab,var(--ring)_70%,var(--color-site-ink))] transition-colors">
          {post.title}
        </p>
        <PostMeta post={post} />
      </div>
      </div>
    </Link>
  )
}

/** Feed item — list dọc bên trái của 2-col layout */
function FeedItem({ post, nicheId }: { post: Post; nicheId: string }) {
  return (
    <Link
      href={`/${nicheId}/blog/${post.slug}`}
      className="group flex gap-3 py-4 border-b border-site-sand last:border-b-0 hover:bg-site-cream/50 -mx-3 px-3 transition-colors"
    >
      {post.coverImage ? (
        <div className="relative w-[100px] aspect-[4/3] shrink-0 overflow-hidden border border-site-sand">
          <img src={post.coverImage} alt="" aria-hidden className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      ) : (
        <div className="w-[100px] aspect-[4/3] shrink-0 bg-site-cream border border-site-sand flex items-center justify-center">
          <BookOpen className="size-5 text-site-red/20" />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {post.tags[0] && <CategoryBadge tag={post.tags[0]} />}
        <p className="font-mono text-[12px] font-bold text-site-ink leading-snug line-clamp-2 group-hover:text-[color-mix(in_oklab,var(--ring)_70%,var(--color-site-ink))] transition-colors">
          {post.title}
        </p>
        <p className="font-mono text-[11px] text-site-ink/50 line-clamp-1 hidden sm:block">
          {post.description}
        </p>
        <PostMeta post={post} />
      </div>
    </Link>
  )
}

/** Sidebar picks — bên phải của 2-col layout */
function SidebarPick({ post, nicheId, large = false }: { post: Post; nicheId: string; large?: boolean }) {
  return (
    <Link
      href={`/${nicheId}/blog/${post.slug}`}
      className="group flex flex-col gap-2"
    >
      {large && (
        post.coverImage ? (
          <div className="relative aspect-[16/9] overflow-hidden border border-site-sand">
            <img src={post.coverImage} alt="" aria-hidden className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-site-cream border border-site-sand flex items-center justify-center">
            <BookOpen className="size-8 text-site-red/15" />
          </div>
        )
      )}
      <div className={large ? "" : "flex gap-2.5"}>
        {!large && (
          post.coverImage ? (
            <div className="relative w-16 aspect-[1/1] shrink-0 overflow-hidden border border-site-sand">
              <img src={post.coverImage} alt="" aria-hidden className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 aspect-[1/1] shrink-0 bg-site-cream border border-site-sand flex items-center justify-center">
              <BookOpen className="size-4 text-site-red/15" />
            </div>
          )
        )}
        <div className="flex-1 min-w-0 space-y-1">
          {post.tags[0] && <CategoryBadge tag={post.tags[0]} />}
          <p className={`font-mono font-bold text-site-ink leading-snug group-hover:text-[color-mix(in_oklab,var(--ring)_70%,var(--color-site-ink))] transition-colors ${large ? "text-[14px] line-clamp-3" : "text-[11px] line-clamp-2"}`}>
            {post.title}
          </p>
          {large && <PostMeta post={post} />}
        </div>
      </div>
    </Link>
  )
}

export default async function NicheBlogListPage({ params }: Props) {
  const NICHES = await getActiveNiches()
  const { niche: nicheId } = await params
  const niche = NICHES.find((n) => n.id === nicheId)
  if (!niche) notFound()

  const posts = await getPostsByNicheDb(nicheId)

  // Phân phối bài theo layout
  const hero       = posts[0]
  const strip      = posts.slice(1, 4)   // 3 bài strip dưới hero
  const feedPosts  = posts.slice(4, 9)   // left feed
  const pickPosts  = posts.slice(1, 5)   // right picks (reuse strip + 1)
  const gridPosts  = posts.slice(9)      // bottom grid

  return (
    <div className="min-h-screen bg-white border-t border-dashed border-border-color">
      <Navbar />

      <main className="w-full max-w-[1320px] mx-auto px-3 sm:px-6 pt-[120px] sm:pt-[160px] pb-16">
        {/* Breadcrumb + header */}
        <Breadcrumb
          items={[
            { label: "Trang chủ", href: "/" },
            { label: `${niche.emoji} ${niche.name}`, href: `/${nicheId}` },
            { label: "Blog" },
          ]}
          className="mb-6"
        />

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="font-mono text-[22px] md:text-[28px] font-bold text-site-ink leading-tight">
              {niche.emoji} {niche.name}
            </h1>
            {posts.length > 0 && (
              <p className="font-mono text-[11px] text-site-ink/40 mt-0.5">{posts.length} bài viết</p>
            )}
          </div>
          <Link
            href={`/${nicheId}`}
            className="shrink-0 inline-flex items-center gap-1.5 bg-site-ink text-site-yellow font-mono text-[11px] px-3 py-2 hover:bg-site-red hover:text-white transition-colors"
          >
            Xem deal {niche.name} →
          </Link>
        </div>

        {/* ── Empty state ── */}
        {posts.length === 0 && (
          <div className="border border-dashed border-site-ink/20 py-24 text-center">
            <BookOpen className="size-8 text-site-ink/20 mx-auto mb-3" />
            <p className="font-mono text-[13px] text-site-ink/40 mb-4">
              Chưa có bài viết nào về {niche.name.toLowerCase()}.
            </p>
            <Link href={`/${nicheId}`} className="inline-block font-mono text-[11px] text-site-red hover:underline">
              ← Xem deal {niche.name}
            </Link>
          </div>
        )}

        {posts.length > 0 && (
          <div className="space-y-8">

            {/* ── Hero ── */}
            {hero && <HeroPost post={hero} nicheId={nicheId} />}

            {/* ── Strip 3 bài ── */}
            {strip.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {strip.map((p) => <StripCard key={p.slug} post={p} nicheId={nicheId} />)}
              </div>
            )}

            {/* ── 2-col: feed trái + picks phải ── */}
            {(feedPosts.length > 0 || pickPosts.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 pt-4 border-t border-site-sand">

                {/* Feed */}
                {feedPosts.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-site-ink/35 mb-4">
                      Bài viết mới
                    </p>
                    <div>
                      {feedPosts.map((p) => <FeedItem key={p.slug} post={p} nicheId={nicheId} />)}
                    </div>
                  </div>
                )}

                {/* Picks sidebar */}
                {pickPosts.length > 0 && (
                  <div className="lg:border-l lg:border-site-sand lg:pl-8">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-site-ink/35 mb-4">
                      Đáng đọc nhất
                    </p>
                    <div className="space-y-5">
                      <SidebarPick post={pickPosts[0]} nicheId={nicheId} large />
                      {pickPosts.slice(1).map((p, i) => (
                        <div key={p.slug}>
                          {i > 0 && <div className="border-t border-site-sand pt-5 -mt-0" />}
                          <SidebarPick post={p} nicheId={nicheId} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Grid dưới ── */}
            {gridPosts.length > 0 && (
              <div className="pt-4 border-t border-site-sand">
                <p className="font-mono text-[10px] uppercase tracking-widest text-site-ink/35 mb-4">
                  Tất cả bài viết
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gridPosts.map((p) => <StripCard key={p.slug} post={p} nicheId={nicheId} />)}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Footer CTA */}
        {posts.length > 0 && (
          <div className="mt-12 p-5 border border-dashed border-site-ink/15 bg-site-cream flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[12px] font-bold text-site-ink">Tìm deal tốt hôm nay?</p>
              <p className="font-mono text-[11px] text-site-ink/50">Hệ thống cập nhật giá tự động mỗi 4 giờ từ Shopee.</p>
            </div>
            <Link
              href={`/${nicheId}`}
              className="shrink-0 bg-site-red text-white font-mono text-[12px] px-5 py-2.5 hover:bg-site-ink transition-colors"
            >
              Xem deal {niche.emoji} {niche.name}
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
