import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { getProductNumberMap } from "@/lib/products-numbering"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [product, numberMap] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { category: true },
    }),
    getProductNumberMap(),
  ])
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  return NextResponse.json({ data: { ...product, number: numberMap.get(id) ?? 0 } })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json()
  const { name, price, commission, rating, discountPct, imageUrl, imageAlt, shopeeUrl, categoryId, isFeatured, isSoldOut } = body

  const product = await prisma.product.update({
    where: { id },
    data: { name, price: price !== undefined ? Number(price) : undefined, commission: commission !== undefined ? Number(commission) : undefined, rating: rating !== undefined ? Number(rating) : undefined, discountPct, imageUrl, imageAlt, shopeeUrl, categoryId, isFeatured, isSoldOut },
    include: { category: true },
  })
  return NextResponse.json({ data: product })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  await prisma.clickLog.deleteMany({ where: { productId: id } })
  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
