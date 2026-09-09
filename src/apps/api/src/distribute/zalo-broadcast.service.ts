import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { ContentGeneratorService } from "./content-generator.service";

// Zalo OA API docs: https://developers.zalo.me/docs/api/official-account-api
const ZALO_OA_API = "https://openapi.zalo.me/v2.0/oa";

@Injectable()
export class ZaloBroadcastService {
  private readonly log = new Logger(ZaloBroadcastService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly cfg: ConfigService,
    private readonly contentGen: ContentGeneratorService,
  ) {}

  // Chạy 9h sáng mỗi ngày
  @Cron("0 9 * * *")
  async broadcastDailyDeals() {
    const oaToken = this.cfg.get<string>("ZALO_OA_ACCESS_TOKEN");
    if (!oaToken) {
      this.log.warn("ZALO_OA_ACCESS_TOKEN not set — skipping broadcast");
      return;
    }

    // Lấy top deals hôm nay từ tất cả ngách active
    const deals = await this.prisma.deal.findMany({
      where: {
        isActive: true,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { product: true },
      orderBy: { discountPct: "desc" },
      take: 10,
    });

    if (!deals.length) {
      this.log.log("No deals to broadcast today");
      return;
    }

    const contents = this.contentGen.generateDailyBroadcast(deals as any, 5);

    for (const content of contents) {
      await this.sendZaloMessage(oaToken, content).catch((e) =>
        this.log.error(`Zalo send failed: ${e.message}`)
      );
      // Delay giữa các tin để tránh spam
      await new Promise((r) => setTimeout(r, 2000));
    }

    this.log.log(`Broadcasted ${contents.length} deals to Zalo OA`);
  }

  private async sendZaloMessage(
    accessToken: string,
    content: { text: string; imageUrl: string; affiliateUrl: string }
  ) {
    const payload = {
      recipient: { message_tag: "CONFIRMED_EVENT_UPDATE" },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "media",
            elements: [
              {
                media_type: "image",
                url: content.imageUrl,
              },
            ],
          },
        },
        text: content.text,
      },
    };

    const res = await fetch(`${ZALO_OA_API}/message/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: accessToken,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Zalo API ${res.status}: ${body}`);
    }

    return res.json();
  }
}
