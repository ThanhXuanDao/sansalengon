import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { checkAuth } from "@/lib/auth"
import { getProductNumberMap, resolveNumberRangeToIds } from "@/lib/products-numbering"
import { rateLimit } from "@/lib/rate-limit"
import Fuse from "fuse.js"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const featured = searchParams.get("featured") === "true"
  if (featured) {
    const [products, numberMap] = await Promise.all([
      prisma.product.findMany({ where: { isFeatured: true }, include: { category: true } }),
      getProductNumberMap(),
    ])
    const data = products.map((p) => ({ ...p, number: numberMap.get(p.id) ?? 0 }))
    return NextResponse.json({ data, total: products.length })
  }

  const mostClicked = searchParams.get("mostClicked") === "true"
  if (mostClicked) {
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("take")) || 6))
    const clickCounts = await prisma.clickLog.groupBy({
      by: ["productId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    })
    if (clickCounts.length === 0) {
      return NextResponse.json({ data: [], total: 0 })
    }
    const productIds = clickCounts.map((c) => c.productId)
    const [products, numberMap] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { category: true },
      }),
      getProductNumberMap(),
    ])
    const productMap = new Map(products.map((p) => [p.id, p]))
    const data = productIds
      .map((id) => productMap.get(id))
      .filter(Boolean)
      .map((p) => ({ ...p!, number: numberMap.get(p!.id) ?? 0 }))
    return NextResponse.json({ data, total: data.length })
  }

  const q = searchParams.get("q")
  const categorySlug = searchParams.get("category")
  const sort = searchParams.get("sort") ?? "newest"
  const skipParam = searchParams.get("skip")
  const skip = skipParam !== null ? Number(skipParam) : undefined
  const takeParam = searchParams.get("take")
  const take = takeParam !== null ? Number(takeParam) : undefined
  const numberFrom = searchParams.get("numberFrom") ? Number(searchParams.get("numberFrom")) : undefined
  const numberTo = searchParams.get("numberTo") ? Number(searchParams.get("numberTo")) : undefined

  const hasNumberFilter = numberFrom !== undefined && numberTo !== undefined

  const categoryWhere: Record<string, unknown> =
    categorySlug && categorySlug !== "semua"
      ? { category: { slug: categorySlug } }
      : {}

  let orderBy: Prisma.ProductOrderByWithRelationInput[]
  if (sort === "number_asc") orderBy = [{ createdAt: "asc" }]
  else if (sort === "price_asc") orderBy = [{ price: "asc" }]
  else if (sort === "price_desc") orderBy = [{ price: "desc" }]
  else if (sort === "rating_desc") orderBy = [{ rating: "desc" }]
  else if (sort === "rating_desc,price_asc") orderBy = [{ rating: "desc" }, { price: "asc" }]
  else orderBy = [{ createdAt: "desc" }]

  const numberMapPromise = getProductNumberMap()

  if (q && q.trim()) {
    let baseWhere: Record<string, unknown> = { ...categoryWhere }
    const numberMap = await numberMapPromise
    if (hasNumberFilter) {
      const idsInRange = resolveNumberRangeToIds(numberMap, numberFrom!, numberTo!)
      baseWhere = { ...baseWhere, id: { in: idsInRange } }
    }

    const allCandidateProducts = await prisma.product.findMany({
      where: baseWhere,
      include: { category: true, _count: { select: { clicks: true } } },
      orderBy,
    })

    const fuse = new Fuse(allCandidateProducts, {
      keys: [
        { name: "name", weight: 0.6 },
        { name: "category.name", weight: 0.3 },
        { name: "imageAlt", weight: 0.1 },
      ],
      threshold: 0.45,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })

    const searchResults = fuse.search(q.trim())
    const matchedProducts = searchResults.map((res) => res.item)
    const total = matchedProducts.length
    const offset = skip ?? 0
    const limit = take !== undefined ? take : total
    const paginated = matchedProducts.slice(offset, offset + limit)

    const data = paginated.map((p) => ({
      ...p,
      number: numberMap.get(p.id) ?? 0,
    }))

    return NextResponse.json({ data, total })
  }

  let where: Record<string, unknown> = { ...categoryWhere }
  if (hasNumberFilter) {
    const numberMap = await numberMapPromise
    const idsInRange = resolveNumberRangeToIds(numberMap, numberFrom!, numberTo!)
    where = { ...where, id: { in: idsInRange } }
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, _count: { select: { clicks: true } } },
        orderBy,
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ])
    const data = products.map((p) => ({
      ...p,
      number: numberMap.get(p.id) ?? 0,
    }))
    return NextResponse.json({ data, total })
  }

  const [numberMap, products, total] = await Promise.all([
    numberMapPromise,
    prisma.product.findMany({
      where,
      include: { category: true, _count: { select: { clicks: true } } },
      orderBy,
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ])

  const data = products.map((p) => ({
    ...p,
    number: numberMap.get(p.id) ?? 0,
  }))

  return NextResponse.json({ data, total })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed } = rateLimit(`product_create:${ip}`, { max: 20, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  const body = await request.json()
  const { name, price, commission, rating, discountPct, imageUrl, imageAlt, shopeeUrl, categoryId, isFeatured, isSoldOut } = body

  if (!name || !price || !imageUrl || !shopeeUrl || !categoryId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: { name, price: Number(price), commission: commission ? Number(commission) : 0, rating: rating ? Number(rating) : 0, discountPct: discountPct ? Number(discountPct) : null, imageUrl, imageAlt: imageAlt || name, shopeeUrl, categoryId, isFeatured: isFeatured || false, isSoldOut: isSoldOut || false },
    include: { category: true },
  })
  return NextResponse.json({ data: product }, { status: 201 })
}