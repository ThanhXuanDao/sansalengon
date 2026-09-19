import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sources = await prisma.syncSource.findMany({
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ data: sources })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const body = await request.json()
    const { name, slug, baseUrl, enabled, config, description, icon } = body

    if (!name || !slug || !baseUrl) {
      return NextResponse.json({ error: "name, slug, baseUrl là bắt buộc" }, { status: 400 })
    }

    const source = await prisma.syncSource.create({
      data: {
        name,
        slug,
        baseUrl,
        enabled: enabled ?? true,
        config: typeof config === "string" ? config : JSON.stringify(config ?? {}),
        description: description ?? null,
        icon: icon ?? null,
      },
    })

    return NextResponse.json({ data: source }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 409 })
    }
    return NextResponse.json({ error: e.message ?? String(err) }, { status: 500 })
  }
}
