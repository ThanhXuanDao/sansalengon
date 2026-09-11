import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { parse as parseYaml } from "yaml";
import { readFileSync } from "fs";
import { join } from "path";
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client";

interface NicheConfig {
  id: string;
  name: string;
  status: string;
  accesstrade?: { campaign_ids: string[] };
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

@Injectable()
export class CouponSyncService {
  private readonly log = new Logger(CouponSyncService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly cfg: ConfigService,
    private readonly accesstrade: AccessTradePublisherClient,
  ) {}

  // Sync 2 lần/ngày — voucher thay đổi ít hơn giá sản phẩm
  @Cron("0 6,18 * * *")
  async syncAllCoupons() {
    this.log.log("Starting coupon sync");
    const niches = this.loadActiveNiches();

    await this.deactivateExpiredCoupons();

    let total = 0;
    for (const niche of niches) {
      const count = await this.syncNicheCoupons(niche).catch((e) => {
        this.log.error(`Coupon sync failed for niche "${niche.id}": ${e.message}`);
        return 0;
      });
      total += count;
      // Tránh burst nhiều niche liên tiếp → 1.5s giữa mỗi niche
      await sleep(1500);
    }

    // Sync từ các sàn khác — delay 3s giữa mỗi platform
    const shopee = await this.syncShopeeVouchers().catch(() => 0);
    await sleep(3000);
    const tiki = await this.syncTikiVouchers().catch(() => 0);
    await sleep(3000);
    const lazada = await this.syncLazadaVouchers().catch(() => 0);
    total += shopee + tiki + lazada;

    this.log.log(`Coupon sync complete — ${total} coupons upserted`);
  }

  private async syncNicheCoupons(niche: NicheConfig): Promise<number> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY");
    if (!accessKey) {
      this.log.warn("ACCESSTRADE_ACCESS_KEY not set — skipping coupon sync");
      return 0;
    }

    const vouchers = await this.fetchAccessTradeVouchers(accessKey, niche);
    if (!vouchers.length) return 0;

    // Upsert theo externalId nếu có, tạo mới nếu không có
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
    return count;
  }

