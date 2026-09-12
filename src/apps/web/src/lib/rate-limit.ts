import { prisma } from "./prisma"

export async function rateLimit(
  key: string,
  { max = 5, windowMs = 60_000 }: { max?: number; windowMs?: number } = {}
): Promise<{ allowed: boolean }> {
  const now = new Date()

  try {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.rateLimit.findUnique({ where: { key } })

      if (!entry || entry.resetAt < now) {
        await tx.rateLimit.upsert({
          where: { key },
          update: { count: 1, resetAt: new Date(Date.now() + windowMs) },
          create: { key, count: 1, resetAt: new Date(Date.now() + windowMs) },
        })
        return { allowed: true }
      }

      if (entry.count >= max) {
        return { allowed: false }
      }

      await tx.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      })
      return { allowed: true }
    })

    return result
  } catch {
    // DB failure → fail open so legitimate users are never blocked by infra issues
    return { allowed: true }
  }
}
