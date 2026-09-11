import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

// Zalo OAuth endpoint — https://developers.zalo.me/docs/api/official-account-api/xac-thuc-va-uy-quyen/lam-moi-access-token-post-5872
const ZALO_OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token";

// Refresh khi còn ít hơn 14 ngày (token sống 90 ngày)
const REFRESH_THRESHOLD_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DB_KEYS = {
  accessToken:  "zalo:access_token",
  refreshToken: "zalo:refresh_token",
  expiresAt:    "zalo:token_expires_at",   // ISO string
} as const;

export interface ZaloTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class ZaloTokenService implements OnModuleInit {
  private readonly log = new Logger(ZaloTokenService.name);
  private readonly prisma = new PrismaClient();

  // In-memory cache — tránh query DB mỗi lần broadcast
  private cached: ZaloTokens | null = null;

  constructor(private readonly cfg: ConfigService) {}

  // Khi service khởi động: seed token từ env nếu DB chưa có
  async onModuleInit() {
    try {
      const stored = await this.loadFromDb();
      if (!stored) {
        await this.seedFromEnv();
      } else {
        this.cached = stored;
        const daysLeft = this.daysUntilExpiry(stored.expiresAt);
        this.log.log(`Zalo token loaded — expires in ${daysLeft} day(s)`);
        if (daysLeft <= REFRESH_THRESHOLD_DAYS) {
          this.log.warn(`Token expires soon (${daysLeft}d) — triggering early refresh`);
          await this.refreshAndSave();
        }
      }
    } catch (err: any) {
      this.log.warn(`Token init failed: ${err.message}`);
    }
  }

  // Chạy mỗi thứ Hai 7h sáng — kiểm tra + refresh nếu cần
  @Cron("0 7 * * 1")
  async scheduledRefreshCheck() {
    this.log.log("Weekly token check...");
    try {
      const tokens = await this.loadFromDb();
      if (!tokens) {
        this.log.warn("No Zalo token in DB — set ZALO_OA_ACCESS_TOKEN to init");
        return;
      }
      const daysLeft = this.daysUntilExpiry(tokens.expiresAt);
      this.log.log(`Token expires in ${daysLeft} day(s)`);
      if (daysLeft <= REFRESH_THRESHOLD_DAYS) {
        await this.refreshAndSave();
      }
    } catch (err: any) {
      this.log.error(`Scheduled refresh check failed: ${err.message}`);
    }
  }

  // Lấy access token hợp lệ — auto refresh nếu gần hết hạn
  async getValidToken(): Promise<string | null> {
    const tokens = this.cached ?? await this.loadFromDb();
    if (!tokens) return null;

    if (this.daysUntilExpiry(tokens.expiresAt) <= REFRESH_THRESHOLD_DAYS) {
      const refreshed = await this.refreshAndSave();
      return refreshed?.accessToken ?? null;
    }

    return tokens.accessToken;
  }

