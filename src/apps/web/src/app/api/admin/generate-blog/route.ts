import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"
import { generateBlogPost, toSlug } from "@/lib/blog-generator"
import { getActiveNiches } from "@/lib/niches"

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { niche, title, description, keywords, tags, provider } = body as {
    niche: string
    title: string
    description?: string
    keywords?: string[]
    tags?: string[]
    provider?: string
  }

  // Validate provider key availability if explicitly requested
  if (provider) {
    const { isProviderAvailable } = await import("@/lib/ai-provider")
    if (!isProviderAvailable(provider)) {
      return NextResponse.json(
        { error: `API key cho provider "${provider}" chưa được cấu hình trong .env.local` },
        { status: 503 },
      )
    }
  }

  if (!niche || !title) {
    return NextResponse.json({ error: "niche and title are required" }, { status: 400 })
  }

  const NICHES = await getActiveNiches()
  const nicheConfig = NICHES.find((n) => n.id === niche)
  if (!nicheConfig) {
    return NextResponse.json({ error: "Unknown niche" }, { status: 400 })
  }

  // Fetch top products for context
  const products = await prisma.product.findMany({
    where: { categoryId: nicheConfig.categorySlug, isSoldOut: false },
    select: { name: true, price: true, discountPct: true, rating: true },
    orderBy: { discountPct: "desc" },
    take: 8,
  })

  const slug = toSlug(title)

  try {
    const result = await generateBlogPost({
      niche,
      title,
      description: description ?? title,
      keywords: keywords ?? [],
      tags: tags ?? [nicheConfig.name.toLowerCase()],
      products,
    }, provider)

    // Save to DB (upsert — overwrite if same slug regenerated)
    const now = new Date()
    const dbPost = await prisma.blogPost.upsert({
      where: { niche_slug: { niche, slug: result.slug } },
      update: {
        title: result.meta.title,
        description: result.meta.description,
        content: result.htmlContent,
        coverImage: result.meta.coverImage ?? null,
        author: result.meta.author,
        tags: result.meta.tags,
        keywords: keywords ?? [],
        readTime: result.meta.readTime,
        updatedAt: now,
      },
      create: {
        slug: result.slug,
        niche,
        title: result.meta.title,
        description: result.meta.description,
        content: result.htmlContent,
        coverImage: result.meta.coverImage ?? null,
        author: result.meta.author,
        tags: result.meta.tags,
        keywords: keywords ?? [],
        readTime: result.meta.readTime,
        published: false,
      },
    })

    return NextResponse.json({
      ok: true,
      slug: result.slug,
      niche,
      url: `/${niche}/blog/${result.slug}`,
      meta: result.meta,
      postId: dbPost.id,
      htmlContent: result.htmlContent,
    })
  } catch (err) {
    console.error("Blog generation failed:", err)
    return NextResponse.json(
      { error: "Generation failed", detail: (err as Error).message },
      { status: 500 },
    )
  }
}

// GET — list existing generated posts for this niche
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const niche = searchParams.get("niche")

  // Dynamic import to get current state (avoids build-time cache)
  const { GENERATED_POSTS } = await import("@/content/blog/generated-posts")
  const posts = niche ? GENERATED_POSTS.filter((p) => p.niche === niche) : GENERATED_POSTS

  return NextResponse.json({ posts })
}
