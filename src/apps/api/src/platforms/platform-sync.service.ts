import { Injectable, Logger, Inject } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { PrismaClient } from "@prisma/client"
import { PlatformAdapter } from "./platform.adapter"
import { ProductMatcherService } from "./matcher/product-matcher.service"

// Thresholds
const CONFIDENCE_AUTO_CONFIRM = 0.95
const CONFIDENCE_PENDING      = 0.85
const PRICE_DELTA_SUSPICIOUS  = 3.0   // if candidate price > 3× product price → reject
const MATCH_BATCH_SIZE        = 20    // products per cron tick to avoid overloading APIs

@Injectable()
export class PlatformSyncService {
  private readonly log = new Logger(PlatformSyncService.name)
  private readonly prisma = new PrismaClient()

  constructor(
    @Inject(PlatformAdapter) private readonly adapters: PlatformAdapter[],
    private readonly matcher: ProductMatcherService,
  ) {}

  // ── Matching job: nightly at 2am ─────────────────────────────
  @Cron("0 2 * * *")
  async runMatchingJob() {
    this.log.log("Starting nightly product matching job")

    const activeAdapters = this.adapters.filter((a) => a.platformId !== "shopee")

    for (const adapter of activeAdapters) {
      await this.matchForPlatform(adapter).catch((e) =>
        this.log.error(`Matching failed for ${adapter.platformId}: ${e.message}`)
      )
    }

    this.log.log("Nightly matching job complete")
  }

  // ── Price refresh: every 4 hours, after main sync ────────────
  @Cron("30 */4 * * *")
  async refreshPlatformPrices() {
    this.log.log("Refreshing cross-platform prices")

    const confirmed = await this.prisma.platformProduct.findMany({
      include: { platform: true },
    })

    for (const pp of confirmed) {
      const adapter = this.adapters.find((a) => a.platformId === pp.platformId)
      if (!adapter) continue

      try {
        const update = await adapter.fetchPrice(pp.platformProductId)

        await this.prisma.$transaction([
          this.prisma.platformProduct.update({
            where: { id: pp.id },
            data: {
              currentPrice: update.price,
              inStock: update.inStock,
              lastChecked: new Date(),
            },
          }),
          // Record price history for this platform
          this.prisma.priceHistory.create({
            data: {
              productId: pp.productId,
              platformId: pp.platformId,
              price: update.price,
            },
          }),
        ])
      } catch {
        // fetchPrice not implemented for all adapters — silently skip
      }
    }

    this.log.log(`Refreshed ${confirmed.length} platform products`)
  }

  // ── Admin: manually confirm a match ─────────────────────────
  async confirmMatch(matchId: string, confirmedBy = "auto"): Promise<void> {
    const match = await this.prisma.productMatch.findUniqueOrThrow({
      where: { id: matchId },
    })

    await this.prisma.$transaction([
      this.prisma.productMatch.update({
        where: { id: matchId },
        data: { status: "CONFIRMED", confirmedBy },
      }),
      this.prisma.platformProduct.upsert({
        where: {
          productId_platformId: {
            productId: match.productId,
            platformId: match.platformId,
          },
        },
        update: {
          platformUrl: match.candidateUrl,
          currentPrice: match.candidatePrice ?? 0,
          lastChecked: new Date(),
        },
        create: {
          productId: match.productId,
          platformId: match.platformId,
          platformProductId: this.extractProductId(match.candidateUrl, match.platformId),
          platformUrl: match.candidateUrl,
          currentPrice: match.candidatePrice ?? 0,
          lastChecked: new Date(),
        },
      }),
    ])
  }

  async rejectMatch(matchId: string): Promise<void> {
    await this.prisma.productMatch.update({
      where: { id: matchId },
      data: { status: "REJECTED" },
    })
  }

  // ── Internal: match all products for one platform ────────────
  private async matchForPlatform(adapter: PlatformAdapter): Promise<void> {
    // Find products that don't yet have a confirmed match on this platform
    const products = await this.prisma.$queryRaw<{ id: string; name: string; price: number }[]>`
      SELECT p.id, p.name, p.price
      FROM "Product" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "PlatformProduct" pp
        WHERE pp."productId" = p.id AND pp."platformId" = ${adapter.platformId}
      )
      AND NOT EXISTS (
        SELECT 1 FROM "ProductMatch" pm
        WHERE pm."productId" = p.id
          AND pm."platformId" = ${adapter.platformId}
          AND pm.status != 'REJECTED'
      )
      LIMIT ${MATCH_BATCH_SIZE}
    `

    this.log.log(`[${adapter.platformId}] Matching ${products.length} unmatched products`)

    for (const product of products) {
      await this.matchProduct(product, adapter).catch((e) =>
        this.log.warn(`[${adapter.platformId}] Match error for "${product.name}": ${e.message}`)
      )
    }
  }

  private async matchProduct(
    product: { id: string; name: string; price: number },
    adapter: PlatformAdapter,
  ): Promise<void> {
    const candidates = await this.matcher.findCandidates(product.name, adapter, 3)

    for (const candidate of candidates) {
      // Suspicious price guard: reject if price is wildly different
      if (candidate.candidatePrice > 0 && product.price > 0) {
        const ratio = candidate.candidatePrice / product.price
        if (ratio > PRICE_DELTA_SUSPICIOUS || ratio < 1 / PRICE_DELTA_SUSPICIOUS) {
          this.log.debug(`[${adapter.platformId}] Skipping suspicious price for "${candidate.candidateName}" (ratio ${ratio.toFixed(2)})`)
          continue
        }
      }

      const status =
        candidate.confidence >= CONFIDENCE_AUTO_CONFIRM ? "CONFIRMED" : "PENDING"

      const match = await this.prisma.productMatch.create({
        data: {
          productId: product.id,
          platformId: adapter.platformId,
          candidateUrl: candidate.platformUrl,
          candidateName: candidate.candidateName,
          candidatePrice: candidate.candidatePrice,
          confidence: candidate.confidence,
          status,
          confirmedBy: status === "CONFIRMED" ? "auto" : undefined,
        },
      })

      if (status === "CONFIRMED") {
        await this.confirmMatch(match.id, "auto")
        this.log.log(`[${adapter.platformId}] Auto-confirmed "${product.name}" → "${candidate.candidateName}" (${(candidate.confidence * 100).toFixed(0)}%)`)
      }

      break // only process the top candidate per product per cron tick
    }
  }

  private extractProductId(url: string, platformId: string): string {
    // Best-effort extraction from URL; falls back to URL hash
    if (platformId === "lazada") {
      const m = url.match(/i(\d+)-s(\d+)/)
      if (m) return m[1]
    }
    if (platformId === "tiki") {
      const m = url.match(/p(\d+)\.html/)
      if (m) return m[1]
    }
    // Generic fallback
    return Buffer.from(url).toString("base64url").slice(0, 20)
  }
}
