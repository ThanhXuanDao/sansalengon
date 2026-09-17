import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  try {
    const body = await request.json()
    const { name, slug, baseUrl, enabled, config, description } = body

    const source = await prisma.syncSource.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(baseUrl !== undefined && { baseUrl }),
        ...(enabled !== undefined && { enabled }),
        ...(config !== undefined && { config: typeof config === "string" ? config : JSON.stringify(config) }),
        ...(description !== undefined && { description: description || null }),
      },
    })

    return NextResponse.json({ data: source })
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy nguồn" }, { status: 404 })
    }
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 409 })
    }
    return NextResponse.json({ error: e.message ?? String(err) }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  try {
    await prisma.syncSource.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy nguồn" }, { status: 404 })
    }
    return NextResponse.json({ error: e.message ?? String(err) }, { status: 500 })
  }
}
