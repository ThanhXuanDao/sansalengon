import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"

// Full table scan — cache 60s so multiple concurrent requests don't each hit DB.
const getCachedNumberEntries = unstable_cache(
  async (): Promise<{ id: string; createdAt: Date }[]> =>
    prisma.product.findMany({
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ["product-number-map"],
  { revalidate: 60 },
)

export async function getProductNumberMap(): Promise<Map<string, number>> {
  const products = await getCachedNumberEntries()
  const map = new Map<string, number>()
  products.forEach((p, i) => map.set(p.id, i + 1))
  return map
}

export function resolveNumberRangeToIds(map: Map<string, number>, from: number, to: number): string[] {
  const ids: string[] = []
  for (const [id, number] of map) {
    if (number >= from && number <= to) {
      ids.push(id)
    }
  }
  return ids
}
