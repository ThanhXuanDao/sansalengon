import { Injectable } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

type Level = "error" | "warn" | "info" | "debug";

@Injectable()
export class AppLogService {
  private readonly prisma = new PrismaClient();

  async log(level: Level, message: string, context?: unknown, source?: string): Promise<void> {
    try {
      const id  = randomUUID();
      const ctx = context !== undefined ? JSON.stringify(context) : null;
      const src = source ?? null;
      const now = new Date();

      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "AppLog" (id, level, message, context, source, "createdAt")
          VALUES (${id}, ${level}, ${message}, ${ctx}::text, ${src}, ${now})
        `
      );
    } catch {
      // logger must never crash the caller
    }
  }

  error = (msg: string, ctx?: unknown, src?: string) => this.log("error", msg, ctx, src);
  warn  = (msg: string, ctx?: unknown, src?: string) => this.log("warn",  msg, ctx, src);
  info  = (msg: string, ctx?: unknown, src?: string) => this.log("info",  msg, ctx, src);
  debug = (msg: string, ctx?: unknown, src?: string) => this.log("debug", msg, ctx, src);
}
