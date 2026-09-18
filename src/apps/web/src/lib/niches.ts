import { prisma } from "./prisma"

export interface NicheConfig {
  id: string
  name: string
  emoji: string
  status: string
  description: string
  metaKeywords: string
  categorySlug: string      // = id, giữ backward compat
  // Content
  postPrefix: string
  hashtags: string
  zaloOaId: string | null
  sortOrder: number
}

function dbToConfig(row: {
  id: string
  name: string
  emoji: string
  status: string
  description: string | null
  metaKeywords: string | null
  sortOrder: number
  postPrefix: string | null
  hashtags: string | null
  zaloOaId: string | null
}): NicheConfig {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    status: row.status,
    description: row.description ?? "",
    metaKeywords: row.metaKeywords ?? "",
    categorySlug: row.id,
    postPrefix: row.postPrefix ?? "🔥 Deal hôm nay",
    hashtags: row.hashtags ?? "#deal #shopee",
    zaloOaId: row.zaloOaId,
    sortOrder: row.sortOrder,
  }
}

export async function getActiveNiches(): Promise<NicheConfig[]> {
  try {
    const rows = await prisma.niche.findMany({
      where: { status: "active" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return rows.map(dbToConfig)
  } catch {
    return []
  }
}

export async function getAllNiches(): Promise<NicheConfig[]> {
  try {
    const rows = await prisma.niche.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return rows.map(dbToConfig)
  } catch {
    return []
  }
}

export async function getNiche(id: string): Promise<NicheConfig | undefined> {
  try {
    const row = await prisma.niche.findUnique({ where: { id } })
    return row ? dbToConfig(row) : undefined
  } catch {
    return undefined
  }
}

export async function getNicheByCategory(categorySlug: string): Promise<NicheConfig | undefined> {
  // categorySlug = niche.id (by design)
  return getNiche(categorySlug)
}