  // Gọi Zalo API để lấy token mới — trả về tokens mới hoặc null nếu lỗi
  async refreshAndSave(): Promise<ZaloTokens | null> {
    const appId     = this.cfg.get<string>("ZALO_OA_APP_ID");
    const appSecret = this.cfg.get<string>("ZALO_OA_APP_SECRET");
    const stored    = this.cached ?? await this.loadFromDb();

    if (!appId || !appSecret) {
      this.log.error("ZALO_OA_APP_ID or ZALO_OA_APP_SECRET not set — cannot refresh");
      return null;
    }
    if (!stored?.refreshToken) {
      this.log.error("No refresh token in DB — manual re-auth required");
      return null;
    }

    try {
      const body = new URLSearchParams({
        grant_type:    "refresh_token",
        app_id:        appId,
        refresh_token: stored.refreshToken,
      });

      const res = await fetch(ZALO_OAUTH_URL, {
        method:  "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key:      appSecret,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const data = await res.json() as {
        access_token?:  string;
        refresh_token?: string;
        expires_in?:    number;   // seconds, thường = 7776000 (90 ngày)
        error?:         number;
        message?:       string;
      };

      if (data.error || !data.access_token) {
        throw new Error(`Zalo OAuth error ${data.error}: ${data.message}`);
      }

      const expiresAt = new Date(Date.now() + (data.expires_in ?? 7_776_000) * 1000);
      const newTokens: ZaloTokens = {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token ?? stored.refreshToken,
        expiresAt,
      };

      await this.saveToDb(newTokens);
      this.cached = newTokens;

      const daysLeft = this.daysUntilExpiry(expiresAt);
      this.log.log(`Token refreshed successfully — new expiry: ${expiresAt.toISOString()} (${daysLeft} days)`);
      return newTokens;
    } catch (err: any) {
      this.log.error(`Token refresh failed: ${err.message}`);
      return null;
    }
  }

  // Trạng thái token để hiển thị admin
  async getStatus(): Promise<{
    hasToken: boolean;
    expiresAt: string | null;
    daysLeft: number | null;
    needsRefresh: boolean;
  }> {
    const tokens = await this.loadFromDb();
    if (!tokens) return { hasToken: false, expiresAt: null, daysLeft: null, needsRefresh: false };
    const daysLeft = this.daysUntilExpiry(tokens.expiresAt);
    return {
      hasToken:     true,
      expiresAt:    tokens.expiresAt.toISOString(),
      daysLeft,
      needsRefresh: daysLeft <= REFRESH_THRESHOLD_DAYS,
    };
  }

  // Seed lần đầu từ biến môi trường khi DB chưa có gì
  private async seedFromEnv() {
    const accessToken  = this.cfg.get<string>("ZALO_OA_ACCESS_TOKEN");
    const refreshToken = this.cfg.get<string>("ZALO_OA_REFRESH_TOKEN");
    if (!accessToken) {
      this.log.warn("ZALO_OA_ACCESS_TOKEN not set — Zalo broadcast disabled");
      return;
    }
    // Zalo token sống 90 ngày — assume vừa được cấp khi seed
    const expiresAt = new Date(Date.now() + 90 * MS_PER_DAY);
    const tokens: ZaloTokens = { accessToken, refreshToken: refreshToken ?? "", expiresAt };
    await this.saveToDb(tokens);
    this.cached = tokens;
    this.log.log("Zalo token seeded from env — expires ~90 days from now");
  }

  private async loadFromDb(): Promise<ZaloTokens | null> {
    const [atRow, rtRow, expRow] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: DB_KEYS.accessToken } }),
      this.prisma.appSetting.findUnique({ where: { key: DB_KEYS.refreshToken } }),
      this.prisma.appSetting.findUnique({ where: { key: DB_KEYS.expiresAt } }),
    ]);
    if (!atRow?.value) return null;
    return {
      accessToken:  atRow.value,
      refreshToken: rtRow?.value ?? "",
      expiresAt:    expRow ? new Date(expRow.value) : new Date(Date.now() + 90 * MS_PER_DAY),
    };
  }

  private async saveToDb(tokens: ZaloTokens) {
    await Promise.all([
      this.prisma.appSetting.upsert({
        where:  { key: DB_KEYS.accessToken },
        update: { value: tokens.accessToken },
        create: { key: DB_KEYS.accessToken, value: tokens.accessToken },
      }),
      this.prisma.appSetting.upsert({
        where:  { key: DB_KEYS.refreshToken },
        update: { value: tokens.refreshToken },
        create: { key: DB_KEYS.refreshToken, value: tokens.refreshToken },
      }),
      this.prisma.appSetting.upsert({
        where:  { key: DB_KEYS.expiresAt },
        update: { value: tokens.expiresAt.toISOString() },
        create: { key: DB_KEYS.expiresAt, value: tokens.expiresAt.toISOString() },
      }),
    ]);
  }

  private daysUntilExpiry(expiresAt: Date): number {
    return Math.floor((expiresAt.getTime() - Date.now()) / MS_PER_DAY);
  }
}
