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
    const {
      name,
      emoji,
      status,
      description,
      metaKeywords,
      sortOrder,
      postPrefix,
      hashtags,
      zaloOaId,
      syncEnabled,
    } = body

    const niche = await prisma.niche.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(emoji !== undefined && { emoji }),
        ...(status !== undefined && { status }),
        ...(description !== undefined && { description }),
        ...(metaKeywords !== undefined && { metaKeywords }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(postPrefix !== undefined && { postPrefix }),
        ...(hashtags !== undefined && { hashtags }),
        ...(zaloOaId !== undefined && { zaloOaId }),
        ...(syncEnabled !== undefined && { syncEnabled }),
      },
    })

    return NextResponse.json({ data: niche })
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy ngách" }, { status: 404 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
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
    await prisma.niche.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy ngách" }, { status: 404 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
