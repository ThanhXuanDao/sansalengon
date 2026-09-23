import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

type Level = "error" | "warn" | "info" | "debug";
export type AppOrigin = "web-public" | "web-admin" | "api" | "api-sync" | "api-distribute";
export type Trigger = "cron" | "manual" | "user" | "system";

export interface ScopedLogger {
  error: (msg: string, src?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>;
  warn:  (msg: string, src?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>;
  info:  (msg: string, src?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>;
  debug: (msg: string, src?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>;
}

@Injectable()
export class AppLogService {
  private readonly prisma = new PrismaClient();

  async log(
    level: Level,
    message: string,
    context?: unknown,
    source?: string,
    app?: AppOrigin,
    trigger?: Trigger,
  ): Promise<void> {
    try {
      const id  = randomUUID();
      const ctx = context !== undefined ? JSON.stringify(context) : null;
      const src = source  ?? null;
      const ap  = app     ?? null;
      const trg = trigger ?? null;
      const now = new Date();

      await this.prisma.$executeRaw`
          INSERT INTO "AppLog" (id, level, message, context, source, app, trigger, "createdAt")
          VALUES (${id}, ${level}, ${message}, ${ctx}::text, ${src}, ${ap}, ${trg}, ${now})
        `;
    } catch {
      // logger must never crash the caller
    }
  }

  error = (msg: string, ctx?: unknown, src?: string, app?: AppOrigin, trigger?: Trigger) =>
    this.log("error", msg, ctx, src, app, trigger);
  warn  = (msg: string, ctx?: unknown, src?: string, app?: AppOrigin, trigger?: Trigger) =>
    this.log("warn",  msg, ctx, src, app, trigger);
  info  = (msg: string, ctx?: unknown, src?: string, app?: AppOrigin, trigger?: Trigger) =>
    this.log("info",  msg, ctx, src, app, trigger);
  debug = (msg: string, ctx?: unknown, src?: string, app?: AppOrigin, trigger?: Trigger) =>
    this.log("debug", msg, ctx, src, app, trigger);

  /**
   * Trả về logger đã bind sẵn app context.
   * Dùng ở class level: `private readonly slog = this.appLog.scope("api-sync")`
   */
  scope(app: AppOrigin): ScopedLogger {
    return {
      error: (msg, src?, ctx?, trigger?) => this.log("error", msg, ctx, src, app, trigger),
      warn:  (msg, src?, ctx?, trigger?) => this.log("warn",  msg, ctx, src, app, trigger),
      info:  (msg, src?, ctx?, trigger?) => this.log("info",  msg, ctx, src, app, trigger),
      debug: (msg, src?, ctx?, trigger?) => this.log("debug", msg, ctx, src, app, trigger),
    };
  }
}
