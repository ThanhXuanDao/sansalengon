import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ChevronRight, Clock, Calendar, BookOpen, Tag, ShoppingBag } from "lucide-react"
import { NICHES } from "@/lib/niches"
import { getPost, getAllPosts, getRelatedPosts } from "@/lib/blog"
import { POST_LOADERS } from "@/content/blog"
import ReadingProgress from "@/components/blog/ReadingProgress"
import CopyLinkButton from "@/components/blog/CopyLinkButton"
import MobileArticleBar from "@/components/blog/MobileArticleBar"

const Navbar = dynamic(() => import("@/components/layout/Navbar"))
const Footer = dynamic(() => import("@/components/layout/Footer"))

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sansalengon.vn").replace(/\/$/, "")

interface Props {
  params: Promise<{ niche: string; slug: string }>
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ niche: p.niche, slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { niche: nicheId, slug } = await params
  const post = getPost(nicheId, slug)
  const niche = NICHES.find((n) => n.id === nicheId)
  if (!post || !niche) return {}
  return {
    title: `${post.title} | Blog ${niche.name} | SanSaleNgon`,
    description: post.description,
    keywords: post.tags.join(", "),
    alternates: { canonical: `${BASE_URL}/${nicheId}/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      images: post.coverImage ? [{ url: post.coverImage, width: 1200, height: 630 }] : [],
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
      url: `${BASE_URL}/${nicheId}/blog/${slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { niche: nicheId, slug } = await params

  const post = getPost(nicheId, slug)
  const niche = NICHES.find((n) => n.id === nicheId)
  if (!post || !niche) notFound()

  const loaderKey = `${nicheId}/${slug}`
  const loader = POST_LOADERS[loaderKey]
  if (!loader) notFound()

  const { default: PostContent } = await loader()
  const related = getRelatedPosts(nicheId, slug, 3)

  const postUrl = `${BASE_URL}/${nicheId}/blog/${slug}`

  const publishedDate = new Date(post.date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    image: post.coverImage,
    keywords: post.tags.join(", "),
    author: { "@type": "Organization", name: "SanSaleNgon" },
    publisher: { "@type": "Organization", name: "SanSaleNgon", url: BASE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* Progress bar at very top */}
      <ReadingProgress />

      {/* Sticky bottom bar — mobile only, slides up after 120px scroll */}
      <MobileArticleBar
        nicheId={nicheId}
        nicheName={niche.name}
        postTitle={post.title}
        postUrl={postUrl}
      />

      {/* Navbar */}
      <Navbar />

      <div className="min-h-screen bg-[#f4f4f1]">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        {post.coverImage ? (
          <div className="relative w-full overflow-hidden"
            style={{ height: "clamp(260px, 45vw, 440px)" }}
          >
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
              fetchPriority="high"
            />
            {/* Stronger gradient on mobile for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c1b]/95 via-[#1a1c1b]/40 to-[#1a1c1b]/10" />

            <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-6 md:pb-10">
              {/* Breadcrumb — hidden on smallest screens, visible from sm */}
              <nav className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-white/50 mb-3 flex-wrap">
                <Link href="/" className="hover:text-white/80 transition-colors">Trang chủ</Link>
                <ChevronRight className="size-3" />
                <Link href={`/${nicheId}`} className="hover:text-white/80 transition-colors">{niche.name}</Link>
                <ChevronRight className="size-3" />
                <Link href={`/${nicheId}/blog`} className="hover:text-white/80 transition-colors">Blog</Link>
              </nav>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[9px] md:text-[10px] text-[#fdc73a] border border-[#fdc73a]/50 px-1.5 py-0.5 backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Title — responsive clamp */}
              <h1 className="font-mono font-bold text-white leading-tight"
                style={{ fontSize: "clamp(16px, 4vw, 28px)" }}
              >
                {post.title}
              </h1>

              {/* Meta */}
              <div className="flex items-center gap-3 mt-2.5 font-mono text-[10px] md:text-[11px] text-white/55">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {publishedDate}
                </span>
                <span className="text-white/30">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {post.readTime} phút đọc
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* No cover image */
          <div className="bg-[#1a1c1b] pt-20 pb-8 px-4 md:px-8">
            <div className="max-w-4xl mx-auto">
              <nav className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-white/40 mb-4 flex-wrap">
                <Link href="/" className="hover:text-white/70">Trang chủ</Link>
                <ChevronRight className="size-3" />
                <Link href={`/${nicheId}`} className="hover:text-white/70">{niche.name}</Link>
                <ChevronRight className="size-3" />
                <Link href={`/${nicheId}/blog`} className="hover:text-white/70">Blog</Link>
              </nav>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="font-mono text-[10px] text-[#fdc73a] border border-[#fdc73a]/40 px-1.5 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="font-mono font-bold text-white leading-tight"
                style={{ fontSize: "clamp(18px, 5vw, 30px)" }}
              >
                {post.title}
              </h1>
              <div className="flex items-center gap-3 mt-3 font-mono text-[10px] md:text-[11px] text-white/50">
                <span className="flex items-center gap-1"><Calendar className="size-3" />{publishedDate}</span>
                <span className="text-white/30">·</span>
                <span className="flex items-center gap-1"><Clock className="size-3" />{post.readTime} phút đọc</span>
              </div>
            </div>
          </div>
        )}

        {/* Mobile breadcrumb — shown below hero on small screens */}
        <div className="sm:hidden bg-white border-b border-[#1a1c1b]/10 px-4 py-2.5 overflow-x-auto">
          <nav className="flex items-center gap-1.5 font-mono text-[10px] text-[#1a1c1b]/50 whitespace-nowrap">
            <Link href={`/${nicheId}/blog`} className="text-[#b51c00] flex items-center gap-1 font-medium">
              <ChevronRight className="size-3 rotate-180" />
              Blog {niche.name}
            </Link>
          </nav>
        </div>

        {/* ── Content + Sidebar ───────────────────────────────────── */}
        {/* pb-20 on mobile reserves space for the sticky bottom bar */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 pb-24 lg:pb-10">
          <div className="flex gap-10 items-start">

            {/* ── Article ─────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Lead / description */}
              <p className="font-mono text-[13px] text-[#1a1c1b]/60 leading-relaxed mb-6 md:mb-8 border-l-4 border-[#fdc73a] pl-4 italic">
                {post.description}
              </p>

              {/* Body */}
              <article className="prose-blog">
                <PostContent />
              </article>

              {/* Tags */}
              <div className="mt-8 md:mt-10 pt-5 border-t border-[#1a1c1b]/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="size-3.5 text-[#1a1c1b]/30 shrink-0" />
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[11px] text-[#5c403a] border border-[#5c403a]/25 px-2 py-1 cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Share row — desktop + large tap targets */}
              <div className="mt-5 flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-[10px] text-[#1a1c1b]/40 uppercase tracking-wider">Chia sẻ:</span>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-2 bg-[#1877f2] text-white hover:bg-[#1877f2]/80 active:scale-95 transition-all"
                >
                  <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  Facebook
                </a>
                <a
                  href={`https://zalo.me/share/url?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-2 bg-[#006af5] text-white hover:bg-[#006af5]/80 active:scale-95 transition-all"
                >
                  <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4C13 4 4 13 4 24c0 5.5 2.2 10.5 5.8 14.2L7 44l6.1-1.6C16.5 44.1 20.1 45 24 45c11 0 20-9 20-20S35 4 24 4z" /></svg>
                  Zalo
                </a>
                <CopyLinkButton />
              </div>

              {/* ── Related posts — mobile: horizontal scroll ──────── */}
              {related.length > 0 && (
                <div className="mt-8 pt-6 border-t border-[#1a1c1b]/10 lg:hidden">
                  <h2 className="font-mono text-[12px] font-bold text-[#1a1c1b] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BookOpen className="size-4 text-[#b51c00]" />
                    Bài viết liên quan
                  </h2>
                  {/* Horizontal scroll on mobile, grid on sm+ */}
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:mx-0">
                    {related.map((r) => (
                      <Link
                        key={r.slug}
                        href={`/${nicheId}/blog/${r.slug}`}
                        className="group shrink-0 w-52 md:w-auto snap-start flex flex-col bg-white border border-[#1a1c1b]/10 hover:border-[#b51c00]/30 hover:bg-[#fffdf5] active:scale-[.98] transition-all"
                      >
                        {r.coverImage && (
                          <div className="w-full aspect-[3/2] overflow-hidden">
                            <img
                              src={r.coverImage}
                              alt=""
                              aria-hidden
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <div className="p-3 flex-1">
                          <p className="font-mono text-[11px] font-bold text-[#1a1c1b] leading-snug line-clamp-3 group-hover:text-[#b51c00] transition-colors">
                            {r.title}
                          </p>
                          <p className="font-mono text-[10px] text-[#1a1c1b]/40 mt-1.5">
                            {r.readTime} phút đọc
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/${nicheId}/blog`}
                    className="inline-block mt-4 font-mono text-[11px] text-[#b51c00] hover:underline"
                  >
                    Tất cả bài viết {niche.name} →
                  </Link>
                </div>
              )}

              {/* Bottom nav */}
              <div className="mt-8 md:mt-10 pt-5 border-t border-[#1a1c1b]/10 flex items-center justify-between gap-3">
                <Link
                  href={`/${nicheId}/blog`}
                  className="font-mono text-[12px] text-[#5c403a] hover:text-[#b51c00] transition-colors flex items-center gap-1 py-1"
                >
                  <ChevronRight className="size-3.5 rotate-180 shrink-0" />
                  <span className="hidden sm:inline">Tất cả bài</span>
                  <span className="sm:hidden">Blog</span>
                </Link>
                <Link
                  href={`/${nicheId}`}
                  className="flex items-center gap-1.5 bg-[#b51c00] text-white font-mono text-[11px] px-4 py-2.5 hover:bg-[#1a1c1b] active:scale-95 transition-all"
                >
                  <ShoppingBag className="size-3.5 shrink-0" />
                  <span>Deal {niche.emoji} {niche.name}</span>
                </Link>
              </div>
            </div>

            {/* ── Sidebar — desktop only ───────────────────────────── */}
            <aside className="hidden lg:block w-[260px] shrink-0 sticky top-24 space-y-5">

              {/* Deal CTA */}
              <div
                className="bg-[#1a1c1b] p-5 text-white"
                style={{ clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)" }}
              >
                <span className="font-mono text-[10px] text-[#fdc73a] uppercase tracking-widest block mb-2">
                  Deal hôm nay
                </span>
                <p className="font-mono text-[13px] font-bold leading-snug mb-4">
                  {niche.emoji} Giảm giá {niche.name} — cập nhật mỗi 4h
                </p>
                <Link
                  href={`/${nicheId}`}
                  className="block text-center bg-[#b51c00] text-white font-mono text-[12px] px-4 py-2.5 hover:bg-[#fdc73a] hover:text-[#1a1c1b] transition-colors"
                >
                  Xem ngay →
                </Link>
              </div>

              {/* Post meta */}
              <div className="bg-white border border-[#1a1c1b]/10 p-4 space-y-3">
                <h3 className="font-mono text-[10px] text-[#1a1c1b]/40 uppercase tracking-widest border-b border-[#1a1c1b]/10 pb-2">
                  Thông tin bài viết
                </h3>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#1a1c1b]/70">
                  <Calendar className="size-3.5 text-[#1a1c1b]/30 shrink-0" />
                  <time dateTime={post.date}>{publishedDate}</time>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#1a1c1b]/70">
                  <Clock className="size-3.5 text-[#1a1c1b]/30 shrink-0" />
                  {post.readTime} phút đọc
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {post.tags.map((tag) => (
                    <span key={tag} className="font-mono text-[9px] text-[#5c403a] border border-[#5c403a]/25 px-1.5 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Related posts */}
              {related.length > 0 && (
                <div className="bg-white border border-[#1a1c1b]/10 p-4">
                  <h3 className="font-mono text-[10px] text-[#1a1c1b]/40 uppercase tracking-widest border-b border-[#1a1c1b]/10 pb-2 mb-3 flex items-center gap-1.5">
                    <BookOpen className="size-3 text-[#b51c00]" />
                    Bài viết liên quan
                  </h3>
                  <div className="space-y-3">
                    {related.map((r) => (
                      <Link
                        key={r.slug}
                        href={`/${nicheId}/blog/${r.slug}`}
                        className="group flex gap-2.5 -mx-1 px-1 py-1 hover:bg-[#fafaf7] transition-colors"
                      >
                        {r.coverImage && (
                          <div className="shrink-0 w-12 h-12 overflow-hidden border border-[#1a1c1b]/10">
                            <img src={r.coverImage} alt="" aria-hidden className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] font-bold text-[#1a1c1b] leading-snug line-clamp-3 group-hover:text-[#b51c00] transition-colors">
                            {r.title}
                          </p>
                          <p className="font-mono text-[9px] text-[#1a1c1b]/40 mt-0.5">{r.readTime} phút</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/${nicheId}/blog`}
                    className="block mt-3 pt-3 border-t border-[#1a1c1b]/10 font-mono text-[10px] text-[#b51c00] hover:underline text-center"
                  >
                    Tất cả bài viết →
                  </Link>
                </div>
              )}

              {/* Share sidebar */}
              <div className="bg-white border border-[#1a1c1b]/10 p-4">
                <h3 className="font-mono text-[10px] text-[#1a1c1b]/40 uppercase tracking-widest border-b border-[#1a1c1b]/10 pb-2 mb-3">
                  Chia sẻ bài viết
                </h3>
                <div className="flex flex-col gap-2">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 font-mono text-[11px] py-2.5 bg-[#1877f2] text-white hover:bg-[#1877f2]/80 transition-colors"
                  >
                    <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                    Chia sẻ Facebook
                  </a>
                  <a
                    href={`https://zalo.me/share/url?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 font-mono text-[11px] py-2.5 bg-[#006af5] text-white hover:bg-[#006af5]/80 transition-colors"
                  >
                    <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4C13 4 4 13 4 24c0 5.5 2.2 10.5 5.8 14.2L7 44l6.1-1.6C16.5 44.1 20.1 45 24 45c11 0 20-9 20-20S35 4 24 4z" /></svg>
                    Chia sẻ Zalo
                  </a>
                  <CopyLinkButton />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
