import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const niches = await prisma.niche.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })

  return NextResponse.json({ data: niches })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const body = await request.json()
    const {
      id,
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

    if (!id || !name) {
      return NextResponse.json({ error: "id và name là bắt buộc" }, { status: 400 })
    }

    const niche = await prisma.niche.create({
      data: {
        id,
        name,
        emoji: emoji ?? "🏷️",
        status: status ?? "draft",
        description: description ?? null,
        metaKeywords: metaKeywords ?? null,
        sortOrder: sortOrder ?? 0,
        postPrefix: postPrefix ?? null,
        hashtags: hashtags ?? null,
        zaloOaId: zaloOaId ?? null,
        syncEnabled: syncEnabled ?? true,
      },
    })

    return NextResponse.json({ data: niche }, { status: 201 })
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "ID ngách đã tồn tại" }, { status: 409 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
