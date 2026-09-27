import { prisma } from "@/lib/prisma"

export interface StaticPageData {
  id: string
  slug: string
  title: string
  description: string
  content: string
  placements: string[]
  published: boolean
  sortOrder: number
  updatedAt: string
  createdAt: string
}

function toData(p: {
  id: string; slug: string; title: string; description: string; content: string
  placements: string[]; published: boolean; sortOrder: number
  updatedAt: Date; createdAt: Date
}): StaticPageData {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    content: p.content,
    placements: p.placements,
    published: p.published,
    sortOrder: p.sortOrder,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }
}

/** Get a single page by slug (used by public pages — returns null if not found or not published) */
export async function getStaticPageDb(slug: string): Promise<StaticPageData | null> {
  try {
    const page = await prisma.staticPage.findUnique({ where: { slug } })
    if (!page || !page.content) return null
    return toData(page)
  } catch {
    return null
  }
}

/** Admin: list all pages */
export async function getAllStaticPagesDb(): Promise<StaticPageData[]> {
  try {
    const pages = await prisma.staticPage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    })
    return pages.map(toData)
  } catch {
    return []
  }
}

/** Public: pages for navigation by placement */
export async function getPagesByPlacementDb(placement: string): Promise<Pick<StaticPageData, "id" | "slug" | "title">[]> {
  try {
    const pages = await prisma.staticPage.findMany({
      where: { published: true, placements: { has: placement } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, title: true },
    })
    return pages
  } catch {
    return []
  }
}

/** Public: all navigation links grouped by placement */
export async function getNavPagesDb(): Promise<Record<string, Array<{ id: string; slug: string; title: string }>>> {
  try {
    const pages = await prisma.staticPage.findMany({
      where: { published: true, NOT: { placements: { isEmpty: true } } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, title: true, placements: true },
    })
    const result: Record<string, Array<{ id: string; slug: string; title: string }>> = {}
    for (const p of pages) {
      for (const pl of p.placements) {
        if (!result[pl]) result[pl] = []
        result[pl].push({ id: p.id, slug: p.slug, title: p.title })
      }
    }
    return result
  } catch {
    return {}
  }
}

/** Admin: create page */
export async function createStaticPageDb(data: {
  slug: string; title: string; description: string; content: string
  placements: string[]; published: boolean; sortOrder: number
}): Promise<StaticPageData> {
  const page = await prisma.staticPage.create({ data })
  return toData(page)
}

/** Admin: update page by id */
export async function updateStaticPageDb(
  id: string,
  data: {
    slug?: string; title?: string; description?: string; content?: string
    placements?: string[]; published?: boolean; sortOrder?: number
  },
): Promise<StaticPageData> {
  const page = await prisma.staticPage.update({ where: { id }, data })
  return toData(page)
}

/** Admin: delete page by id */
export async function deleteStaticPageDb(id: string): Promise<void> {
  await prisma.staticPage.delete({ where: { id } })
}

/** Public sidebar: all published pages (slug + title only) */
export async function getPublishedStaticPagesDb(): Promise<Pick<StaticPageData, "id" | "slug" | "title">[]> {
  try {
    const pages = await prisma.staticPage.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, slug: true, title: true },
    })
    return pages
  } catch {
    return []
  }
}

export interface TopDealData {
  id: string
  name: string
  price: number
  originalPrice: number | null
  discountPct: number | null
  imageUrl: string
  affiliateUrl: string | null
  productUrl: string
}

/** Public sidebar: top N deals by discount */
export async function getTopDealsDb(limit = 5): Promise<TopDealData[]> {
  try {
    const products = await prisma.product.findMany({
      where: { isSoldOut: false, discountPct: { gt: 0 } },
      orderBy: { discountPct: "desc" },
      take: limit,
      select: {
        id: true, name: true, price: true, originalPrice: true,
        discountPct: true, imageUrl: true, affiliateUrl: true, productUrl: true,
      },
    })
    return products
  } catch {
    return []
  }
}
