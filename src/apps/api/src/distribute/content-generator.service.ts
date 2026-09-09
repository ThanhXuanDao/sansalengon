import { Injectable } from "@nestjs/common";
import { parse as parseYaml } from "yaml";
import { readFileSync } from "fs";
import { join } from "path";

interface DealWithProduct {
  id: string;
  discountPct: number;
  salePrice: number;
  originalPrice: number;
  product: {
    name: string;
    affiliateUrl: string;
    imageUrl: string;
    rating?: number | null;
  };
  nicheId: string;
}

interface GeneratedContent {
  text: string;
  imageUrl: string;
  affiliateUrl: string;
}

@Injectable()
export class ContentGeneratorService {
  generatePostContent(deal: DealWithProduct): GeneratedContent {
    const nicheConfig = this.loadNicheConfig(deal.nicheId);
    const prefix = nicheConfig?.content?.post_prefix ?? "🔥 Deal hôm nay";
    const hashtags = nicheConfig?.content?.hashtags ?? "#deal #shopee";

    const salePriceFormatted = this.formatPrice(deal.salePrice);
    const origPriceFormatted = this.formatPrice(deal.originalPrice);
    const rating = deal.product.rating ? `⭐ ${deal.product.rating}/5` : "";

    const text = [
      `${prefix}`,
      ``,
      `📦 ${deal.product.name}`,
      `💰 Giá sale: ${salePriceFormatted} (giảm ${deal.discountPct}%)`,
      `🏷️ Giá gốc: ${origPriceFormatted}`,
      rating,
      ``,
      `👉 Mua ngay: ${deal.product.affiliateUrl}`,
      ``,
      hashtags,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      text,
      imageUrl: deal.product.imageUrl,
      affiliateUrl: deal.product.affiliateUrl,
    };
  }

  // Tạo top N deals cho Zalo OA broadcast
  generateDailyBroadcast(deals: DealWithProduct[], limit = 5): GeneratedContent[] {
    return deals
      .sort((a, b) => b.discountPct - a.discountPct)
      .slice(0, limit)
      .map((deal) => this.generatePostContent(deal));
  }

  private formatPrice(price: number): string {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  }

  private loadNicheConfig(nicheId: string): any {
    try {
      const configPath = join(process.cwd(), "../../config/niches.yaml");
      const raw = readFileSync(configPath, "utf-8");
      const { niches } = parseYaml(raw) as { niches: any[] };
      return niches.find((n) => n.id === nicheId);
    } catch {
      return null;
    }
  }
}
