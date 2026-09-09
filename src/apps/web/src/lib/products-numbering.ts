import { prisma } from "@/lib/prisma"

export async function getProductNumberMap(): Promise<Map<string, number>> {
  const products = await prisma.product.findMany({
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
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
