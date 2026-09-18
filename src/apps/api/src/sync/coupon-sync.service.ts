import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client";
import { AppLogService } from "../shared/app-log.service";
import type { Trigger } from "../shared/app-log.service";

interface NicheConfig {
  id: string;
  name: string;
  status: string;
}

interface RawVoucher {
  nicheId: string | null;
  platform: string | null;
  merchant: string;
  code: string | null;
  description: string;
  discountValue: number;
  discountType: "percent" | "fixed";
  minOrderValue: number | null;
  maxDiscount: number | null;
  affiliateUrl: string;
  expiresAt: Date | null;
}

const AT_VOUCHER_API = "https://api.accesstrade.vn/v1/vouchers";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SRC = "coupon-sync";

@Injectable()
export class CouponSyncService {
  private readonly log = new Logger(CouponSyncService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly cfg: ConfigService,
    private readonly accesstrade: AccessTradePublisherClient,
    private readonly appLog: AppLogService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync"); }

  @Cron("0 6,18 * * *")
  async syncAllCoupons() {
    await this.triggerSync("all", "cron");
  }

  // Public method called by SyncController (manual / web-scheduled trigger)
  async triggerSync(sources: "all" | "accesstrade" | "platforms" = "all", trigger: Trigger = "manual"): Promise<{
    total: number;
    byNiche: Record<string, number>;
    byPlatform: Record<string, number>;
    durationMs: number;
  }> {
    this.log.log(`triggerSync coupons — sources: ${sources}`);
    await this.slog.info("Bắt đầu đồng bộ coupon", SRC, { sources }, trigger);

    const t0 = Date.now();
    await this.deactivateExpiredCoupons();

    const byNiche: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};

    if (sources === "all" || sources === "accesstrade") {
      const niches = await this.loadActiveNiches();
      for (const niche of niches) {
        const count = await this.syncNicheCoupons(niche).catch(async (e) => {
          this.log.error(`Coupon sync failed for niche "${niche.id}": ${e.message}`);
          await this.slog.error(`Sync coupon thất bại cho ngách "${niche.name}"`, SRC, {
            niche: niche.id, error: e.message,
          }, trigger);
          return 0;
        });
        byNiche[niche.id] = count;
        await sleep(1500);
      }
    }

    if (sources === "all" || sources === "platforms") {
      byPlatform.shopee = await this.syncShopeeVouchers().catch(() => 0);
      await sleep(3000);
      byPlatform.tiki = await this.syncTikiVouchers().catch(() => 0);
      await sleep(3000);
      byPlatform.lazada = await this.syncLazadaVouchers().catch(() => 0);
    }

    const total = Object.values(byNiche).reduce((a, b) => a + b, 0)
                + Object.values(byPlatform).reduce((a, b) => a + b, 0);

    this.log.log(`Coupon sync complete — ${total} coupons upserted`);
    await this.slog.info("Hoàn tất đồng bộ coupon", SRC, { total, byNiche, byPlatform }, trigger);

    return { total, byNiche, byPlatform, durationMs: Date.now() - t0 };
  }

  private async syncNicheCoupons(niche: NicheConfig): Promise<number> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY");
    if (!accessKey) {
      this.log.warn("ACCESSTRADE_ACCESS_KEY not set — skipping coupon sync");
      await this.slog.warn("ACCESSTRADE_ACCESS_KEY chưa cấu hình — bỏ qua coupon sync", SRC);
      return 0;
    }

    const vouchers = await this.fetchAccessTradeVouchers(accessKey, niche);
    if (!vouchers.length) return 0;

    let count = 0;
    for (const v of vouchers) {
      await this.prisma.coupon.upsert({
        where: { id: this.buildCouponId(niche.id, v) },
        update: {
          description: v.description,
          discountValue: v.discountValue,
          discountType: v.discountType,
          minOrderValue: v.minOrderValue,
          maxDiscount: v.maxDiscount,
          expiresAt: v.expiresAt,
          isActive: true,
        },
        create: {
          id: this.buildCouponId(niche.id, v),
          source: "accesstrade",
          platform: v.platform,
          nicheId: v.nicheId,
          merchant: v.merchant,
          code: v.code,
          description: v.description,
          discountValue: v.discountValue,
          discountType: v.discountType,
          minOrderValue: v.minOrderValue,
          maxDiscount: v.maxDiscount,
          affiliateUrl: v.affiliateUrl,
          expiresAt: v.expiresAt,
          isActive: true,
        },
      });
      count++;
    }

