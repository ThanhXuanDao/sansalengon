import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client";
import { AppLogService } from "../shared/app-log.service";
import { sleep } from "./sync.constants";
import type { Trigger } from "../shared/app-log.service";
import { AtCampaignService } from "../shared/at-campaign.service";

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
  terms: string | null;
  imageUrl: string | null;
  discountValue: number;
  discountType: "percent" | "fixed";
  minOrderValue: number | null;
  maxDiscount: number | null;
  affiliateUrl: string;
  expiresAt: Date | null;
  /** Stable external ID — overrides description-based ID in buildCouponId */
  externalId?: string;
}

const AT_VOUCHER_API = "https://api.accesstrade.vn/v1/vouchers";
const SRC = "coupon-sync";

interface CouponScraperConfig {
  type: "coupon-scraper";
  parser: string;              // e.g. "tch-promo" | "concung-voucher"
  promoUrl: string;            // URL dùng cho AT tracking link (user click vào đây)
  atMerchantSlug: string;      // merchant field trong AtCampaign để lookup campaign ID
  merchant: string;            // Tên hiển thị
  merchantLogo?: string;       // URL logo
  nicheId: string;             // Niche phân loại
  platform: string;            // Badge key (e.g. "tch", "concung")
  /** URL fetch HTML để extract vouchers — nếu khác promoUrl (vd: product detail page) */
  voucherFetchUrl?: string;
}

@Injectable()
export class CouponSyncService {
  private readonly log = new Logger(CouponSyncService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly cfg: ConfigService,
    private readonly accesstrade: AccessTradePublisherClient,
    private readonly appLog: AppLogService,
    private readonly atCampaignSvc: AtCampaignService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync"); }

  @Cron("0 6,18 * * *")
  async syncAllCoupons() {
    await this.triggerSync("all", "cron");
  }

  // Public method called by SyncController (manual / web-scheduled trigger)
  async triggerSync(sources: "all" | "accesstrade" | "platforms" | "merchants" | string = "all", trigger: Trigger = "manual"): Promise<{
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

    // Slug cụ thể của một coupon-scraper source → chỉ chạy source đó
    const KNOWN_SOURCES = new Set(["all", "accesstrade", "platforms", "merchants"]);
    if (!KNOWN_SOURCES.has(sources)) {
      const scraperSources = await this.loadCouponScraperSources();
      const target = scraperSources.find(({ slug }) => slug === sources);
      if (target) {
        byPlatform[target.cfg.platform] = await this.syncCouponScraperSource(target.slug, target.cfg).catch(async (e) => {
          this.log.error(`Coupon scraper [${target.slug}] failed: ${e.message}`);
          await this.slog.error(`Coupon scraper thất bại: ${target.slug}`, SRC, { slug: target.slug, error: e.message }, trigger);
          return 0;
        });
      } else {
        this.log.warn(`triggerSync: unknown source slug "${sources}" — bỏ qua`);
      }
      const total = Object.values(byPlatform).reduce((a, b) => a + b, 0);
      this.log.log(`Coupon sync complete — ${total} coupons upserted`);
      await this.slog.info("Hoàn tất đồng bộ coupon", SRC, { total, byNiche, byPlatform }, trigger);
      return { total, byNiche, byPlatform, durationMs: Date.now() - t0 };
    }

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

    if (sources === "all" || sources === "merchants") {
      const scraperSources = await this.loadCouponScraperSources();
      for (const { slug, cfg } of scraperSources) {
        byPlatform[cfg.platform] = await this.syncCouponScraperSource(slug, cfg).catch(async (e) => {
          this.log.error(`Coupon scraper [${slug}] failed: ${e.message}`);
          await this.slog.error(`Coupon scraper thất bại: ${slug}`, SRC, { slug, error: e.message }, trigger);
          return 0;
        });
        await sleep(2000);
      }
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
      await this.upsertCoupon(this.buildCouponId(niche.id, v), v, "accesstrade");
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
        await this.upsertCoupon(this.buildCouponId("shopee", v), v, "shopee");
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
        await this.upsertCoupon(this.buildCouponId("tiki", v), v, "tiki");
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
        await this.upsertCoupon(this.buildCouponId("lazada", v), v, "lazada");
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
      const imageUrl = item.bannerImage ?? item.imageUrl ?? item.image ?? item.banner ?? null;
      const terms = item.usageCondition ?? item.condition ?? item.terms ?? item.termAndCondition ?? null;
      return { nicheId: null, platform: "shopee", merchant: item.shopName ?? "Shopee", code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 500), terms: terms ? String(terms).slice(0, 1000) : null, imageUrl: imageUrl ? String(imageUrl) : null, discountValue: Math.abs(discountValue), discountType, minOrderValue: item.minimumOrderPrice ?? item.minSpend ?? null, maxDiscount: item.maxDiscount ?? null, affiliateUrl: String(affiliateUrl), expiresAt: item.endTime ? new Date(Number(item.endTime) * 1000) : null };
    } catch { return null; }
  }

