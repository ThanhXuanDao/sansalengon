import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getNavPagesDb } from "@/lib/static-pages-db"

async function isCacheEnabled(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "store_settings" } })
    if (!row) return true
    const s = JSON.parse(row.value) as Record<string, unknown>
    return s.cacheEnabled !== false
  } catch {
    return true
  }
}

export async function GET() {
  const [nav, cacheOn] = await Promise.all([getNavPagesDb(), isCacheEnabled()])
  const headers = cacheOn
    ? { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" }
    : { "Cache-Control": "no-store, no-cache, must-revalidate" }
  return NextResponse.json(nav, { headers })
}
