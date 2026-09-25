import { prisma } from "@/lib/prisma"

export interface BlogPostMeta {
  id: string
  slug: string
  niche: string
  title: string
  description: string
  coverImage?: string
  author?: string
  tags: string[]
  readTime: number
  date: string
  content: string
}

function dbToMeta(p: {
  id: string; slug: string; niche: string; title: string; description: string
  coverImage: string | null; author: string; tags: string[]; readTime: number
  publishedAt: Date | null; createdAt: Date; content: string
}): BlogPostMeta {
  return {
    id: p.id,
    slug: p.slug,
    niche: p.niche,
    title: p.title,
    description: p.description,
    coverImage: p.coverImage ?? undefined,
    author: p.author,
    tags: p.tags,
    readTime: p.readTime,
    date: (p.publishedAt ?? p.createdAt).toISOString().slice(0, 10),
    content: p.content,
  }
}

/** List published posts for a niche */
export async function getPostsByNicheDb(nicheId: string): Promise<BlogPostMeta[]> {
  const posts = await prisma.blogPost.findMany({
    where: { niche: nicheId, published: true },
    orderBy: { publishedAt: "desc" },
  })
  return posts.map(dbToMeta)
}

/** Get single published post */
export async function getPostDb(nicheId: string, slug: string): Promise<BlogPostMeta | null> {
  const post = await prisma.blogPost.findUnique({
    where: { niche_slug: { niche: nicheId, slug } },
  })
  if (!post || !post.published) return null
  return dbToMeta(post)
}

/** Related posts for a niche (excluding current slug) */
export async function getRelatedPostsDb(nicheId: string, currentSlug: string, limit = 3): Promise<BlogPostMeta[]> {
  const posts = await prisma.blogPost.findMany({
    where: { niche: nicheId, published: true, NOT: { slug: currentSlug } },
    orderBy: { publishedAt: "desc" },
    take: limit,
  })
  return posts.map(dbToMeta)
}

/** All published posts — for static params generation */
export async function getAllPostsDb(): Promise<BlogPostMeta[]> {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  })
  return posts.map(dbToMeta)
}
