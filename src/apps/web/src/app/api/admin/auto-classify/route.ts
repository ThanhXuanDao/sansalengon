import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { classifyProduct, classifyBatch } from "@/lib/auto-classifier"

// GET /api/admin/auto-classify?id=<productId>   — classify one product
// GET /api/admin/auto-classify?limit=50          — classify top N uncategorized/all products
// POST /api/admin/auto-classify { productId, categoryId } — apply suggestion

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const productId = searchParams.get("id")
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20))

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const result = await classifyProduct(product.id, product.name, categories)
    if (!result) {
      return NextResponse.json({ error: "AI classification unavailable or feature disabled" }, { status: 503 })
    }
    return NextResponse.json({ result })
  }

  // Batch: classify products — prioritize products without a category or recent additions
  const products = await prisma.product.findMany({
    select: { id: true, name: true, categoryId: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const results = await classifyBatch(products, categories)
  return NextResponse.json({ results, total: results.length })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { productId, categoryId } = await request.json() as { productId: string; categoryId: string }
  if (!productId || !categoryId) {
    return NextResponse.json({ error: "productId and categoryId are required" }, { status: 400 })
  }

  try {
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { categoryId },
      select: { id: true, name: true, categoryId: true },
    })
    return NextResponse.json({ ok: true, product: updated })
  } catch {
    return NextResponse.json({ error: "Failed to update product category" }, { status: 500 })
  }
}
