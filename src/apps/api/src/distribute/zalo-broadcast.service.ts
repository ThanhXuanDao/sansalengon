import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { ContentGeneratorService, type ProductForBroadcast } from "./content-generator.service";
import { ZaloTokenService } from "./zalo-token.service";
import { parse as parseYaml } from "yaml";
import { readFileSync } from "fs";
import { join } from "path";

// Zalo OA API v2.0 — https://developers.zalo.me/docs/api/official-account-api
const ZALO_OA_API = "https://openapi.zalo.me/v2.0/oa";

interface NicheConfig {
  id: string;
  name: string;
  status: string;
  channels?: { zalo_oa_id?: string | null };
}

@Injectable()
export class ZaloBroadcastService {
  private readonly log = new Logger(ZaloBroadcastService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly tokenSvc: ZaloTokenService,
    private readonly contentGen: ContentGeneratorService,
  ) {}

  // Chạy 9h sáng mỗi ngày
  @Cron("0 9 * * *")
  async broadcastDailyDeals() {
    const accessToken = await this.tokenSvc.getValidToken();
    if (!accessToken) {
      this.log.warn("No valid Zalo token — skipping broadcast");
      return;
    }

    this.log.log("Starting daily Zalo OA broadcast");

    const niches = this.loadActiveNiches();

    for (const niche of niches) {
      await this.broadcastForNiche(accessToken, niche);
      // Tránh rate limit — đợi 3 giây giữa các ngách
      await delay(3000);
    }
  }

  // Trigger thủ công qua API nội bộ (test / emergency resend)
  async broadcastNow(nicheId?: string): Promise<{ sent: number; errors: string[] }> {
    const accessToken = await this.tokenSvc.getValidToken();
    if (!accessToken) throw new Error("No valid Zalo token — check token configuration");

    const niches = this.loadActiveNiches().filter((n) =>
      nicheId ? n.id === nicheId : true
    );

    let sent = 0;
    const errors: string[] = [];

    for (const niche of niches) {
      const ok = await this.broadcastForNiche(accessToken, niche);
      if (ok) sent++;
      else errors.push(niche.id);
    }

    return { sent, errors };
  }

  private async broadcastForNiche(accessToken: string, niche: NicheConfig): Promise<boolean> {
    try {
      const products = await this.fetchTopProducts(niche.id);

      if (products.length === 0) {
        this.log.log(`Niche ${niche.id}: no products — skipping`);
        return true;
      }

      const content = await this.contentGen.generateDigestBroadcast(products, niche.name);

      await this.sendTextBroadcast(accessToken, content.text);

      await this.prisma.broadcastLog.create({
        data: {
          channel: "zalo",
          nicheId: niche.id,
          productIds: JSON.stringify(products.map((p) => p.id)),
          messageText: content.text,
          status: "sent",
        },
      });

      this.log.log(`Niche ${niche.id}: broadcast sent (${products.length} products)`);
      return true;
    } catch (err: any) {
      this.log.error(`Niche ${niche.id} broadcast failed: ${err.message}`);
      await this.prisma.broadcastLog.create({
        data: {
          channel: "zalo",
          nicheId: niche.id,
          productIds: "[]",
          messageText: "",
          status: "failed",
          error: err.message?.slice(0, 500),
        },
      }).catch(() => {});
      return false;
    }
  }

  private async fetchTopProducts(nicheId: string): Promise<ProductForBroadcast[]> {
    // Ưu tiên: sản phẩm có discount cao + click nhiều trong 7 ngày
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const clickCounts = await this.prisma.clickLog.groupBy({
      by: ["productId"],
      where: { clickedAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    const clickMap = new Map(clickCounts.map((c) => [c.productId, c._count.id]));

    const products = await this.prisma.product.findMany({
      where: {
        isSoldOut: false,
        discountPct: { gte: 20 },
        category: { slug: nicheId },
      },
      include: { category: true },
      orderBy: { discountPct: "desc" },
      take: 20,
    });

    // Score = discount×0.45 + click×0.30 + rating×0.25 (chuẩn hóa, max 100 pts)
    const maxClicks = Math.max(1, ...Array.from(clickMap.values()));
    const scored = products.map((p) => ({
      ...p,
      _score:
        (p.discountPct ?? 0) * 0.45 +
        ((clickMap.get(p.id) ?? 0) / maxClicks) * 100 * 0.30 +
        (p.rating / 5) * 100 * 0.25,
    }));
    scored.sort((a, b) => b._score - a._score);

    return scored.slice(0, 5).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      discountPct: p.discountPct,
      imageUrl: p.imageUrl,
      shopeeUrl: p.shopeeUrl,
      rating: p.rating,
      category: { name: p.category.name, slug: p.category.slug },
    }));
  }

  // Gửi text broadcast đến tất cả follower Zalo OA
  // Docs: https://developers.zalo.me/docs/api/official-account-api/tin-nhan/gui-tin-nhan-quang-ba-post-5988
  private async sendTextBroadcast(accessToken: string, text: string): Promise<void> {
    const payload = {
      recipient: {
        // Gửi đến tất cả follower đang active
        message_tag: "ACCOUNT_UPDATE",
      },
      message: { text },
    };

    const res = await fetch(`${ZALO_OA_API}/message/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: accessToken,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await res.json() as { error?: number; message?: string };

    // Zalo trả error: 0 = thành công
    if (body.error !== 0) {
      throw new Error(`Zalo API error ${body.error}: ${body.message}`);
    }
  }

  private loadActiveNiches(): NicheConfig[] {
    try {
      const configPath = join(process.cwd(), "../../config/niches.yaml");
      const raw = readFileSync(configPath, "utf-8");
      const { niches } = parseYaml(raw) as { niches: NicheConfig[] };
      return niches.filter((n) => n.status === "active");
    } catch (err: any) {
      this.log.error(`Failed to load niches.yaml: ${err.message}`);
      return [];
    }
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
