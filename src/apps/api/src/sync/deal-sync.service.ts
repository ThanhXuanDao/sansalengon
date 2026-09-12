import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { parse as parseYaml } from "yaml";
import { readFileSync } from "fs";
import { join } from "path";
import { ShopeeAffiliateClient } from "../affiliate/shopee/client";
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client";
import { AppLogService } from "../shared/app-log.service";

interface NicheConfig {
  id: string;
  name: string;
  status: string;
  shopee?: { keyword_seeds: string[] };
  accesstrade?: { campaign_ids: string[] };
  filters: { min_discount_pct: number; min_price: number; max_price: number };
}

interface FetchedProduct {
  externalId: string;
  source: "shopee" | "accesstrade";
  name: string;
  imageUrl: string;
  shopUrl: string;
  affiliateUrl: string;
  currentPrice: number;
  originalPrice: number | null;
  commissionRate: number;
  rating: number | null;
}

interface SyncReport {
  niche: string;
  fetched: number;
  priceChanges: number;
  newDeals: number;
  skipped: number;
  durationMs: number;
}

const PRICE_HISTORY_RETENTION_DAYS = 90;
const SRC = "deal-sync";

@Injectable()
export class DealSyncService {
  private readonly log = new Logger(DealSyncService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly shopee: ShopeeAffiliateClient,
    private readonly accesstrade: AccessTradePublisherClient,
    private readonly appLog: AppLogService,
  ) {}

  @Cron("0 */4 * * *")
  async syncAllNiches() {
    const niches = this.loadActiveNiches();
    this.log.log(`Starting sync for ${niches.length} active niche(s)`);
    await this.appLog.info(`Bắt đầu đồng bộ sản phẩm`, { niches: niches.map((n) => n.id) }, SRC);

    const reports: SyncReport[] = [];
    for (const niche of niches) {
      const report = await this.syncNiche(niche).catch(async (e): Promise<SyncReport> => {
        this.log.error(`Sync failed for niche "${niche.id}": ${e.message}`);
        await this.appLog.error(`Sync thất bại cho ngách "${niche.name}"`, {
          niche: niche.id,
          error: e.message,
          stack: e.stack?.slice(0, 500),
        }, SRC);
        return { niche: niche.id, fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: 0 };
      });
      reports.push(report);
    }

    const total = reports.reduce(
      (acc, r) => ({
        fetched:       acc.fetched       + r.fetched,
        priceChanges:  acc.priceChanges  + r.priceChanges,
        newDeals:      acc.newDeals      + r.newDeals,
        skipped:       acc.skipped       + r.skipped,
      }),
      { fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0 }
    );

    this.log.log(`Sync complete — ${total.fetched} products, ${total.priceChanges} price changes, ${total.newDeals} new deals`);
    await this.appLog.info(`Hoàn tất đồng bộ sản phẩm`, {
      niches:       niches.length,
      fetched:      total.fetched,
      priceChanges: total.priceChanges,
      newDeals:     total.newDeals,
      skipped:      total.skipped,
      perNiche:     reports,
    }, SRC);

    await this.pruneOldPriceHistory();
  }

  async syncNiche(niche: NicheConfig): Promise<SyncReport> {
    const start = Date.now();
    this.log.log(`Syncing niche: ${niche.name}`);

    await this.prisma.category.upsert({
      where: { id: niche.id },
      update: {},
      create: { id: niche.id, name: niche.name, slug: niche.id },
    });

    const fetched = await this.fetchShopeeProducts(niche);
    const lastPriceMap = await this.fetchLastRecordedPrices(niche.id);

    const priceHistoryBatch: { productId: string; price: number }[] = [];
    let newDeals = 0;
    let skipped = 0;

    for (const p of fetched) {
      if (!this.passesFilter(p, niche.filters)) { skipped++; continue; }

      const product = await this.upsertProduct(p, niche.id);

      const lastPrice = lastPriceMap.get(product.id);
      if (lastPrice !== p.currentPrice) {
        priceHistoryBatch.push({ productId: product.id, price: p.currentPrice });
      }

      const discountPct = p.originalPrice
        ? Math.round(((p.originalPrice - p.currentPrice) / p.originalPrice) * 100)
        : 0;

      if (discountPct >= niche.filters.min_discount_pct) {
        await this.prisma.product.update({
          where: { id: product.id },
          data: { discountPct, isFeatured: discountPct >= 40 },
        });
        newDeals++;
      }
    }

    if (priceHistoryBatch.length > 0) {
      await this.prisma.priceHistory.createMany({ data: priceHistoryBatch });
    }

    const report: SyncReport = {
      niche: niche.id,
      fetched: fetched.length,
      priceChanges: priceHistoryBatch.length,
      newDeals,
      skipped,
      durationMs: Date.now() - start,
    };

    this.log.log(`[${niche.name}] fetched=${report.fetched} priceChanges=${report.priceChanges} newDeals=${report.newDeals} skipped=${report.skipped} (${report.durationMs}ms)`);
    await this.appLog.info(`Đồng bộ ngách "${niche.name}" hoàn tất`, report, SRC);
    return report;
  }