  private parseTikiVoucher(item: any): RawVoucher | null {
    try {
      const code = item.code ?? item.voucher_code ?? null;
      const description = item.description ?? item.title ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_amount ?? item.discount_percent ?? 0);
      const discountType: "percent" | "fixed" = item.discount_type === "amount" || item.discount_type === "fixed" ? "fixed" : "percent";
      const imageUrl = item.image_url ?? item.thumbnail ?? item.banner_url ?? item.image ?? null;
      const terms = item.condition ?? item.usage_condition ?? item.terms ?? item.requirement ?? null;
      return { nicheId: null, platform: "tiki", merchant: item.brand ?? "Tiki", code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 500), terms: terms ? String(terms).slice(0, 1000) : null, imageUrl: imageUrl ? String(imageUrl) : null, discountValue: Math.abs(discountValue), discountType, minOrderValue: item.min_order_price ?? null, maxDiscount: item.max_discount_amount ?? null, affiliateUrl: item.url ?? item.tracking_url ?? "https://tiki.vn", expiresAt: item.expire_date ? new Date(item.expire_date) : null };
    } catch { return null; }
  }

  private parseLazadaVoucher(item: any): RawVoucher | null {
    try {
      const code = item.voucher_code ?? item.code ?? null;
      const description = item.title ?? item.description ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_value ?? item.discount ?? 0);
      const discountType: "percent" | "fixed" = item.voucher_type === "MONETARY" || item.voucher_type === "fixed" ? "fixed" : "percent";
      const imageUrl = item.image_url ?? item.banner_url ?? item.banner ?? item.image ?? null;
      const terms = item.terms_and_conditions ?? item.condition ?? item.terms ?? item.usage_terms ?? null;
      return { nicheId: null, platform: "lazada", merchant: item.seller_name ?? "Lazada", code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 500), terms: terms ? String(terms).slice(0, 1000) : null, imageUrl: imageUrl ? String(imageUrl) : null, discountValue: Math.abs(discountValue), discountType, minOrderValue: item.min_spend ?? null, maxDiscount: item.max_discount_amount ?? null, affiliateUrl: item.tracking_url ?? item.url ?? "https://lazada.vn", expiresAt: item.end_time ? new Date(item.end_time) : null };
    } catch { return null; }
  }

  private parseVoucher(item: any, niche: NicheConfig): RawVoucher | null {
    try {
      const code = item.code ?? item.voucher_code ?? item.coupon_code ?? null;
      const description = item.description ?? item.title ?? item.name ?? item.content ?? "";
      if (!description) return null;
      const discountValue = Number(item.discount_value ?? item.value ?? item.amount ?? 0);
      const discountType = item.discount_type === "fixed" || item.type === "fixed" ? "fixed" : "percent";
      const expiresAt = item.expire_date ?? item.end_date ?? item.expired_at ?? item.end_time ?? null;
      let affiliateUrl = item.link ?? item.url ?? item.landing_url ?? item.tracking_url ?? "";
      if (!affiliateUrl) affiliateUrl = `https://accesstrade.vn`;
      const imageUrl = item.image ?? item.banner ?? item.image_url ?? item.banner_url ?? item.thumbnail ?? null;
      const terms = item.terms ?? item.condition ?? item.usage_guide ?? item.requirement ?? item.terms_condition ?? null;
      return { nicheId: niche.id, platform: null, merchant: item.merchant ?? item.brand ?? item.shop_name ?? niche.name, code: code ? String(code).toUpperCase().trim() : null, description: String(description).slice(0, 500), terms: terms ? String(terms).slice(0, 1000) : null, imageUrl: imageUrl ? String(imageUrl) : null, discountValue: Math.abs(discountValue), discountType: discountType as "percent" | "fixed", minOrderValue: item.min_order ?? item.minimum_order ?? null, maxDiscount: item.max_discount ?? item.maximum_discount ?? null, affiliateUrl: String(affiliateUrl), expiresAt: expiresAt ? new Date(expiresAt) : null };
    } catch { return null; }
  }

  // ── Coupon scraper (generic — config-driven) ───────────────

  private async loadCouponScraperSources(): Promise<Array<{ slug: string; cfg: CouponScraperConfig }>> {
    const rows = await this.prisma.syncSource.findMany({ where: { enabled: true } });
    const result: Array<{ slug: string; cfg: CouponScraperConfig }> = [];
    for (const row of rows) {
      try {
        const cfg = JSON.parse(row.config as string) as Record<string, unknown>;
        if (cfg.type === "coupon-scraper") {
          result.push({ slug: row.slug, cfg: cfg as unknown as CouponScraperConfig });
        } else if (cfg.coupon) {
          // Scraper source với embedded coupon sub-config (e.g. concung)
          const sub = cfg.coupon as Record<string, unknown>;
          result.push({
            slug: row.slug,
            cfg: {
              type: "coupon-scraper",
              parser: sub.parser as string,
              promoUrl: sub.promoUrl as string,
              atMerchantSlug: (sub.atMerchantSlug ?? row.slug) as string,
              merchant: sub.merchant as string,
              merchantLogo: sub.merchantLogo as string | undefined,
              nicheId: sub.nicheId as string,
              platform: row.slug,
              voucherFetchUrl: sub.voucherFetchUrl as string | undefined,
            },
          });
        }
      } catch { /* malformed config — skip */ }
    }
    return result;
  }

  private async syncCouponScraperSource(slug: string, cfg: CouponScraperConfig): Promise<number> {
    const vouchers = await this.fetchPromoPageVouchers(slug, cfg);
    if (!vouchers.length) return 0;

    let count = 0;
    for (const v of vouchers) {
      await this.upsertCoupon(this.buildCouponId(cfg.nicheId, v), v, "accesstrade", cfg.merchantLogo ?? null);
      count++;
    }

    this.log.log(`[${slug}] ${count} coupon scraper vouchers synced`);
    await this.slog.info(`Đồng bộ coupon scraper "${slug}" hoàn tất`, SRC, { slug, count });
    return count;
  }

  private async fetchPromoPageVouchers(slug: string, cfg: CouponScraperConfig): Promise<RawVoucher[]> {
    // Fetch HTML từ voucherFetchUrl (nếu có) hoặc promoUrl
    const fetchUrl = cfg.voucherFetchUrl ?? cfg.promoUrl;
    let html: string;
    try {
      const res = await fetch(fetchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: any) {
      this.log.warn(`[${slug}] Failed to fetch promo page: ${e.message}`);
      return [];
    }

    const { campaigns: allCampaigns } = await this.atCampaignSvc.getCampaigns()
    const campaign = allCampaigns.find((c) => c.merchant === cfg.atMerchantSlug)
      ?? await this.prisma.atCampaign.findFirst({ where: { merchant: cfg.atMerchantSlug } });
    if (!campaign) {
      this.log.warn(`[${slug}] Không tìm thấy AT campaign với merchant="${cfg.atMerchantSlug}"`);
      this.log.warn(`[${slug}] Các campaign hiện có: ${allCampaigns.map((c) => c.merchant).join(", ") || "không có"}`);
      return [];
    }

    // Create one AT tracking link for the promo page
    let affiliateUrl = cfg.promoUrl;
    try {
      const link = await this.accesstrade.createTrackingLink({
        campaignId: campaign.id,
        urls: [cfg.promoUrl],
        utmSource: "affiliate",
        utmMedium: "coupon",
        utmCampaign: slug,
      });
      affiliateUrl = link.shortLink ?? link.affiliateLink ?? cfg.promoUrl;
    } catch (e: any) {
      this.log.warn(`[${slug}] Could not create AT tracking link: ${e.message} — using promo URL`);
    }

    return await this.parseByParser(slug, cfg, html, affiliateUrl);
  }

  private async parseByParser(slug: string, cfg: CouponScraperConfig, html: string, affiliateUrl: string): Promise<RawVoucher[]> {
    if (cfg.parser === "tch-promo") return this.parseTchPromoPage(slug, cfg, html, affiliateUrl);
    if (cfg.parser === "concung-voucher") return this.parseConcungVoucherPage(slug, cfg, html, affiliateUrl);
    if (cfg.parser === "dingtea-voucher") return this.parseDingTeaVoucherPage(slug, cfg, html, affiliateUrl);
    if (cfg.parser === "chickita-voucher") return this.parseChickitaVoucherPage(slug, cfg, html, affiliateUrl);
    this.log.warn(`[${slug}] Unknown coupon-scraper parser: "${cfg.parser}"`);
    return [];
  }

  private parseConcungVoucherPage(slug: string, cfg: CouponScraperConfig, html: string, affiliateUrl: string): RawVoucher[] {
    const vouchers: RawVoucher[] = [];

    // Extract var voucher_gets_{id}={...}; from inline <script> blocks
    const matches = html.matchAll(/var voucher_gets_(\d+)=(\{[^;]+?\});/gs);
    const seen = new Set<string>();

    for (const m of matches) {
      const voucherId = m[1];
      if (seen.has(voucherId)) continue;
      seen.add(voucherId);

      let data: Record<string, string>;
      try { data = JSON.parse(m[2]) as Record<string, string>; } catch { continue; }

      const discountRaw = Number(data.price_voucher);
      if (!discountRaw) continue;

      // voucher_type_id: "2" = percent, "1" = fixed VND
      const isPercent = data.voucher_type_id === "2";
      const discountType: "percent" | "fixed" = isPercent ? "percent" : "fixed";

      const description = isPercent
        ? `Giảm ${discountRaw}% tại ${cfg.merchant}`
        : `Giảm ${this.formatVND(discountRaw)} tại ${cfg.merchant}`;

      const manuDesc = String(data.manu_desc ?? "");

      // Parse "đơn từ X.000đ" → minOrderValue
      const minMatch = manuDesc.match(/đơn từ\s*([\d.]+)đ/)
      const minOrderValue = minMatch ? this.parseVndStr(minMatch[1]) : null;

      // Parse "tối đa X.000đ" → maxDiscount
      const maxMatch = manuDesc.match(/tối đa\s*([\d.]+)đ/)
      const maxDiscount = maxMatch ? this.parseVndStr(maxMatch[1]) : null;

      // terms: điều kiện sản phẩm + điều kiện đơn hàng
      const giftName = String(data.gift_name ?? data.manufacturer_name ?? "").trim();
      const terms = [giftName, manuDesc].filter(Boolean).join(" — ") || null;

      // expiresAt from Unix timestamp
      const dateEnd = Number(data.date_end);
      const expiresAt = dateEnd ? new Date(dateEnd * 1_000) : null;

      const imageUrl = data.logo_image ? String(data.logo_image) : (cfg.merchantLogo ?? null);

      vouchers.push({
        externalId: `concung-${voucherId}`,
        nicheId: cfg.nicheId,
        platform: cfg.platform,
        merchant: cfg.merchant,
        code: null,
        description,
        terms,
        imageUrl,
        discountValue: discountRaw,
        discountType,
        minOrderValue,
        maxDiscount,
        affiliateUrl,
        expiresAt,
      });
    }

    this.log.log(`[${slug}] parseConcungVoucherPage: ${vouchers.length} vouchers`);
    return vouchers;
  }

  // ── Ding Tea promo parser ─────────────────────────────────────────────────────
  // Trang http://promo.dingtea.vn/ — Vietnamese F&B promo page thường có một trong:
  //   - data-code="XYZABC" trên mỗi voucher card
  //   - JSON nhúng trong <script type="application/json"> hoặc window.__PROMO_DATA__
  //   - Các pattern discount: "GIẢM Xk", "GIẢM X%", mã in text
  // Nếu trả về 0 voucher, check log để thấy HTML length và điều chỉnh parser.
  private parseDingTeaVoucherPage(slug: string, cfg: CouponScraperConfig, html: string, affiliateUrl: string): RawVoucher[] {
    this.log.log(`[${slug}] parseDingTeaVoucherPage: HTML length=${html.length}`);
    const vouchers: RawVoucher[] = [];

    // Pattern 1: data-code="CODE" với discount info trong cùng container
    const codeAttrRe = /data-code="([A-Z0-9_-]{3,20})"/gi;
    const seenCodes = new Set<string>();
    let m: RegExpExecArray | null;

    while ((m = codeAttrRe.exec(html)) !== null) {
      const code = m[1].toUpperCase();
      if (seenCodes.has(code)) continue;
      seenCodes.add(code);

      // Tìm discount trong 300 ký tự xung quanh
      const ctx = html.slice(Math.max(0, m.index - 150), m.index + 300);
      const pctMatch = ctx.match(/gi[aả]m\s*(\d{1,3})\s*%/i);
      const kMatch   = ctx.match(/gi[aả]m\s*([\d.,]+)\s*[kK]/i);
      const expMatch = ctx.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

      let discountValue = 0;
      let discountType: "percent" | "fixed" = "percent";
      let description: string;

      if (pctMatch) {
        discountValue = Number(pctMatch[1]);
        discountType = "percent";
        description = `Giảm ${discountValue}% tại ${cfg.merchant}`;
      } else if (kMatch) {
        const raw = kMatch[1].replace(/[.,]/g, "");
        discountValue = Number(raw) * 1_000;
        discountType = "fixed";
        description = `Giảm ${kMatch[1]}K tại ${cfg.merchant}`;
      } else {
        description = `Ưu đãi ${cfg.merchant} — mã ${code}`;
      }

      let expiresAt: Date | null = null;
      if (expMatch) {
        expiresAt = new Date(Number(expMatch[3]), Number(expMatch[2]) - 1, Number(expMatch[1]), 23, 59, 59);
      }

      vouchers.push({
        externalId: `dingtea-${code}`,
        nicheId: cfg.nicheId,
        platform: cfg.platform,
        merchant: cfg.merchant,
        code,
        description,
        terms: null,
        imageUrl: cfg.merchantLogo ?? null,
        discountValue,
        discountType,
        minOrderValue: null,
        maxDiscount: null,
        affiliateUrl,
        expiresAt,
      });
    }

    if (vouchers.length > 0) {
      this.log.log(`[${slug}] parseDingTeaVoucherPage: ${vouchers.length} vouchers (data-code pattern)`);
      return vouchers;
    }

    // Pattern 2: JSON embedded — window.__DATA__ hoặc application/json
    const jsonBlockRe = /<script[^>]*(?:application\/json|__(?:PROMO|DATA|VOUCHER))[^>]*>([\s\S]*?)<\/script>/gi;
    while ((m = jsonBlockRe.exec(html)) !== null) {
      try {
        const data = JSON.parse(m[1]);
        const items: any[] = Array.isArray(data) ? data : (data.vouchers ?? data.coupons ?? data.data ?? []);
        for (const item of items) {
          const code = String(item.code ?? item.voucher_code ?? item.coupon_code ?? "").toUpperCase();
          if (!code || seenCodes.has(code)) continue;
          seenCodes.add(code);

          const pct = Number(item.discount_percent ?? item.percent ?? 0);
          const fixed = Number(item.discount_amount ?? item.amount ?? 0);
          const discountValue = pct || fixed;
          const discountType: "percent" | "fixed" = pct ? "percent" : "fixed";
          const description = pct
            ? `Giảm ${pct}% tại ${cfg.merchant}`
            : `Giảm ${this.formatVND(fixed)} tại ${cfg.merchant}`;

          const expRaw = item.end_date ?? item.expire_date ?? item.expiry ?? null;
          const expiresAt = expRaw ? new Date(expRaw) : null;

          vouchers.push({
            externalId: `dingtea-${code}`,
            nicheId: cfg.nicheId, platform: cfg.platform, merchant: cfg.merchant,
            code, description, terms: null, imageUrl: cfg.merchantLogo ?? null,
            discountValue, discountType,
            minOrderValue: null, maxDiscount: null,
            affiliateUrl, expiresAt,
          });
        }
      } catch { /* malformed JSON — skip */ }
    }

    this.log.log(`[${slug}] parseDingTeaVoucherPage: ${vouchers.length} vouchers (JSON pattern)`);
    return vouchers;
  }

  // ── Chickita voucher parser ───────────────────────────────────────────────────
  // Chickita dùng WordPress (chickita.com.vn).
  // voucher.chickita.com.vn redirect về trang chủ khi không có AT cookie.
  // Parser đọc WP API /wp-json/wp/v2/posts?_fields=... để lấy các post khuyến mãi,
  // sau đó extract voucher code và discount từ content.
  private async parseChickitaVoucherPage(slug: string, cfg: CouponScraperConfig, html: string, affiliateUrl: string): Promise<RawVoucher[]> {
    this.log.log(`[${slug}] parseChickitaVoucherPage: HTML length=${html.length}`);

    // Fetch promotion posts từ WP API
    let promos: any[] = [];
    try {
      const res = await fetch(
        "https://chickita.com.vn/wp-json/wp/v2/posts?per_page=20&status=publish&_fields=slug,title,content,excerpt,date,modified",
        { signal: AbortSignal.timeout(10_000) },
      );
      if (res.ok) promos = await res.json() as any[];
    } catch (e: any) {
      this.log.warn(`[${slug}] WP API fetch failed: ${e.message}`);
    }

    const vouchers: RawVoucher[] = [];
    const seen = new Set<string>();

    for (const post of promos) {
      const content: string = (post.content?.rendered ?? "") + " " + (post.excerpt?.rendered ?? "");
      const title: string = post.title?.rendered ?? "";
      const combined = `${title} ${content}`;

      // Tìm voucher code: CHỮ HOA + số, 5-12 ký tự
      const codeMatches = combined.matchAll(/\b([A-Z]{2,}[0-9A-Z]{2,})\b/g);
      const postCodes: string[] = [];
      for (const cm of codeMatches) {
        const c = cm[1];
        if (c.length >= 5 && c.length <= 12 && !seen.has(c)) {
          // Lọc bỏ các từ viết hoa thông thường không phải code
          if (!/^(CHICKITA|OISHII|FLAME|JOURNEY|GRILLED|TRANG|THUC|MENU)$/.test(c)) {
            postCodes.push(c);
          }
        }
      }

      // Tìm discount
      const pctMatch = combined.match(/gi[aả]m\s*(\d{1,3})\s*%/i);
      const kMatch   = combined.match(/ch[ỉi]\s*([\d.,]+)\s*[kK]/i)
                    ?? combined.match(/gi[aả]m\s*([\d.,]+)[kK]/i);
      const priceMatch = combined.match(/(\d+)\s*\.?\s*000\s*[đd]/i);

      let discountValue = 0;
      let discountType: "percent" | "fixed" = "percent";
      let description = `Ưu đãi ${cfg.merchant}`;

      if (pctMatch) {
        discountValue = Number(pctMatch[1]);
        discountType = "percent";
        description = `Giảm ${discountValue}% tại ${cfg.merchant}`;
      } else if (kMatch) {
        const raw = kMatch[1].replace(/[.,]/g, "");
        discountValue = Number(raw) * 1_000;
        discountType = "fixed";
        description = `Giảm ${kMatch[1]}K tại ${cfg.merchant}`;
      } else if (priceMatch) {
        discountValue = Number(priceMatch[1]) * 1_000;
        discountType = "fixed";
        description = `Đồng giá ${priceMatch[1]}.000đ tại ${cfg.merchant}`;
      }

      if (discountValue === 0 && postCodes.length === 0) continue;

      const expMatch = combined.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      const expiresAt = expMatch
        ? new Date(Number(expMatch[3]), Number(expMatch[2]) - 1, Number(expMatch[1]), 23, 59, 59)
        : null;

      if (postCodes.length > 0) {
        // Mỗi code → 1 voucher
        for (const code of postCodes.slice(0, 3)) {
          seen.add(code);
          vouchers.push({
            externalId: `chickita-${code}`,
            nicheId: cfg.nicheId, platform: cfg.platform, merchant: cfg.merchant,
            code, description: discountValue ? description : `Ưu đãi ${cfg.merchant} — mã ${code}`,
            terms: title || null,
            imageUrl: cfg.merchantLogo ?? null,
            discountValue, discountType,
            minOrderValue: null, maxDiscount: null,
            affiliateUrl, expiresAt,
          });
        }
      } else if (discountValue > 0) {
        // Không có code — voucher không cần mã
        const extId = `chickita-post-${post.slug ?? String(Date.now())}`;
        if (!seen.has(extId)) {
          seen.add(extId);
          vouchers.push({
            externalId: extId,
            nicheId: cfg.nicheId, platform: cfg.platform, merchant: cfg.merchant,
            code: null, description, terms: title || null,
            imageUrl: cfg.merchantLogo ?? null,
            discountValue, discountType,
            minOrderValue: null, maxDiscount: null,
            affiliateUrl, expiresAt,
          });
        }
      }
    }

    this.log.log(`[${slug}] parseChickitaVoucherPage: ${vouchers.length} vouchers from ${promos.length} WP posts`);
    return vouchers;
  }

  private formatVND(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return `${n}đ`
  }

  private parseVndStr(s: string): number {
    return parseInt(s.replace(/\./g, ""), 10) || 0
  }

  private async parseTchPromoPage(slug: string, cfg: CouponScraperConfig, html: string, affiliateUrl: string): Promise<RawVoucher[]> {
    let baseOrigin = cfg.promoUrl;
    try { baseOrigin = new URL(cfg.promoUrl).origin; } catch { /* keep promoUrl */ }

    // Parse tất cả blocks từ HTML (sync)
    const blocks = this.extractTchPromoBlocks(html, baseOrigin, cfg, affiliateUrl);
    if (!blocks.length) {
      this.log.warn(`[${slug}] No voucher items found on promo page`);
      return [];
    }

    // Enrich song song: gọi /v1/coupon/claim cho mỗi block → lấy expiresAt + imageUrl từ claim page
    const enriched = await Promise.allSettled(
      blocks.map(({ dataId, cate, voucher }) =>
        this.fetchTchClaimData(baseOrigin, dataId, cate).then((claim) => ({
          ...voucher,
          expiresAt: claim.expiresAt ?? voucher.expiresAt,
          imageUrl:  claim.imageUrl  ?? voucher.imageUrl,
        }))
      )
    );

    return enriched
      .filter((r): r is PromiseFulfilledResult<RawVoucher> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  private extractTchPromoBlocks(
    html: string,
    baseOrigin: string,
    cfg: CouponScraperConfig,
    affiliateUrl: string,
  ): { dataId: string; cate: string; voucher: RawVoucher }[] {
    const blockRe = /data-id="([^"]+)"[^>]*data-cate="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g;
    const seen = new Set<string>();
    const blocks: { dataId: string; cate: string; voucher: RawVoucher }[] = [];
    let m: RegExpExecArray | null;

    while ((m = blockRe.exec(html)) !== null) {
      const dataId = m[1];
      if (seen.has(dataId)) continue; // bỏ qua clone của owl carousel
      seen.add(dataId);

      const cate  = m[2];
      const inner = m[3];
      const upper = cate.toUpperCase();

      // Ảnh banner từ promo page (dùng làm fallback nếu claim page không có)
      const imgMatch = inner.match(/\bsrc="([^"]+)"/);
      const rawSrc = imgMatch ? imgMatch[1] : null;
      const promoImageUrl = rawSrc
        ? (rawSrc.startsWith("http") ? rawSrc : `${baseOrigin}${rawSrc.startsWith("/") ? "" : "/"}${rawSrc}`)
        : null;

      const base: Omit<RawVoucher, "description" | "discountValue" | "discountType"> = {
        nicheId: cfg.nicheId, platform: cfg.platform, merchant: cfg.merchant,
        code: null,       // claim-based: mỗi user nhận mã riêng khi bấm link
        terms: null,
        imageUrl: promoImageUrl,
        minOrderValue: null, maxDiscount: null,
        affiliateUrl,
        expiresAt: null,  // sẽ được enrich từ claim page
      };

      let voucher: RawVoucher;

      const buyTangMatch = upper.match(/MUA(\d+)TANG(\d+)/);
      if (buyTangMatch) {
        const buy = Number(buyTangMatch[1]);
        const get = Number(buyTangMatch[2]);
        const pct = Math.round((get / (buy + get)) * 100);
        voucher = { ...base, description: `Mua ${buy} tặng ${get} tại ${cfg.merchant}`, discountValue: pct, discountType: "percent" };
      } else {
        const pctMatch = upper.match(/GIAM(\d+)%?/);
        if (pctMatch) {
          voucher = { ...base, description: `Giảm ${pctMatch[1]}% tại ${cfg.merchant}`, discountValue: Number(pctMatch[1]), discountType: "percent" };
        } else {
          const fixedMatch = upper.match(/DONGGIA(\d+)K/);
          if (fixedMatch) {
            const val = Number(fixedMatch[1]) * 1000;
            voucher = { ...base, description: `Đồng giá ${Number(fixedMatch[1]).toLocaleString("vi-VN")}.000đ tại ${cfg.merchant}`, discountValue: val, discountType: "fixed" };
          } else {
            voucher = { ...base, description: `Ưu đãi ${cfg.merchant}: ${cate}`, discountValue: 0, discountType: "percent" };
          }
        }
      }

      blocks.push({ dataId, cate, voucher });
    }

    return blocks;
  }

  private async fetchTchClaimData(
    baseOrigin: string,
    dataId: string,
    cate: string,
  ): Promise<{ expiresAt: Date | null; imageUrl: string | null }> {
    const empty = { expiresAt: null, imageUrl: null };
    try {
      // Bước 1: gọi /v1/coupon/claim → nhận redirect path (/claim?uid=...)
      const claimRes = await fetch(
        `${baseOrigin}/v1/coupon/claim?product_code=${encodeURIComponent(dataId)}&cate_id=${encodeURIComponent(cate)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!claimRes.ok) return empty;
      const claimPath = (await claimRes.text()).trim(); // e.g. "/claim?uid=7075..."
      if (!claimPath.startsWith("/claim")) return empty;

      // Bước 2: fetch trang claim → extract expire date + ảnh voucher
      const pageRes = await fetch(`${baseOrigin}${claimPath}`, { signal: AbortSignal.timeout(10_000) });
      if (!pageRes.ok) return empty;
      const pageHtml = await pageRes.text();

      // <strong class="voucher-info expire-text">30-09-2026</strong>
      const expireMatch = pageHtml.match(/expire-text[^>]*>([^<]+)<\/strong>/);
      const expireStr = expireMatch?.[1]?.trim(); // "30-09-2026"
      let expiresAt: Date | null = null;
      if (expireStr) {
        const parts = expireStr.split("-").map(Number); // [30, 9, 2026]
        if (parts.length === 3 && !parts.some(isNaN)) {
          expiresAt = new Date(parts[2], parts[1] - 1, parts[0], 23, 59, 59);
        }
      }

      // <img ... class="voucher-image" src="/static/images/claim/xxx.jpg">
      const imgMatch = pageHtml.match(/voucher-image[^>]+src="([^"]+)"/);
      const rawImg = imgMatch?.[1];
      const imageUrl = rawImg
        ? (rawImg.startsWith("http") ? rawImg : `${baseOrigin}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`)
        : null;

      return { expiresAt, imageUrl };
    } catch {
      return empty;
    }
  }

  // ── Single upsert method — dùng cho tất cả nguồn coupon ─────────────────────
  // Fix: affiliateUrl luôn được update (trước đây thiếu ở AT/Shopee/Tiki/Lazada).
  // merchantLogo chỉ set khi caller truyền (coupon-scraper source).

  private async upsertCoupon(
    couponId: string,
    v: RawVoucher,
    source: string,
    merchantLogo: string | null = null,
  ): Promise<void> {
    await this.prisma.coupon.upsert({
      where: { id: couponId },
      update: {
        description: v.description,
        terms: v.terms,
        imageUrl: v.imageUrl,
        discountValue: v.discountValue,
        discountType: v.discountType,
        minOrderValue: v.minOrderValue,
        maxDiscount: v.maxDiscount,
        affiliateUrl: v.affiliateUrl,
        expiresAt: v.expiresAt,
        isActive: true,
        ...(merchantLogo && { merchantLogo }),
        ...(v.externalId && { externalId: v.externalId }),
      },
      create: {
        id: couponId,
        source,
        platform: v.platform,
        nicheId: v.nicheId,
        merchant: v.merchant,
        code: v.code,
        description: v.description,
        terms: v.terms,
        imageUrl: v.imageUrl,
        discountValue: v.discountValue,
        discountType: v.discountType,
        minOrderValue: v.minOrderValue,
        maxDiscount: v.maxDiscount,
        affiliateUrl: v.affiliateUrl,
        expiresAt: v.expiresAt,
        isActive: true,
        ...(merchantLogo && { merchantLogo }),
        ...(v.externalId && { externalId: v.externalId }),
      },
    });
  }

  private buildCouponId(nicheId: string, v: RawVoucher): string {
    if (v.externalId) return v.externalId.slice(0, 64);
    return [nicheId, v.merchant, v.code ?? v.description.slice(0, 20)]
      .join("-").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 64);
  }

  async loadActiveNiches(): Promise<NicheConfig[]> {
    const rows = await this.prisma.category.findMany({
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
