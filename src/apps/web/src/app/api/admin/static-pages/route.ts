import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { getAllStaticPagesDb, createStaticPageDb } from "@/lib/static-pages-db"
import { toSlug } from "@/lib/slug"

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const pages = await getAllStaticPagesDb()
  return NextResponse.json({ pages })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const title = String(body.title ?? "").trim()
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })

  const slug = String(body.slug ?? toSlug(title)).trim()
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 })

  try {
    const page = await createStaticPageDb({
      slug,
      title,
      description: String(body.description ?? "").trim(),
      content: String(body.content ?? ""),
      placements: Array.isArray(body.placements) ? body.placements.map(String) : [],
      published: Boolean(body.published ?? false),
      sortOrder: Number(body.sortOrder ?? 0),
    })
    revalidatePath("/", "layout")
    return NextResponse.json({ ok: true, page })
  } catch (err: unknown) {
    const msg = (err as { code?: string; message?: string }).code === "P2002"
      ? "Slug đã tồn tại, vui lòng chọn slug khác"
      : (err as Error).message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
