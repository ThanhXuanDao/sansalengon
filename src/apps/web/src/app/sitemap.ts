import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { getActiveNiches } from "@/lib/niches"
import { getAllPosts } from "@/lib/blog"

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sansalengon.vn").replace(/\/$/, "")

export const revalidate = 3600 // rebuild mỗi 1 giờ

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let NICHES: Awaited<ReturnType<typeof getActiveNiches>> = []
  try {
    NICHES = await getActiveNiches()
  } catch {
    // DB unreachable during build — return static routes only
  }
  // Niche pages (static, high priority for SEO)
  const nicheRoutes: MetadataRoute.Sitemap = NICHES.map((n) => ({
    url: `${BASE_URL}/${n.id}`,
    changeFrequency: "daily" as const,
    priority: 0.9,
  }))

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                         changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/ma-giam-gia`,        changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/affiliate`,          changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/about`,              changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/contact`,            changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/privacy`,            changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE_URL}/terms`,              changeFrequency: "yearly",  priority: 0.2 },
  ]

  // Dynamic: category pages (/?category=slug)
  let categoryRoutes: MetadataRoute.Sitemap = []
  try {
    const categories = await prisma.category.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    })
    categoryRoutes = categories.map((cat) => ({
      url: `${BASE_URL}/?category=${cat.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }))
  } catch {
    // DB chưa ready khi build — không block sitemap
  }

  // Dynamic: active coupons pages by niche
  let couponNicheRoutes: MetadataRoute.Sitemap = []
  try {
    const nicheIds = await prisma.coupon.findMany({
      where: { isActive: true, nicheId: { not: null } },
      select: { nicheId: true },
      distinct: ["nicheId"],
    })
    couponNicheRoutes = nicheIds.map(({ nicheId }) => ({
      url: `${BASE_URL}/ma-giam-gia?niche=${nicheId}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }))
  } catch {
    // DB chưa ready — bỏ qua
  }

  // Blog posts (static, high SEO value)
  const blogListRoutes: MetadataRoute.Sitemap = NICHES.map((n) => ({
    url: `${BASE_URL}/${n.id}/blog`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  const blogPostRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${BASE_URL}/${post.niche}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  return [
    ...staticRoutes,
    ...nicheRoutes,
    ...blogListRoutes,
    ...blogPostRoutes,
    ...categoryRoutes,
    ...couponNicheRoutes,
  ]
}
