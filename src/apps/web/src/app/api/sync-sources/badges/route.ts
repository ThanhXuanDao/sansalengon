import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export interface PlatformBadge {
  label: string
  bg: string
  text: string
}

export async function GET() {
  const sources = await prisma.syncSource.findMany({
    select: { slug: true, config: true },
  })

  const badges: Record<string, PlatformBadge> = {}

  for (const src of sources) {
    try {
      const cfg = JSON.parse(src.config as string) as Record<string, unknown>
      const b = cfg.badge as { label?: string; bg?: string; text?: string } | undefined
      if (b?.label && b?.bg && b?.text) {
        badges[src.slug] = { label: b.label, bg: b.bg, text: b.text }
      }
    } catch { /* malformed config — skip */ }
  }

  return NextResponse.json(badges, {
    headers: { "Cache-Control": "public, max-age=300" },
  })
}