    this.log.log(`[${niche.name}] ${count} coupons synced`);
    await this.slog.info(`Đồng bộ coupon ngách "${niche.name}" hoàn tất`, SRC, { niche: niche.id, count });
    return count;
  }

  private async fetchAccessTradeVouchers(accessKey: string, niche: NicheConfig): Promise<RawVoucher[]> {
    try {
      // Auto-discover campaigns matching this niche by name/id
      const allCampaigns = await this.accesstrade.listCampaigns({ approval: "successful" });
      const keywords = [niche.name, niche.id].map((k) => k.toLowerCase().trim());
      const campaignIds = allCampaigns
        .filter((c) => keywords.some((kw) => c.name.toLowerCase().includes(kw) || c.merchant.toLowerCase().includes(kw)))
        .map((c) => c.id);
      const results: RawVoucher[] = [];

      for (let i = 0; i < campaignIds.length; i++) {
        const campaignId = campaignIds[i];
        if (i > 0) await sleep(1000);

        const url = new URL(AT_VOUCHER_API);
        url.searchParams.set("campaign_id", campaignId);
        url.searchParams.set("limit", "50");

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Token ${accessKey}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          this.log.warn(`AccessTrade voucher API ${res.status} for campaign ${campaignId}`);
          if (res.status === 429) {
            this.log.warn("AccessTrade rate limit hit — stopping campaign loop");
            await this.slog.warn("AccessTrade rate limit (429) — dừng loop campaign", SRC, {
              niche: niche.id,
              campaignId,
              processedSoFar: results.length,
            });
            break;
          }
          await this.slog.warn(`AccessTrade API lỗi ${res.status}`, SRC, { niche: niche.id, campaignId, status: res.status });
          continue;
        }

        const body = await res.json();
        const items: any[] = body?.data ?? body?.vouchers ?? (Array.isArray(body) ? body : []);
        for (const item of items) {
          const parsed = this.parseVoucher(item, niche);
          if (parsed) results.push(parsed);
        }
      }

      return results;
    } catch (e: any) {
      this.log.warn(`Failed to fetch vouchers for niche "${niche.id}": ${e.message}`);
      await this.slog.warn(`Lấy voucher thất bại cho ngách "${niche.id}"`, SRC, { error: e.message });
      return [];
    }
  }

  // ── Shopee ─────────────────────────────────────────────────
  private async syncShopeeVouchers(): Promise<number> {
    const accessKey = this.cfg.get<string>("SHOPEE_AFFILIATE_API_KEY");
    if (!accessKey) {
      this.log.debug("SHOPEE_AFFILIATE_API_KEY not set — skipping Shopee sync");
      return 0;
    }
    try {
      const res = await fetch("https://affiliate.shopee.vn/api/v1/vouchers?limit=50", {
        headers: { Authorization: `Bearer ${accessKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.log.warn(`Shopee affiliate API ${res.status}`);
        await this.slog.warn(`Shopee affiliate API lỗi ${res.status}`, SRC, { status: res.status });
        return 0;
      }
      const body = await res.json();
      const items: any[] = body?.data ?? (Array.isArray(body) ? body : []);
      let count = 0;
      for (const item of items) {
        const v = this.parseShopeeVoucher(item);
        if (!v) continue;
        await this.prisma.coupon.upsert({
          where: { id: this.buildCouponId("shopee", v) },
          update: { description: v.description, discountValue: v.discountValue, discountType: v.discountType, minOrderValue: v.minOrderValue, maxDiscount: v.maxDiscount, expiresAt: v.expiresAt, isActive: true },
          create: { id: this.buildCouponId("shopee", v), source: "shopee", platform: "shopee", nicheId: v.nicheId, merchant: v.merchant, code: v.code, description: v.description, discountValue: v.discountValue, discountType: v.discountType, minOrderValue: v.minOrderValue, maxDiscount: v.maxDiscount, affiliateUrl: v.affiliateUrl, expiresAt: v.expiresAt, isActive: true },
        });
        count++;
      }
      this.log.log(`[Shopee] ${count} vouchers synced`);
      await this.slog.info(`Đồng bộ voucher Shopee hoàn tất`, SRC, { count });
      return count;
    } catch (e: any) {
      this.log.warn(`Shopee sync failed: ${e.message}`);
      await this.slog.error(`Shopee voucher sync thất bại`, SRC, { error: e.message });
      return 0;
    }
  }

  // ── Tiki ───────────────────────────────────────────────────
  private async syncTikiVouchers(): Promise<number> {
    const accessKey = this.cfg.get<string>("TIKI_AFFILIATE_API_KEY");
    if (!accessKey) {
      this.log.debug("TIKI_AFFILIATE_API_KEY not set — skipping Tiki sync");
      return 0;
    }
    try {
      const res = await fetch("https://api.tiki.vn/raas/v2/vouchers?limit=50", {
        headers: { Authorization: `Bearer ${accessKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.log.warn(`Tiki affiliate API ${res.status}`);
        await this.slog.warn(`Tiki affiliate API lỗi ${res.status}`, SRC, { status: res.status });
        return 0;
      }
      const body = await res.json();
      const items: any[] = body?.data ?? (Array.isArray(body) ? body : []);
      let count = 0;
      for (const item of items) {
        const v = this.parseTikiVoucher(item);
        if (!v) continue;
        await this.prisma.coupon.upsert({
          where: { id: this.buildCouponId("tiki", v) },
          update: { description: v.description, discountValue: v.discountValue, discountType: v.discountType, minOrderValue: v.minOrderValue, maxDiscount: v.maxDiscount, expiresAt: v.expiresAt, isActive: true },
          create: { id: this.buildCouponId("tiki", v), source: "tiki", platform: "tiki", nicheId: v.nicheId, merchant: v.merchant, code: v.code, description: v.description, discountValue: v.discountValue, discountType: v.discountType, minOrderValue: v.minOrderValue, maxDiscount: v.maxDiscount, affiliateUrl: v.affiliateUrl, expiresAt: v.expiresAt, isActive: true },
        });
        count++;
      }
      this.log.log(`[Tiki] ${count} vouchers synced`);
      await this.slog.info(`Đồng bộ voucher Tiki hoàn tất`, SRC, { count });
      return count;
    } catch (e: any) {
      this.log.warn(`Tiki sync failed: ${e.message}`);
      await this.slog.error(`Tiki voucher sync thất bại`, SRC, { error: e.message });
      return 0;
    }
  }

  // ── Lazada ─────────────────────────────────────────────────
  private async syncLazadaVouchers(): Promise<number> {
    const accessKey = this.cfg.get<string>("LAZADA_AFFILIATE_API_KEY");
    if (!accessKey) {
      this.log.debug("LAZADA_AFFILIATE_API_KEY not set — skipping Lazada sync");
      return 0;
    }
    try {
      const res = await fetch("https://api.lazada.vn/rest/affiliate/vouchers?limit=50", {
        headers: { Authorization: `Bearer ${accessKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.log.warn(`Lazada affiliate API ${res.status}`);
        await this.slog.warn(`Lazada affiliate API lỗi ${res.status}`, SRC, { status: res.status });
        return 0;
      }
      const body = await res.json();
      const items: any[] = body?.result?.vouchers ?? body?.data ?? (Array.isArray(body) ? body : []);
      let count = 0;
      for (const item of items) {
        const v = this.parseLazadaVoucher(item);
        if (!v) continue;
        await this.prisma.coupon.upsert({
          where: { id: this.buildCouponId("lazada", v) },
          update: { description: v.description, discountValue: v.discountValue, discountType: v.discountType, minOrderValue: v.minOrderValue, maxDiscount: v.maxDiscount, expiresAt: v.expiresAt, isActive: true },
          create: { id: this.buildCouponId("lazada", v), source: "lazada", platform: "lazada", nicheId: v.nicheId, merchant: v.merchant, code: v.code, description: v.description, discountValue: v.discountValue, discountType: v.discountType, minOrderValue: v.minOrderValue, maxDiscount: v.maxDiscount, affiliateUrl: v.affiliateUrl, expiresAt: v.expiresAt, isActive: true },
        });
        count++;
      }
      this.log.log(`[Lazada] ${count} vouchers synced`);
      await this.slog.info(`Đồng bộ voucher Lazada hoàn tất`, SRC, { count });
      return count;
    } catch (e: any) {
      this.log.warn(`Lazada sync failed: ${e.message}`);
      await this.slog.error(`Lazada voucher sync thất bại`, SRC, { error: e.message });
      return 0;
    }
  }

  private async deactivateExpiredCoupons() {
    const { count } = await this.prisma.coupon.updateMany({
      where: { isActive: true, expiresAt: { lt: new Date() } },
      data: { isActive: false },
    });
    if (count > 0) {
      this.log.log(`Deactivated ${count} expired coupons`);
      await this.slog.info(`Vô hiệu hóa coupon hết hạn`, SRC, { count });
    }
  }

  // ── Parsers (unchanged) ────────────────────────────────────

  private parseShopeeVoucher(item: any): RawVoucher | null {
    try {
      const code = item.promotionCode ?? item.code ?? null;
      const description = item.name ?? item.description ?? item.title ?? "";
      if (!description) return null;
      const discountValue = Number(item.discountAmount ?? item.discountRate ?? 0);
      const discountType: "percent" | "fixed" = item.discountType === "FIXED_AMOUNT" || item.discountType === "fixed" ? "fixed" : "percent";
      const affiliateUrl = item.deeplink ?? item.affiliateLink ?? item.url ?? "https://shopee.vn";
      return { nicheId: null, platform: "shopee", merchant: item.shopName ?? "Shopee", code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 200), discountValue: Math.abs(discountValue), discountType, minOrderValue: item.minimumOrderPrice ?? item.minSpend ?? null, maxDiscount: item.maxDiscount ?? null, affiliateUrl: String(affiliateUrl), expiresAt: item.endTime ? new Date(Number(item.endTime) * 1000) : null };
    } catch { return null; }
  }

  private parseTikiVoucher(item: any): RawVoucher | null {
    try {
      const code = item.code ?? item.voucher_code ?? null;
      const description = item.description ?? item.title ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_amount ?? item.discount_percent ?? 0);
      const discountType: "percent" | "fixed" = item.discount_type === "amount" || item.discount_type === "fixed" ? "fixed" : "percent";
      return { nicheId: null, platform: "tiki", merchant: item.brand ?? "Tiki", code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 200), discountValue: Math.abs(discountValue), discountType, minOrderValue: item.min_order_price ?? null, maxDiscount: item.max_discount_amount ?? null, affiliateUrl: item.url ?? item.tracking_url ?? "https://tiki.vn", expiresAt: item.expire_date ? new Date(item.expire_date) : null };
    } catch { return null; }
  }

  private parseLazadaVoucher(item: any): RawVoucher | null {
    try {
      const code = item.voucher_code ?? item.code ?? null;
      const description = item.title ?? item.description ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_value ?? item.discount ?? 0);
      const discountType: "percent" | "fixed" = item.voucher_type === "MONETARY" || item.voucher_type === "fixed" ? "fixed" : "percent";
      return { nicheId: null, platform: "lazada", merchant: item.seller_name ?? "Lazada", code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 200), discountValue: Math.abs(discountValue), discountType, minOrderValue: item.min_spend ?? null, maxDiscount: item.max_discount_amount ?? null, affiliateUrl: item.tracking_url ?? item.url ?? "https://lazada.vn", expiresAt: item.end_time ? new Date(item.end_time) : null };
    } catch { return null; }
  }

  private parseVoucher(item: any, niche: NicheConfig): RawVoucher | null {
    try {
      const code = item.code ?? item.voucher_code ?? item.coupon_code ?? null;
      const description = item.description ?? item.title ?? item.name ?? item.content ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_value ?? item.value ?? item.amount ?? 0);
      const discountType = item.discount_type === "fixed" || item.type === "fixed" ? "fixed" : "percent";
      const expiresAt = item.expire_date ?? item.end_date ?? item.expired_at ?? null;
      let affiliateUrl = item.link ?? item.url ?? item.landing_url ?? "";
      if (!affiliateUrl) affiliateUrl = `https://accesstrade.vn`;
      return { nicheId: niche.id, platform: null, merchant: item.merchant ?? item.brand ?? item.shop_name ?? niche.name, code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 200), discountValue: Math.abs(discountValue), discountType: discountType as "percent" | "fixed", minOrderValue: item.min_order ?? item.minimum_order ?? null, maxDiscount: item.max_discount ?? item.maximum_discount ?? null, affiliateUrl: String(affiliateUrl), expiresAt: expiresAt ? new Date(expiresAt) : null };
    } catch { return null; }
  }

  private buildCouponId(nicheId: string, v: RawVoucher): string {
    return [nicheId, v.merchant, v.code ?? v.description.slice(0, 20)]
      .join("-").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 64);
  }

  async loadActiveNiches(): Promise<NicheConfig[]> {
    const rows = await this.prisma.niche.findMany({
      where: { status: "active" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
    }));
  }
}
