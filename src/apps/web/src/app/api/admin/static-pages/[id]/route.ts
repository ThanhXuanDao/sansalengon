import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { getStaticPageDb, updateStaticPageDb, deleteStaticPageDb } from "@/lib/static-pages-db"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  // id can be the cuid or a slug — try slug first for convenience
  try {
    const page = await getStaticPageDb(id)
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ page })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const page = await updateStaticPageDb(id, {
      ...(body.slug !== undefined && { slug: String(body.slug).trim() }),
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.description !== undefined && { description: String(body.description).trim() }),
      ...(body.content !== undefined && { content: String(body.content) }),
      ...(Array.isArray(body.placements) && { placements: body.placements.map(String) }),
      ...(body.published !== undefined && { published: Boolean(body.published) }),
      ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
    })
    revalidatePath("/", "layout")
    return NextResponse.json({ ok: true, page })
  } catch (err: unknown) {
    const msg = (err as { code?: string; message?: string }).code === "P2002"
      ? "Slug đã tồn tại"
      : (err as Error).message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  try {
    await deleteStaticPageDb(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
