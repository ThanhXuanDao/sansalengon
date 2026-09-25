import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

// GET — fetch single post with full content for editing
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(post)
}

// PATCH — update (edit fields, toggle published)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { published, niche, title, slug, description, content, coverImage, tags, keywords, readTime } = body as {
    published?: boolean; niche?: string; title?: string; slug?: string; description?: string; content?: string
    coverImage?: string | null; tags?: string[]; keywords?: string[]; readTime?: number
  }

  const data: Record<string, unknown> = { updatedAt: new Date() }
  if (niche       !== undefined) data.niche       = niche
  if (title       !== undefined) data.title       = title
  if (slug        !== undefined) data.slug        = slug
  if (description !== undefined) data.description = description
  if (content     !== undefined) data.content     = content
  if (coverImage  !== undefined) data.coverImage  = coverImage
  if (tags        !== undefined) data.tags        = tags
  if (keywords    !== undefined) data.keywords    = keywords
  if (readTime    !== undefined) data.readTime    = readTime
  if (published   !== undefined) {
    data.published   = published
    data.publishedAt = published ? new Date() : null
  }

  try {
    const post = await prisma.blogPost.update({ where: { id }, data })
    return NextResponse.json({ ok: true, post })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg.includes("Unique constraint") ? 409 : 500
    return NextResponse.json({ error: status === 409 ? "Slug này đã tồn tại trong ngách này. Hãy dùng slug khác." : msg }, { status })
  }
}

// DELETE — remove post
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  try {
    await prisma.blogPost.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
