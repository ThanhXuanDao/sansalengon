import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { toSlug } from "@/lib/blog-generator"

// GET — list all blog posts for admin (all statuses)
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const niche     = searchParams.get("niche") || undefined
  const status    = searchParams.get("status") || "all"
  const q         = searchParams.get("q")?.trim() || undefined
  const take      = Math.min(100, Number(searchParams.get("take") ?? "50"))
  const skip      = Number(searchParams.get("skip") ?? "0")

  const where: Record<string, unknown> = {}
  if (niche)                where.niche     = niche
  if (status === "published") where.published = true
  if (status === "draft")     where.published = false
  if (q) {
    where.OR = [
      { title:       { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true, slug: true, niche: true, title: true, description: true,
        coverImage: true, author: true, tags: true, keywords: true,
        readTime: true, published: true, publishedAt: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.blogPost.count({ where }),
  ])

  return NextResponse.json({ data, total })
}

// POST — create blog post manually (without AI)
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { niche, title, slug: slugInput, description, content, coverImage, author, tags, keywords, readTime, published } = body as {
    niche: string; title: string; slug?: string; description: string; content: string
    coverImage?: string; author?: string; tags?: string[]; keywords?: string[]
    readTime?: number; published?: boolean
  }

  if (!niche || !title || !content) {
    return NextResponse.json({ error: "niche, title, content are required" }, { status: 400 })
  }

  const slug = slugInput?.trim() || toSlug(title)
  const now = new Date()

  try {
    const post = await prisma.blogPost.upsert({
      where: { niche_slug: { niche, slug } },
      update: { title, description, content, coverImage: coverImage ?? null, author: author ?? "SanSaleNgon AI", tags: tags ?? [], keywords: keywords ?? [], readTime: readTime ?? 5, published: published ?? false, publishedAt: published ? now : null, updatedAt: now },
      create: { slug, niche, title, description, content, coverImage: coverImage ?? null, author: author ?? "SanSaleNgon AI", tags: tags ?? [], keywords: keywords ?? [], readTime: readTime ?? 5, published: published ?? false, publishedAt: published ? now : null },
    })
    return NextResponse.json({ ok: true, post })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
