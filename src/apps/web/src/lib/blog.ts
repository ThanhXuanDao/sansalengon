import { BLOG_POSTS, type BlogPostMeta } from "@/content/blog"

export function getAllPosts(): BlogPostMeta[] {
  return [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))
}

export function getPostsByNiche(nicheId: string): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => p.niche === nicheId).sort((a, b) =>
    b.date.localeCompare(a.date)
  )
}

export function getPost(nicheId: string, slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.niche === nicheId && p.slug === slug)
}

export function getRelatedPosts(nicheId: string, currentSlug: string, limit = 3): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => p.niche === nicheId && p.slug !== currentSlug)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}
