import { Suspense } from "react"
import type { Metadata } from "next"
import { QueryClient, HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { prisma } from "@/lib/prisma"
import { getSiteSettings } from "@/lib/get-site-settings"
import { getProductNumberMap } from "@/lib/products-numbering"
import HomeContent from "./HomeContent"

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings()
  return {
    alternates: {
      canonical: s.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    },
  }
}

const PAGE_SIZE = 16

async function prefetchServerData(queryClient: QueryClient) {
  const s = await getSiteSettings()
  const storeExtra = s as unknown as Record<string, unknown>
  const featuredCount = typeof storeExtra.featuredCount === "number" ? storeExtra.featuredCount : 5

  await Promise.all([
    // categories — used by filter bar
    queryClient.prefetchQuery({
      queryKey: ["categories"],
      queryFn: () =>
        prisma.category.findMany({
          select: { id: true, name: true, emoji: true, status: true, description: true, sortOrder: true },
          where: { status: { not: "draft" } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
    }),

    // sources (product type) — used by source filter
    queryClient.prefetchQuery({
      queryKey: ["sources", "product"],
      queryFn: async () => {
        const { syncSourceHasProducts } = await import("@/lib/sync-source-utils")
        const all = await prisma.syncSource.findMany({
          select: { id: true, name: true, slug: true, icon: true, config: true },
          where: { enabled: true },
          orderBy: { createdAt: "asc" },
        })
        return all
          .filter((s) => syncSourceHasProducts(s.config))
          .map(({ config: _, ...rest }) => rest)
      },
    }),

    // featured products — shown above the product grid
    queryClient.prefetchQuery({
      queryKey: ["products", "featured"],
      queryFn: async () => {
        const [products, numberMap] = await Promise.all([
          prisma.product.findMany({
            where: { isFeatured: true },
            take: featuredCount,
            include: { category: true },
          }),
          getProductNumberMap(),
        ])
        return products.map((p) => ({ ...p, number: numberMap.get(p.id) ?? 0 }))
      },
    }),

    // banners — preloaded so BannerSlider can SSR without client fetch
    queryClient.prefetchQuery({
      queryKey: ["banners"],
      queryFn: () =>
        prisma.banner.findMany({
          where: {
            isActive: true,
            OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
            AND: [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }],
          },
          orderBy: { position: "asc" },
          select: { id: true, title: true, imageUrl: true, affiliateUrl: true, destinationUrl: true },
        }),
    }),

    // first page of products — eliminates the blank-screen wait on initial load
    queryClient.prefetchInfiniteQuery({
      queryKey: ["products", "paginated", "all", "all", "discount_desc", 0, 0, ""],
      queryFn: async () => {
        const [products, total, numberMap] = await Promise.all([
          prisma.product.findMany({
            where: { isSoldOut: false },
            include: { category: true, _count: { select: { clicks: true } } },
            orderBy: [{ discountPct: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
            skip: 0,
            take: PAGE_SIZE,
          }),
          prisma.product.count({ where: { isSoldOut: false } }),
          getProductNumberMap(),
        ])
        return {
          data: products.map((p) => ({ ...p, number: numberMap.get(p.id) ?? 0 })),
          total,
        }
      },
      initialPageParam: { skip: 0, take: PAGE_SIZE },
    }),
  ])
}

export default async function Home() {
  const queryClient = new QueryClient()

  // Best-effort — if DB fails on Vercel cold start, the client will fetch normally
  try {
    await prefetchServerData(queryClient)
  } catch {}

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <HomeContent />
      </Suspense>
    </HydrationBoundary>
  )
}