  private async fetchLastRecordedPrices(categoryId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ productId: string; price: number }[]>`
      SELECT DISTINCT ON (ph."productId") ph."productId", ph.price
      FROM "PriceHistory" ph
      INNER JOIN "Product" p ON p.id = ph."productId"
      WHERE p."categoryId" = ${categoryId}
      ORDER BY ph."productId", ph."recordedAt" DESC
    `;
    return new Map(rows.map((r) => [r.productId, r.price]));
  }

  private async pruneOldPriceHistory() {
    const cutoff = new Date(Date.now() - PRICE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.priceHistory.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.log.log(`Pruned ${count} price history records older than ${PRICE_HISTORY_RETENTION_DAYS} days`);
      await this.appLog.info(`Dọn lịch sử giá cũ`, { deleted: count, retentionDays: PRICE_HISTORY_RETENTION_DAYS }, SRC);
    }
  }

  private async fetchShopeeProducts(niche: NicheConfig): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];
    const keywords = niche.shopee?.keyword_seeds ?? [];

    for (const keyword of keywords) {
      try {
        const { nodes } = await this.shopee.productSearch({ keyword, pageSize: 20, sort: "SALES_DESC" });

        for (const node of nodes) {
          let affiliateUrl = node.productLink;
          try {
            const { shortLink } = await this.shopee.generateShortLink({ originUrl: node.productLink, subIds: [niche.id, "web"] });
            affiliateUrl = shortLink;
          } catch { /* fallback to original link */ }

          results.push({
            externalId: String(node.itemId),
            source: "shopee",
            name: node.productName,
            imageUrl: node.imageUrl ?? "",
            shopUrl: node.productLink,
            affiliateUrl,
            currentPrice: Math.round(node.priceMin * 100),
            originalPrice: null,
            commissionRate: Number(node.commissionRate),
            rating: null,
          });
        }
      } catch (e: any) {
        this.log.warn(`Shopee search failed for keyword "${keyword}": ${e.message}`);
        await this.appLog.warn(`Shopee search thất bại`, {
          niche: niche.id,
          keyword,
          error: e.message,
          code: e.code,
        }, SRC);
      }
    }

    return results;
  }

  private passesFilter(p: Pick<FetchedProduct, "currentPrice">, filters: { min_price: number; max_price: number }): boolean {
    return p.currentPrice >= filters.min_price && p.currentPrice <= filters.max_price;
  }

  private async upsertProduct(p: FetchedProduct, categoryId: string) {
    return this.prisma.product.upsert({
      where: { source_externalId: { source: p.source, externalId: p.externalId } },
      update: {
        price: p.currentPrice,
        affiliateUrl: p.affiliateUrl,
        lastSyncedAt: new Date(),
        isSoldOut: false,
      },
      create: {
        source: p.source,
        externalId: p.externalId,
        name: p.name,
        imageUrl: p.imageUrl,
        imageAlt: p.name,
        shopeeUrl: p.shopUrl,
        affiliateUrl: p.affiliateUrl,
        price: p.currentPrice,
        commission: Math.round(p.commissionRate),
        rating: p.rating ?? 0,
        categoryId,
      },
    });
  }

  private loadActiveNiches(): NicheConfig[] {
    const configPath = join(process.cwd(), "../../config/niches.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const { niches } = parseYaml(raw) as { niches: NicheConfig[] };
    return niches.filter((n) => n.status === "active");
  }
}
