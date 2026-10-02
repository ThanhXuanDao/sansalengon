import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { getProductNumberMap, resolveNumberRangeToIds } from "@/lib/products-numbering"
import { rateLimit } from "@/lib/rate-limit"
import { matchesQueryWords, normalizeText } from "@/lib/text"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const featured = searchParams.get("featured") === "true"
  if (featured) {
    const storeSetting = await prisma.appSetting.findUnique({ where: { key: "store_settings" } })
    const storeJson = storeSetting ? JSON.parse(storeSetting.value) as Record<string, unknown> : {}
    const featuredCount = (typeof storeJson.featuredCount === "number" && storeJson.featuredCount > 0)
      ? storeJson.featuredCount
      : 10
    const [products, numberMap] = await Promise.all([
      prisma.product.findMany({ where: { isFeatured: true }, take: featuredCount, include: { category: true } }),
      getProductNumberMap(),
    ])
    const data = products.map((p) => ({ ...p, number: numberMap.get(p.id) ?? 0 }))
    return NextResponse.json({ data, total: products.length })
  }

  const topDiscount = searchParams.get("topDiscount") === "true"
  if (topDiscount) {
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("take")) || 10))
    const [products, numberMap] = await Promise.all([
      prisma.product.findMany({
        where: { discountPct: { gt: 0 }, isSoldOut: false },
        orderBy: { discountPct: "desc" },
        take: limit,
        include: { category: true },
      }),
      getProductNumberMap(),
    ])
    const data = products.map((p) => ({ ...p, number: numberMap.get(p.id) ?? 0 }))
    return NextResponse.json({ data, total: data.length })
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
  const categoryParam = searchParams.get("category")
  const categorySlugs = categoryParam
    ? categoryParam.split(",").map((s) => s.trim()).filter(Boolean)
    : []
  const sourceParam = searchParams.get("source")
  const sourceSlugs = sourceParam
    ? sourceParam.split(",").map((s) => s.trim()).filter(Boolean)
    : []
  const sort = searchParams.get("sort") ?? "newest"
  const skipParam = searchParams.get("skip")
  const skip = skipParam !== null ? Number(skipParam) : undefined
  const takeParam = searchParams.get("take")
  const take = takeParam !== null ? Number(takeParam) : undefined
  const numberFrom = searchParams.get("numberFrom") ? Number(searchParams.get("numberFrom")) : undefined
  const numberTo = searchParams.get("numberTo") ? Number(searchParams.get("numberTo")) : undefined
  const hasNumberFilter = numberFrom !== undefined && numberTo !== undefined

  // Admin-only filter params (require auth)
  const isFeaturedParam = searchParams.get("isFeatured")
  const isSoldOutParam = searchParams.get("isSoldOut")
  const hasAdminParams = isFeaturedParam !== null || isSoldOutParam !== null
  if (hasAdminParams && !(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const categoryWhere: Record<string, unknown> =
    categorySlugs.length === 1
      ? { categoryId: categorySlugs[0] }
      : categorySlugs.length > 1
        ? { categoryId: { in: categorySlugs } }
        : {}

  if (sourceSlugs.length === 1) categoryWhere.source = sourceSlugs[0]
  else if (sourceSlugs.length > 1) categoryWhere.source = { in: sourceSlugs }

  if (hasAdminParams) {
    // Admin request: apply explicit filters, don't force isSoldOut
    if (isFeaturedParam === "true") categoryWhere.isFeatured = true
    else if (isFeaturedParam === "false") categoryWhere.isFeatured = false
    if (isSoldOutParam === "true") categoryWhere.isSoldOut = true
    else if (isSoldOutParam === "false") categoryWhere.isSoldOut = false
  } else {
    // Public API: always hide sold-out products
    categoryWhere.isSoldOut = false
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput[]
  if (sort === "discount_desc") orderBy = [{ discountPct: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
  else if (sort === "number_asc") orderBy = [{ createdAt: "asc" }]
  else if (sort === "price_asc") orderBy = [{ price: "asc" }]
  else if (sort === "price_desc") orderBy = [{ price: "desc" }]
  else if (sort === "rating_desc") orderBy = [{ rating: "desc" }]
  else if (sort === "rating_asc") orderBy = [{ rating: "asc" }]
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

    const queryWords = normalizeText(q.trim()).split(/\s+/).filter(Boolean)
    const matchedProducts = allCandidateProducts.filter((p) => {
      const searchText = [p.name, p.category?.name ?? "", p.imageAlt ?? ""].join(" ")
      return matchesQueryWords(searchText, queryWords)
    })
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
  const csrf = await csrfGuard(request)
  if (csrf) return csrf
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed } = await rateLimit(`product_create:${ip}`, { max: 20, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  const body = await request.json()
  const { name, price, commission, rating, discountPct, imageUrl, imageAlt, productUrl, affiliateUrl, platformAffiliateUrl, categoryId, source, isFeatured, isSoldOut, atCampaignId } = body

  if (!name || !price || !imageUrl || !productUrl || !categoryId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: { name, price: Number(price), commission: commission ? Number(commission) : 0, rating: rating ? Number(rating) : 0, discountPct: discountPct ? Number(discountPct) : null, imageUrl, imageAlt: imageAlt || name, productUrl, affiliateUrl: affiliateUrl || null, platformAffiliateUrl: platformAffiliateUrl || null, categoryId, source: source || "manual", isFeatured: isFeatured || false, isSoldOut: isSoldOut || false, atCampaignId: atCampaignId || null },
    include: { category: true },
  })
  return NextResponse.json({ data: product }, { status: 201 })
}