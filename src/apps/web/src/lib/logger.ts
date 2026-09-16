import { prisma } from "./prisma"

type Level = "error" | "warn" | "info" | "debug"
type AppOrigin = "web-public" | "web-admin"
type Trigger = "cron" | "manual" | "user" | "system"

interface LogOptions {
  source?: string   // feature: "auth", "niche-config", "job-trigger", etc.
  app?: AppOrigin
  trigger?: Trigger
  context?: unknown
}

async function write(level: Level, message: string, opts: LogOptions = {}): Promise<void> {
  const { source, app, trigger, context } = opts
  const tag = `[${level.toUpperCase()}]${app ? ` [${app}]` : ""}${source ? ` [${source}]` : ""}`
  if (level === "error") console.error(tag, message, context ?? "")
  else if (level === "warn")  console.warn(tag,  message, context ?? "")
  else                        console.log(tag,   message, context ?? "")

  try {
    await prisma.appLog.create({
      data: {
        level,
        message,
        context: context !== undefined ? JSON.stringify(context) : null,
        source:  source  ?? null,
        app:     app     ?? null,
        trigger: trigger ?? null,
      },
    })
  } catch (err) {
    console.error("[logger] DB write failed:", err)
  }
}

interface ScopedLogger {
  error: (msg: string, source?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>
  warn:  (msg: string, source?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>
  info:  (msg: string, source?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>
  debug: (msg: string, source?: string, ctx?: unknown, trigger?: Trigger) => Promise<void>
}

function createLogger(app: AppOrigin): ScopedLogger {
  return {
    error: (msg, source?, ctx?, trigger?) => write("error", msg, { app, source, context: ctx, trigger }),
    warn:  (msg, source?, ctx?, trigger?) => write("warn",  msg, { app, source, context: ctx, trigger }),
    info:  (msg, source?, ctx?, trigger?) => write("info",  msg, { app, source, context: ctx, trigger }),
    debug: (msg, source?, ctx?, trigger?) => write("debug", msg, { app, source, context: ctx, trigger }),
  }
}

/** Dùng trong admin API routes (/api/admin/*) */
export const adminLog = createLogger("web-admin")

/** Dùng trong public API routes (/api/* không phải admin) */
export const publicLog = createLogger("web-public")
