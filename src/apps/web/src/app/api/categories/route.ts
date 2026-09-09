import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json({ data: categories })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const body = await request.json()
  const { name, slug, icon } = body
  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 })
  }

  const existing = await prisma.category.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 })
  }

  const category = await prisma.category.create({ data: { name, slug, icon: icon || "LayoutGrid" } })
  return NextResponse.json({ data: category }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const body = await request.json()
  const { id, name, icon } = body
  if (!id || !name) {
    return NextResponse.json({ error: "ID and name are required" }, { status: 400 })
  }

  const category = await prisma.category.update({ where: { id }, data: { name, icon } })
  return NextResponse.json({ data: category })
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 })
  }

  const productCount = await prisma.product.count({ where: { categoryId: id } })
  if (productCount > 0) {
    return NextResponse.json({ error: `Cannot delete category with ${productCount} product(s). Move products first.` }, { status: 400 })
  }

  await prisma.category.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
