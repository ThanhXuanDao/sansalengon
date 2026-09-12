import { prisma } from "@/lib/prisma"
import type { JobConfig, JobResult } from "../types"

export async function couponExpireHandler(_config: JobConfig): Promise<JobResult> {
  const before = await prisma.coupon.count({ where: { isActive: true } })

  const result = await prisma.coupon.updateMany({
    where: { expiresAt: { lt: new Date() }, isActive: true },
    data: { isActive: false },
  })

  const after = await prisma.coupon.count({ where: { isActive: true } })

  return {
    itemsTotal: before,
    itemsSuccess: result.count,
    itemsFailed: 0,
    summary: `Deactivate ${result.count} coupon hết hạn. Còn lại ${after} coupon active.`,
    meta: { deactivated: result.count, remaining: after },
  }
}
