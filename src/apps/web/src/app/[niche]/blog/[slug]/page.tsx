import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Clock, Calendar, ChevronLeft, ChevronRight, Tag } from "lucide-react"
import Breadcrumb from "@/components/ui/Breadcrumb"
import { getActiveNiches } from "@/lib/niches"
import { getPostDb, getPostsByNicheDb, getRelatedPostsDb } from "@/lib/blog-db"
import { getSiteSettings } from "@/lib/get-site-settings"
import { formatDate } from "@/lib/utils"
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
  try {
    const { getAllPostsDb } = await import("@/lib/blog-db")
    const posts = await getAllPostsDb()
    return posts.map((p) => ({ niche: p.niche, slug: p.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const NICHES = await getActiveNiches()
  const { niche: nicheId, slug } = await params
  const post = await getPostDb(nicheId, slug)
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
  const NICHES = await getActiveNiches()
  const { niche: nicheId, slug } = await params

  const post = await getPostDb(nicheId, slug)
  const niche = NICHES.find((n) => n.id === nicheId)
  if (!post || !niche) notFound()

  const [related, nichePosts, s] = await Promise.all([
    getRelatedPostsDb(nicheId, slug, 6),
    getPostsByNicheDb(nicheId),
    getSiteSettings(),
  ])

  const postUrl = `${BASE_URL}/${nicheId}/blog/${slug}`
  const publishedDate = formatDate(post.date, s.dateFormat || "DD/MM/YYYY")

  const postIndex = nichePosts.findIndex((p) => p.slug === slug)
  const prevPost = postIndex > 0 ? nichePosts[postIndex - 1] : null
  const nextPost = postIndex < nichePosts.length - 1 ? nichePosts[postIndex + 1] : null
  const postPosition = postIndex + 1
  const totalPosts = nichePosts.length

  const editorsPicks = related.slice(0, 3)
  const topReviews = related.slice(3, 6).length > 0 ? related.slice(3, 6) : related.slice(0, 3)

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

      <ReadingProgress />
      <MobileArticleBar
        nicheId={nicheId}
        nicheName={niche.name}
        postTitle={post.title}
        postUrl={postUrl}
      />
      <Navbar />

      <div className="min-h-screen bg-white">
        <div className="pt-[120px] sm:pt-[160px]">
          <div className="max-w-[1320px] mx-auto px-3 sm:px-6 py-6 pb-24 lg:pb-10">

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-8 xl:gap-12 items-start">

              {/* ── Main article column ─────────────────────────────── */}
              <main>
                {/* Breadcrumb */}
                <Breadcrumb
                  items={[
                    { label: "Trang chủ", href: "/" },
                    { label: niche.name, href: `/${nicheId}` },
                    { label: "Blog", href: `/${nicheId}/blog` },
                  ]}
                  className="mb-4"
                />

                {/* Category tag */}
                {post.tags.length > 0 && (
                  <div className="mb-3">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white bg-[site-red] px-2.5 py-1">
                      {post.tags[0]}
                    </span>
                  </div>
                )}

                {/* Title */}
                <h1 className="font-mono font-bold text-[site-ink] leading-tight text-[clamp(20px,3.5vw,34px)] mb-4">
                  {post.title}
                </h1>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 pb-4 border-b border-[site-ink]/10">
                  {post.author && (
                    <span className="font-mono text-[11px] font-bold text-[site-ink] uppercase tracking-wider">
                      {post.author}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-mono text-[11px] text-[site-ink]/50">
                    <Calendar className="size-3.5 shrink-0" />
                    {publishedDate}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-[site-ink]/50">
                    <Clock className="size-3.5 shrink-0" />
                    {post.readTime} phút đọc
                  </span>
                </div>

                {/* Share + post counter row */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  {/* Social share */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[site-ink]/40 uppercase tracking-wider hidden sm:block">
                      Chia sẻ:
                    </span>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 bg-[#1877f2] text-white hover:bg-[#1877f2]/80 active:scale-95 transition-all"
                    >
                      <svg className="size-3 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                      <span className="hidden sm:inline">Facebook</span>
                    </a>
                    <a
                      href={`https://zalo.me/share/url?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 bg-[#006af5] text-white hover:bg-[#006af5]/80 active:scale-95 transition-all"
                    >
                      <svg className="size-3 fill-current shrink-0" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4C13 4 4 13 4 24c0 5.5 2.2 10.5 5.8 14.2L7 44l6.1-1.6C16.5 44.1 20.1 45 24 45c11 0 20-9 20-20S35 4 24 4z" /></svg>
                      <span className="hidden sm:inline">Zalo</span>
                    </a>
                    <CopyLinkButton />
                  </div>

                  {/* Post counter + prev/next */}
                  {totalPosts > 1 && (
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[site-ink]/50">
                      {prevPost && (
                        <Link
                          href={`/${nicheId}/blog/${prevPost.slug}`}
                          className="flex items-center gap-1 text-[site-brown] hover:text-[site-red] transition-colors"
                        >
                          <ChevronLeft className="size-3.5 shrink-0" />
                          <span className="hidden sm:inline">Trước</span>
                        </Link>
                      )}
                      <span className="uppercase tracking-wider text-[10px]">
                        {postPosition} / {totalPosts}
                      </span>
                      {nextPost && (
                        <Link
                          href={`/${nicheId}/blog/${nextPost.slug}`}
                          className="flex items-center gap-1 text-[site-brown] hover:text-[site-red] transition-colors"
                        >
                          <span className="hidden sm:inline">Tiếp</span>
                          <ChevronRight className="size-3.5 shrink-0" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Cover image */}
                {post.coverImage && (
                  <div className="w-full aspect-[16/9] overflow-hidden mb-6">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover"
                      fetchPriority="high"
                    />
                  </div>
                )}

                {/* Description lead */}
                <p className="font-mono text-[13px] text-[site-ink]/60 leading-relaxed mb-6 border-l-4 border-[site-yellow] pl-4 italic">
                  {post.description}
                </p>

                {/* Article body */}
                <article className="prose-blog">
                  {post.content ? (
                    <div dangerouslySetInnerHTML={{ __html: post.content }} />
                  ) : null}
                </article>

                {/* Tags */}
                <div className="mt-8 pt-5 border-t border-[site-ink]/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="size-3.5 text-[site-ink]/30 shrink-0" />
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[11px] text-[site-brown] border border-[site-brown]/25 px-2 py-1 cursor-default"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Related posts — mobile only (horizontal scroll) */}
                {related.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-[site-ink]/10 lg:hidden">
                    <h2 className="font-mono text-[11px] font-bold text-[site-ink]/50 uppercase tracking-widest mb-4">
                      Bài viết liên quan
                    </h2>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x snap-mandatory scrollbar-hide">
                      {related.slice(0, 4).map((r) => (
                        <Link
                          key={r.slug}
                          href={`/${nicheId}/blog/${r.slug}`}
                          className="group shrink-0 w-48 snap-start flex flex-col border border-[site-ink]/10 hover:border-[site-red]/30 transition-all"
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
                          <div className="p-2.5 flex-1">
                            <p className="font-mono text-[11px] font-bold text-[site-ink] leading-snug line-clamp-2 group-hover:text-[site-red] transition-colors">
                              {r.title}
                            </p>
                            <p className="font-mono text-[10px] text-[site-ink]/40 mt-1">
                              {r.readTime} phút
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom prev/next navigation */}
                <div className="mt-8 pt-5 border-t border-[site-ink]/10 grid grid-cols-2 gap-3">
                  {prevPost ? (
                    <Link
                      href={`/${nicheId}/blog/${prevPost.slug}`}
                      className="group flex flex-col gap-1 p-3 border border-[site-ink]/10 hover:border-[site-red]/30 hover:bg-[#fffdf5] transition-all"
                    >
                      <span className="font-mono text-[9px] text-[site-ink]/40 uppercase tracking-wider flex items-center gap-1">
                        <ChevronLeft className="size-3 shrink-0" />
                        Bài trước
                      </span>
                      <p className="font-mono text-[11px] font-bold text-[site-ink] line-clamp-2 group-hover:text-[site-red] transition-colors leading-snug">
                        {prevPost.title}
                      </p>
                    </Link>
                  ) : (
                    <div />
                  )}
                  {nextPost ? (
                    <Link
                      href={`/${nicheId}/blog/${nextPost.slug}`}
                      className="group flex flex-col gap-1 p-3 border border-[site-ink]/10 hover:border-[site-red]/30 hover:bg-[#fffdf5] transition-all text-right"
                    >
                      <span className="font-mono text-[9px] text-[site-ink]/40 uppercase tracking-wider flex items-center justify-end gap-1">
                        Bài tiếp
                        <ChevronRight className="size-3 shrink-0" />
                      </span>
                      <p className="font-mono text-[11px] font-bold text-[site-ink] line-clamp-2 group-hover:text-[site-red] transition-colors leading-snug">
                        {nextPost.title}
                      </p>
                    </Link>
                  ) : (
                    <div />
                  )}
                </div>

                {/* Back to blog + deal CTA */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Link
                    href={`/${nicheId}/blog`}
                    className="font-mono text-[12px] text-[site-brown] hover:text-[site-red] transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="size-3.5 shrink-0" />
                    Tất cả bài viết
                  </Link>
                  <Link
                    href={`/${nicheId}`}
                    className="flex items-center gap-1.5 bg-[site-red] text-white font-mono text-[11px] px-4 py-2.5 hover:bg-[site-ink] active:scale-95 transition-all"
                  >
                    {niche.emoji} Deal {niche.name}
                  </Link>
                </div>
              </main>

              {/* ── Sidebar — desktop only ───────────────────────────── */}
              <aside className="hidden lg:block sticky top-[160px] space-y-6">

                {/* Editors Picks */}
                {editorsPicks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-[site-ink]/10" />
                      <h3 className="font-mono text-[10px] font-bold text-[site-ink] uppercase tracking-widest whitespace-nowrap px-2">
                        Editors Picks
                      </h3>
                      <div className="h-px flex-1 bg-[site-ink]/10" />
                    </div>

                    <div className="space-y-3">
                      {editorsPicks.map((r) => (
                        <Link
                          key={r.slug}
                          href={`/${nicheId}/blog/${r.slug}`}
                          className="group flex gap-3 p-2 hover:bg-[site-cream] transition-colors -mx-2"
                        >
                          {r.coverImage ? (
                            <div className="shrink-0 w-[72px] h-[54px] overflow-hidden">
                              <img
                                src={r.coverImage}
                                alt=""
                                aria-hidden
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="shrink-0 w-[72px] h-[54px] bg-[site-sand]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-[11px] font-bold text-[site-ink] leading-snug line-clamp-2 group-hover:text-[site-red] transition-colors mb-1">
                              {r.title}
                            </p>
                            <p className="font-mono text-[9px] text-[site-ink]/40">
                              {r.readTime} phút đọc
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>

                    <Link
                      href={`/${nicheId}/blog`}
                      className="block mt-3 font-mono text-[10px] text-[site-red] hover:underline text-right"
                    >
                      Tất cả bài viết →
                    </Link>
                  </div>
                )}

                {/* Top Reviews */}
                {topReviews.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-[site-ink]/10" />
                      <h3 className="font-mono text-[10px] font-bold text-[site-ink] uppercase tracking-widest whitespace-nowrap px-2">
                        Top Reviews
                      </h3>
                      <div className="h-px flex-1 bg-[site-ink]/10" />
                    </div>

                    <div className="space-y-4">
                      {topReviews.map((r) => (
                        <Link
                          key={r.slug}
                          href={`/${nicheId}/blog/${r.slug}`}
                          className="group block"
                        >
                          {r.coverImage && (
                            <div className="w-full aspect-[16/9] overflow-hidden mb-2">
                              <img
                                src={r.coverImage}
                                alt=""
                                aria-hidden
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-mono text-[11px] font-bold text-[site-ink] leading-snug line-clamp-2 group-hover:text-[site-red] transition-colors flex-1">
                              {r.title}
                            </p>
                            <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wide text-white bg-[site-ink] px-1.5 py-0.5">
                              {r.readTime}m
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deal CTA */}
                <div className="bg-[site-ink] p-4 text-white">
                  <span className="font-mono text-[9px] text-[site-yellow] uppercase tracking-widest block mb-1.5">
                    Deal hôm nay
                  </span>
                  <p className="font-mono text-[12px] font-bold leading-snug mb-3">
                    {niche.emoji} Giảm giá {niche.name} — cập nhật mỗi 4h
                  </p>
                  <Link
                    href={`/${nicheId}`}
                    className="block text-center bg-[site-red] text-white font-mono text-[11px] px-3 py-2 hover:bg-[site-yellow] hover:text-[site-ink] transition-colors"
                  >
                    Xem ngay →
                  </Link>
                </div>

              </aside>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
