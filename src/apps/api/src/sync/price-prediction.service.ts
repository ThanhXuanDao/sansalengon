import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaClient } from "@prisma/client";
import { AppLogService } from "../shared/app-log.service";

const SRC = "price-prediction";

interface DayPattern { dayOfWeek: number; avgPrice: number; samples: number }
interface Prediction {
  productId: string;
  productName: string;
  cheapestDay: number;
  cheapestDayAvg: number;
  overallAvg: number;
  savingPct: number;
  confidence: "high" | "medium" | "low";
  dataPoints: number;
}

const DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const MIN_DATA_POINTS = 14;
const MIN_CHEAPEST_SAMPLES = 3;
const MIN_SAVING_PCT = 4;

@Injectable()
export class PricePredictionService {
  private readonly log = new Logger(PricePredictionService.name);
  private readonly prisma = new PrismaClient();

  constructor(private readonly appLog: AppLogService) {}

  // Runs every Monday 8:00 AM — logs top predictions (foundation for Zalo alert)
  @Cron("0 8 * * 1")
  async weeklyPredictionReport() {
    this.log.log("Running weekly price prediction analysis…");
    await this.appLog.info("Bắt đầu phân tích dự đoán giá hàng tuần", undefined, SRC);
    try {
      const predictions = await this.getTopPredictions(10);
      if (predictions.length === 0) {
        this.log.log("No significant price patterns detected yet (need more price history)");
        await this.appLog.info("Chưa đủ dữ liệu lịch sử giá để phát hiện mẫu", undefined, SRC);
        return;
      }
      this.log.log(`Found ${predictions.length} products with price drop patterns:`);
      for (const p of predictions) {
        this.log.log(
          `  [${p.confidence.toUpperCase()}] ${p.productName.slice(0, 50)} — rẻ hơn ${p.savingPct}% vào ${DAY_NAMES[p.cheapestDay]} (${p.dataPoints} records)`,
        );
      }
      await this.appLog.info("Hoàn tất phân tích dự đoán giá hàng tuần", {
        total: predictions.length,
        top: predictions.slice(0, 5).map((p) => ({
          product: p.productName.slice(0, 60),
          cheapestDay: DAY_NAMES[p.cheapestDay],
          savingPct: p.savingPct,
          confidence: p.confidence,
          dataPoints: p.dataPoints,
        })),
      }, SRC);
    } catch (err: any) {
      this.log.error(`Price prediction analysis failed: ${err.message}`);
      await this.appLog.error("Phân tích dự đoán giá thất bại", { error: err.message }, SRC);
    }
  }

  async getTopPredictions(limit = 20): Promise<Prediction[]> {
    const products = await this.prisma.product.findMany({
      where: { isSoldOut: false },
      select: { id: true, name: true, price: true },
    });

    const results: Prediction[] = [];
    for (const product of products) {
      const p = await this.analyzeProduct(product.id, product.name).catch(() => null);
      if (p) results.push(p);
    }

    return results
      .sort((a, b) => {
        const score = { high: 3, medium: 2, low: 1 };
        if (score[b.confidence] !== score[a.confidence]) return score[b.confidence] - score[a.confidence];
        return b.savingPct - a.savingPct;
      })
      .slice(0, limit);
  }

  private async analyzeProduct(productId: string, productName: string): Promise<Prediction | null> {
    const history = await this.prisma.priceHistory.findMany({
      where: { productId, platformId: null },
      orderBy: { recordedAt: "desc" },
      take: 180,
      select: { price: true, recordedAt: true },
    });

    if (history.length < MIN_DATA_POINTS) return null;

    const byDay: Record<number, number[]> = {};
    for (const h of history) {
      const day = h.recordedAt.getDay();
      byDay[day] = byDay[day] ?? [];
      byDay[day].push(h.price);
    }

    const overallAvg = Math.round(history.reduce((s, h) => s + h.price, 0) / history.length);

    const pattern: DayPattern[] = Object.entries(byDay).map(([d, prices]) => ({
      dayOfWeek: parseInt(d),
      avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      samples: prices.length,
    }));

    const cheapest = pattern.reduce((a, b) => a.avgPrice < b.avgPrice ? a : b);
    if (cheapest.samples < MIN_CHEAPEST_SAMPLES) return null;

    const savingPct = Math.round(((overallAvg - cheapest.avgPrice) / overallAvg) * 100);
    if (savingPct < MIN_SAVING_PCT) return null;

    const confidence: Prediction["confidence"] =
      cheapest.samples >= 8 && savingPct >= 10 ? "high" :
      cheapest.samples >= 4 && savingPct >= 6  ? "medium" : "low";

    return {
      productId,
      productName,
      cheapestDay: cheapest.dayOfWeek,
      cheapestDayAvg: cheapest.avgPrice,
      overallAvg,
      savingPct,
      confidence,
      dataPoints: history.length,
    };
  }

  /** Build Zalo tip message for one prediction */
  formatZaloTip(p: Prediction): string {
    const fmtVND = (n: number) =>
      new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
    return [
      `💡 Tip mua sắm thông minh:`,
      `📦 ${p.productName.slice(0, 80)}`,
      `⏰ Thường rẻ hơn ${p.savingPct}% vào ${DAY_NAMES[p.cheapestDay]}`,
      `💰 Giá tốt nhất trung bình: ${fmtVND(p.cheapestDayAvg)} (bình thường: ${fmtVND(p.overallAvg)})`,
    ].join("\n");
  }
}