  private async fetchAccessTradeVouchers(
    accessKey: string,
    niche: NicheConfig,
  ): Promise<RawVoucher[]> {
    try {
      const campaignIds = niche.accesstrade?.campaign_ids ?? [];

      // Gọi AccessTrade voucher API cho từng campaign
      const results: RawVoucher[] = [];

      for (let i = 0; i < campaignIds.length; i++) {
        const campaignId = campaignIds[i];
        // 1s giữa mỗi campaign để không bị rate-limit AccessTrade
        if (i > 0) await sleep(1000);

        const url = new URL(AT_VOUCHER_API);
        url.searchParams.set("campaign_id", campaignId);
        url.searchParams.set("limit", "50");

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Token ${accessKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          this.log.warn(`AccessTrade voucher API ${res.status} for campaign ${campaignId}`);
          // 429 = bị rate limit, dừng hẳn loop này
          if (res.status === 429) {
            this.log.warn("AccessTrade rate limit hit — stopping campaign loop");
            break;
          }
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
      return [];
    }
  }

  // ── Shopee Affiliate Vouchers ─────────────────────────────
  private async syncShopeeVouchers(): Promise<number> {
    const accessKey = this.cfg.get<string>("SHOPEE_AFFILIATE_API_KEY");
    if (!accessKey) {
      this.log.debug("SHOPEE_AFFILIATE_API_KEY not set — skipping Shopee sync");
      return 0;
    }
    try {
      // Shopee Affiliate API: https://affiliate.shopee.vn/api/v1/vouchers
      const res = await fetch("https://affiliate.shopee.vn/api/v1/vouchers?limit=50", {
        headers: {
          Authorization: `Bearer ${accessKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.log.warn(`Shopee affiliate API ${res.status}`);
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
            id: this.buildCouponId("shopee", v),
            source: "shopee",
            platform: "shopee",
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
      this.log.log(`[Shopee] ${count} vouchers synced`);
      return count;
    } catch (e: any) {
      this.log.warn(`Shopee sync failed: ${e.message}`);
      return 0;
    }
  }

  private parseShopeeVoucher(item: any): RawVoucher | null {
    try {
      const code = item.promotionCode ?? item.code ?? null;
      const description = item.name ?? item.description ?? item.title ?? "";
      if (!description) return null;
      const discountValue = Number(item.discountAmount ?? item.discountRate ?? 0);
      const discountType: "percent" | "fixed" =
        item.discountType === "FIXED_AMOUNT" || item.discountType === "fixed" ? "fixed" : "percent";
      const affiliateUrl = item.deeplink ?? item.affiliateLink ?? item.url ?? "https://shopee.vn";
      return {
        nicheId: null,
        platform: "shopee",
        merchant: item.shopName ?? "Shopee",
        code: code ? String(code).toUpperCase().trim() : null,
        description: String(description).slice(0, 200),
        discountValue: Math.abs(discountValue),
        discountType,
        minOrderValue: item.minimumOrderPrice ?? item.minSpend ?? null,
        maxDiscount: item.maxDiscount ?? null,
        affiliateUrl: String(affiliateUrl),
        expiresAt: item.endTime ? new Date(Number(item.endTime) * 1000) : null,
      };
    } catch {
      return null;
    }
  }

  // ── Tiki Vouchers ─────────────────────────────────────────
  private async syncTikiVouchers(): Promise<number> {
    const accessKey = this.cfg.get<string>("TIKI_AFFILIATE_API_KEY");
    if (!accessKey) {
      this.log.debug("TIKI_AFFILIATE_API_KEY not set — skipping Tiki sync");
      return 0;
    }
    try {
      const res = await fetch("https://api.tiki.vn/raas/v2/vouchers?limit=50", {
        headers: {
          Authorization: `Bearer ${accessKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.log.warn(`Tiki affiliate API ${res.status}`);
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
            id: this.buildCouponId("tiki", v),
            source: "tiki",
            platform: "tiki",
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
      this.log.log(`[Tiki] ${count} vouchers synced`);
      return count;
    } catch (e: any) {
      this.log.warn(`Tiki sync failed: ${e.message}`);
      return 0;
    }
  }

  private parseTikiVoucher(item: any): RawVoucher | null {
    try {
      const code = item.code ?? item.voucher_code ?? null;
      const description = item.description ?? item.title ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_amount ?? item.discount_percent ?? 0);
      const discountType: "percent" | "fixed" =
        item.discount_type === "amount" || item.discount_type === "fixed" ? "fixed" : "percent";
      const affiliateUrl = item.url ?? item.tracking_url ?? "https://tiki.vn";
      return {
        nicheId: null,
        platform: "tiki",
        merchant: item.brand ?? "Tiki",
        code: code ? String(code).toUpperCase().trim() : null,
        description: String(description).slice(0, 200),
        discountValue: Math.abs(discountValue),
        discountType,
        minOrderValue: item.min_order_price ?? null,
        maxDiscount: item.max_discount_amount ?? null,
        affiliateUrl: String(affiliateUrl),
        expiresAt: item.expire_date ? new Date(item.expire_date) : null,
      };
    } catch {
      return null;
    }
  }

  // ── Lazada Vouchers ───────────────────────────────────────
  private async syncLazadaVouchers(): Promise<number> {
    const accessKey = this.cfg.get<string>("LAZADA_AFFILIATE_API_KEY");
    if (!accessKey) {
      this.log.debug("LAZADA_AFFILIATE_API_KEY not set — skipping Lazada sync");
      return 0;
    }
    try {
      const res = await fetch("https://api.lazada.vn/rest/affiliate/vouchers?limit=50", {
        headers: {
          Authorization: `Bearer ${accessKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.log.warn(`Lazada affiliate API ${res.status}`);
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
            id: this.buildCouponId("lazada", v),
            source: "lazada",
            platform: "lazada",
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
      this.log.log(`[Lazada] ${count} vouchers synced`);
      return count;
    } catch (e: any) {
      this.log.warn(`Lazada sync failed: ${e.message}`);
      return 0;
    }
  }

  private parseLazadaVoucher(item: any): RawVoucher | null {
    try {
      const code = item.voucher_code ?? item.code ?? null;
      const description = item.title ?? item.description ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_value ?? item.discount ?? 0);
      const discountType: "percent" | "fixed" =
        item.voucher_type === "MONETARY" || item.voucher_type === "fixed" ? "fixed" : "percent";
      const affiliateUrl = item.tracking_url ?? item.url ?? "https://lazada.vn";
      return {
        nicheId: null,
        platform: "lazada",
        merchant: item.seller_name ?? "Lazada",
        code: code ? String(code).toUpperCase().trim() : null,
        description: String(description).slice(0, 200),
        discountValue: Math.abs(discountValue),
        discountType,
        minOrderValue: item.min_spend ?? null,
        maxDiscount: item.max_discount_amount ?? null,
        affiliateUrl: String(affiliateUrl),
        expiresAt: item.end_time ? new Date(item.end_time) : null,
      };
    } catch {
      return null;
    }
  }

  private parseVoucher(item: any, niche: NicheConfig): RawVoucher | null {
    try {
      const code = item.code ?? item.voucher_code ?? item.coupon_code ?? null;
      const description =
        item.description ?? item.title ?? item.name ?? item.content ?? "";
      if (!description) return null;

      const discountValue = Number(
        item.discount_value ?? item.value ?? item.amount ?? 0
      );
      const discountType =
        item.discount_type === "fixed" || item.type === "fixed" ? "fixed" : "percent";

      const expiresAt = item.expire_date ?? item.end_date ?? item.expired_at ?? null;

      // Tạo affiliate link để tracking
      let affiliateUrl = item.link ?? item.url ?? item.landing_url ?? "";
      // Nếu không có link cụ thể, dùng campaign URL
      if (!affiliateUrl) {
        affiliateUrl = `https://accesstrade.vn/click/${niche.accesstrade?.campaign_ids?.[0] ?? ""}`;
      }

      return {
        nicheId: niche.id,
        platform: null,
        merchant: item.merchant ?? item.brand ?? item.shop_name ?? niche.name,
        code: code ? String(code).toUpperCase().trim() : null,
        description: String(description).slice(0, 200),
        discountValue: Math.abs(discountValue),
        discountType,
        minOrderValue: item.min_order ?? item.minimum_order ?? null,
        maxDiscount: item.max_discount ?? item.maximum_discount ?? null,
        affiliateUrl: String(affiliateUrl),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      };
    } catch {
      return null;
    }
  }

  private buildCouponId(nicheId: string, v: RawVoucher): string {
    const key = [nicheId, v.merchant, v.code ?? v.description.slice(0, 20)]
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 64);
    return key;
  }

  private async deactivateExpiredCoupons() {
    const { count } = await this.prisma.coupon.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
      data: { isActive: false },
    });
    if (count > 0) this.log.log(`Deactivated ${count} expired coupons`);
  }

  private loadActiveNiches(): NicheConfig[] {
    const configPath = join(process.cwd(), "../../config/niches.yaml");
    const raw = readFileSync(configPath, "utf-8");
    const { niches } = parseYaml(raw) as { niches: NicheConfig[] };
    return niches.filter((n) => n.status === "active");
  }
}
