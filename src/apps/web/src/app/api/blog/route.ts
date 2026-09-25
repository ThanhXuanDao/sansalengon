import { NextRequest, NextResponse } from "next/server"
import { getPostsByNicheDb } from "@/lib/blog-db"

// GET /api/blog?niche=fashion — public, published only
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const niche = searchParams.get("niche")
  if (!niche) return NextResponse.json({ error: "niche required" }, { status: 400 })

  const posts = await getPostsByNicheDb(niche)

  return NextResponse.json(
    { data: posts },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } },
  )
}
