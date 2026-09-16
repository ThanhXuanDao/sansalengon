import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { BookOpen, ChevronRight } from "lucide-react"
import { getActiveNiches } from "@/lib/niches"
import { getPostsByNiche } from "@/lib/blog"
import PostCard from "@/components/blog/PostCard"
import type { BlogPostMeta } from "@/content/blog"

export const revalidate = 1800

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
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://sansalengon.vn"}/${nicheId}/blog`,
    },
  }
}

function FeaturedPost({ post, nicheId }: { post: BlogPostMeta; nicheId: string }) {
  return (
    <Link
      href={`/${nicheId}/blog/${post.slug}`}
      className="group block border border-[#1a1c1b] bg-white hover:bg-[#fffdf5] transition-colors clip-bevel-tr-xl"
    >
      <div className="flex flex-col md:flex-row">
        {post.coverImage && (
          <div className="relative md:w-[45%] aspect-[16/9] md:aspect-auto overflow-hidden border-b md:border-b-0 md:border-r border-[#1a1c1b]">
            <img
              src={post.coverImage}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute top-3 left-3 bg-[#b51c00] text-white font-mono text-[10px] px-2 py-1 border border-white/20">
              NỔI BẬT
            </span>
          </div>
        )}
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap gap-1 mb-3">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[10px] text-[#5c403a] border border-[#5c403a]/30 px-1.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="font-mono text-[17px] md:text-[20px] font-bold text-[#1a1c1b] leading-tight mb-3 group-hover:text-[#b51c00] transition-colors">
              {post.title}
            </h2>
            <p className="font-mono text-[12px] text-[#1a1c1b]/60 line-clamp-3">
              {post.description}
            </p>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1a1c1b]/10">
            <div className="flex items-center gap-3 font-mono text-[11px] text-[#1a1c1b]/40">
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              <span>·</span>
              <span>{post.readTime} phút đọc</span>
            </div>
            <span className="font-mono text-[11px] text-[#b51c00] group-hover:underline">
              Đọc ngay →
            </span>
          </div>
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

  const posts = getPostsByNiche(nicheId)
  const [featured, ...rest] = posts

  return (
    <div className="min-h-screen bg-[#f4f4f1]">
      {/* Top bar */}
      <div className="bg-[#1a1c1b] text-[#fdc73a] font-mono text-[10px] px-4 py-1.5 text-center tracking-widest uppercase">
        Blog · {niche.emoji} {niche.name} · Mẹo mua sắm thông minh
      </div>

      <main className="px-4 md:px-8 pt-20 pb-16 max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 font-mono text-[11px] text-[#1a1c1b]/40 mb-8 mt-4">
          <Link href="/" className="hover:text-[#b51c00] transition-colors">Trang chủ</Link>
          <ChevronRight className="size-3" />
          <Link href={`/${nicheId}`} className="hover:text-[#b51c00] transition-colors">
            {niche.emoji} {niche.name}
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-[#1a1c1b]/70 font-medium">Blog</span>
        </nav>

        {/* Header */}
        <header className="mb-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="size-5 text-[#b51c00]" />
              <span className="font-mono text-[11px] text-[#b51c00] uppercase tracking-widest">
                Blog
              </span>
            </div>
            <h1 className="font-mono text-[26px] md:text-[32px] font-bold text-[#1a1c1b] leading-tight">
              {niche.emoji} {niche.name}
            </h1>
            <p className="font-mono text-[12px] text-[#1a1c1b]/50 mt-1 max-w-lg">
              Review thực tế, mẹo mua sắm thông minh và hướng dẫn chọn sản phẩm {niche.name.toLowerCase()} tốt nhất.
            </p>
            {posts.length > 0 && (
              <p className="font-mono text-[11px] text-[#1a1c1b]/30 mt-1">
                {posts.length} bài viết
              </p>
            )}
          </div>
          <Link
            href={`/${nicheId}`}
            className="shrink-0 inline-flex items-center gap-1.5 bg-[#1a1c1b] text-[#fdc73a] font-mono text-[11px] px-3 py-2 hover:bg-[#b51c00] hover:text-white transition-colors"
          >
            Xem deal {niche.name} →
          </Link>
        </header>

        {posts.length === 0 ? (
          /* Empty state */
          <div className="border border-dashed border-[#1a1c1b]/20 py-20 text-center">
            <BookOpen className="size-8 text-[#1a1c1b]/20 mx-auto mb-3" />
            <p className="font-mono text-[13px] text-[#1a1c1b]/40 mb-4">
              Chưa có bài viết nào về {niche.name.toLowerCase()}.
            </p>
            <Link
              href={`/${nicheId}`}
              className="inline-block font-mono text-[11px] text-[#b51c00] hover:underline"
            >
              ← Xem deal {niche.name}
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured post */}
            {featured && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-[#1a1c1b]/10" />
                  <span className="font-mono text-[10px] text-[#1a1c1b]/30 uppercase tracking-widest px-2">
                    Bài nổi bật
                  </span>
                  <div className="h-px flex-1 bg-[#1a1c1b]/10" />
                </div>
                <FeaturedPost post={featured} nicheId={nicheId} />
              </section>
            )}

            {/* Rest of posts grid */}
            {rest.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-[#1a1c1b]/10" />
                  <span className="font-mono text-[10px] text-[#1a1c1b]/30 uppercase tracking-widest px-2">
                    Tất cả bài viết
                  </span>
                  <div className="h-px flex-1 bg-[#1a1c1b]/10" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {rest.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-12 p-5 border border-dashed border-[#1a1c1b]/20 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[12px] font-bold text-[#1a1c1b]">
              Tìm deal tốt hôm nay?
            </p>
            <p className="font-mono text-[11px] text-[#1a1c1b]/50">
              Hệ thống cập nhật giá tự động mỗi 4 giờ từ Shopee.
            </p>
          </div>
          <Link
            href={`/${nicheId}`}
            className="shrink-0 bg-[#b51c00] text-white font-mono text-[12px] px-5 py-2.5 hover:bg-[#1a1c1b] transition-colors"
          >
            Xem deal {niche.emoji} {niche.name}
          </Link>
        </div>
      </main>
    </div>
  )
}
