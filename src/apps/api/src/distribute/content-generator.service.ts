import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { AppLogService } from "../shared/app-log.service";

const SRC = "content-generator";

export interface ProductForBroadcast {
  id: string;
  name: string;
  price: number;
  discountPct: number | null;
  imageUrl: string;
  shopeeUrl: string;
  rating: number;
  category: { name: string; slug: string };
}

export interface BroadcastContent {
  text: string;
  imageUrl: string;
  redirectUrl: string;   // /api/affiliate/redirect/[id]?src=zalo
}

@Injectable()
export class ContentGeneratorService {
  private readonly log = new Logger(ContentGeneratorService.name);
  private readonly prisma = new PrismaClient();
  private readonly siteUrl: string;
  private claude: Anthropic | null = null;

  constructor(
    private readonly appLog: AppLogService,
  ) {
    this.siteUrl = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) this.claude = new Anthropic({ apiKey });
    else {
      this.log.warn("ANTHROPIC_API_KEY not set — using template fallback for content generation");
      void this.appLog.warn("ANTHROPIC_API_KEY chưa cấu hình — dùng template fallback", undefined, SRC, "api-distribute", "system");
    }
  }

  // Tạo 1 tin digest gộp top N deals — 1 tin duy nhất, tránh spam
  async generateDigestBroadcast(products: ProductForBroadcast[], nicheLabel?: string): Promise<BroadcastContent> {
    const top = products.slice(0, 5);
    const text = this.claude
      ? await this.generateDigestWithAI(top, nicheLabel)
      : this.generateDigestTemplate(top, nicheLabel);

    return {
      text,
      imageUrl: top[0]?.imageUrl ?? "",
      redirectUrl: `${this.siteUrl}/api/affiliate/redirect/${top[0]?.id}?src=zalo`,
    };
  }

  // Tạo nội dung cho 1 sản phẩm đơn lẻ (dùng cho Facebook post generator)
  async generateSinglePost(p: ProductForBroadcast, nicheId: string): Promise<string> {
    if (this.claude) {
      const result = await this.generateSingleWithAI(p, nicheId);
      if (result) return result;
    }
    return await this.generateSingleTemplate(p, nicheId);
  }

  private async generateDigestWithAI(top: ProductForBroadcast[], nicheLabel?: string): Promise<string> {
    const header = nicheLabel
      ? `TOP DEAL ${nicheLabel.toUpperCase()} HÔM NAY`
      : `TOP DEAL HÔM NAY`;

    const productList = top.map((p, i) => {
      const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price;
      const redirect = `${this.siteUrl}/api/affiliate/redirect/${p.id}?src=zalo`;
      return `${i + 1}. ${p.name.slice(0, 80)} — ${p.discountPct ? `giảm ${p.discountPct}%, còn ${this.fmtPrice(salePrice)}` : this.fmtPrice(salePrice)}\n   Link: ${redirect}`;
    }).join("\n\n");

    const prompt = `Bạn là copywriter affiliate Việt Nam. Viết 1 tin nhắn Zalo digest giới thiệu top deals sau. Yêu cầu:
- Tự nhiên, thân thiện, không spam-y
- Giữ nguyên tất cả các link sản phẩm, không thay đổi
- Có emoji, dưới 500 từ
- Kết thúc bằng: "Xem thêm: ${this.siteUrl}"

Header: 🔥 ${header}

Sản phẩm:
${productList}`;

    try {
      const msg = await this.claude!.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      });
      return (msg.content[0] as { type: string; text: string }).text.trim();
    } catch (e: any) {
      this.log.warn(`Claude digest generation failed: ${e.message}`);
      await this.appLog.warn("Claude tạo nội dung digest thất bại — dùng template", {
        niche: nicheLabel,
        error: e.message,
      }, SRC, "api-distribute", "system");
      return this.generateDigestTemplate(top, nicheLabel);
    }
  }

  private async generateSingleWithAI(p: ProductForBroadcast, nicheId: string): Promise<string | null> {
    const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price;
    const redirectUrl = `${this.siteUrl}/api/affiliate/redirect/${p.id}?src=facebook`;
    const discountLine = p.discountPct
      ? `Giảm ${p.discountPct}% — gốc ${this.fmtPrice(p.price)}, sale chỉ còn ${this.fmtPrice(salePrice)}`
      : `Giá: ${this.fmtPrice(p.price)}`;

    const prompt = `Bạn là copywriter affiliate Việt Nam. Viết 1 post Facebook ngắn gọn cho sản phẩm sau. Tự nhiên, có emoji, dưới 150 từ. Kết thúc bằng link: ${redirectUrl}

Sản phẩm: ${p.name}
${discountLine}
${p.rating > 0 ? `Đánh giá: ${p.rating.toFixed(1)}/5` : ""}
Ngách: ${nicheId}`;

    try {
      const msg = await this.claude!.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      return (msg.content[0] as { type: string; text: string }).text.trim();
    } catch (e: any) {
      this.log.warn(`Claude single post generation failed: ${e.message}`);
      await this.appLog.warn("Claude tạo single post thất bại — dùng template", {
        product: p.name,
        niche: nicheId,
        error: e.message,
      }, SRC, "api-distribute", "system");
      return null;
    }
  }

  private generateDigestTemplate(top: ProductForBroadcast[], nicheLabel?: string): string {
    const header = nicheLabel
      ? `🔥 TOP DEAL ${nicheLabel.toUpperCase()} HÔM NAY`
      : `🔥 TOP DEAL HÔM NAY`;

    const lines: string[] = [header, ""];
    const EMOJI_NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

    top.forEach((p, i) => {
      const salePrice = p.discountPct
        ? Math.round(p.price * (1 - p.discountPct / 100))
        : p.price;
      const redirectUrl = `${this.siteUrl}/api/affiliate/redirect/${p.id}?src=zalo`;
      const rating = p.rating > 0 ? ` ⭐${p.rating.toFixed(1)}` : "";

      lines.push(`${EMOJI_NUM[i]} ${p.name.slice(0, 60)}${p.name.length > 60 ? "..." : ""}${rating}`);
      if (p.discountPct && p.discountPct > 0) {
        lines.push(`💰 ${this.fmtPrice(salePrice)} (giảm ${p.discountPct}% — gốc ${this.fmtPrice(p.price)})`);
      } else {
        lines.push(`💰 ${this.fmtPrice(p.price)}`);
      }
      lines.push(`👉 ${redirectUrl}`);
      lines.push("");
    });

    lines.push("─────────────────");
    lines.push(`📌 Xem thêm deal: ${this.siteUrl}`);
    lines.push(`🏷️ Mã giảm giá: ${this.siteUrl}/ma-giam-gia`);

    return lines.join("\n");
  }

  private async generateSingleTemplate(p: ProductForBroadcast, nicheId: string): Promise<string> {
    const nicheRow = await this.prisma.niche.findUnique({ where: { id: nicheId } }).catch(() => null);
    const prefix = nicheRow?.postPrefix ?? "🔥 Deal hôm nay";
    const hashtags = nicheRow?.hashtags ?? "#deal #shopee";
    const salePrice = p.discountPct
      ? Math.round(p.price * (1 - p.discountPct / 100))
      : p.price;
    const redirectUrl = `${this.siteUrl}/api/affiliate/redirect/${p.id}?src=facebook`;

    return [
      prefix,
      "",
      `📦 ${p.name}`,
      p.discountPct ? `💰 Giá sale: ${this.fmtPrice(salePrice)} (giảm ${p.discountPct}%)` : `💰 Giá: ${this.fmtPrice(p.price)}`,
      p.rating > 0 ? `⭐ ${p.rating.toFixed(1)}/5` : "",
      "",
      `👉 Mua ngay: ${redirectUrl}`,
      "",
      hashtags,
    ]
      .filter((l) => l !== "")
      .join("\n");
  }

  private fmtPrice(price: number): string {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
  }

}
