import { prisma } from "./prisma"

type Level = "error" | "warn" | "info" | "debug"

async function write(
  level: Level,
  message: string,
  context?: unknown,
  source?: string,
): Promise<void> {
  // Console output
  const tag = `[${level.toUpperCase()}]${source ? ` [${source}]` : ""}`
  if (level === "error") console.error(tag, message, context ?? "")
  else if (level === "warn")  console.warn(tag,  message, context ?? "")
  else                        console.log(tag,   message, context ?? "")

  // Persist to DB (fire-and-forget — never throws to caller)
  try {
    await prisma.appLog.create({
      data: {
        level,
        message,
        context: context !== undefined ? JSON.stringify(context) : null,
        source:  source ?? null,
      },
    })
  } catch (err) {
    console.error("[logger] DB write failed:", err)
  }
}

export const logger = {
  error: (msg: string, ctx?: unknown, src?: string) => write("error", msg, ctx, src),
  warn:  (msg: string, ctx?: unknown, src?: string) => write("warn",  msg, ctx, src),
  info:  (msg: string, ctx?: unknown, src?: string) => write("info",  msg, ctx, src),
  debug: (msg: string, ctx?: unknown, src?: string) => write("debug", msg, ctx, src),
}
