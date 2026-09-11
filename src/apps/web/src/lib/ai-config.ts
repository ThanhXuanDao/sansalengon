/**
 * AI provider configuration — reads/writes from AppSetting DB.
 * Each task type has its own provider setting so you can mix:
 *   post_generation → DeepSeek (cheap)
 *   blog_writing    → Gemini (free)
 *   seo_meta        → Claude (quality)
 *   image_generation → Pollinations (free)
 */

import { prisma } from "./prisma"
import { createTextProvider, isProviderAvailable } from "./ai-provider"
import type { AITextProvider } from "./ai-provider"

// ── Task types ────────────────────────────────────────────────────────────────

export type AITextTask = "post_generation" | "blog_writing" | "seo_meta"
export type AIImageTask = "image_generation"
export type AITask = AITextTask | AIImageTask

// ── Provider catalog ──────────────────────────────────────────────────────────

export interface ProviderInfo {
  id: string
  name: string
  tagline: string
  freeTier: string
  getKeyUrl: string
  envKey: string
  /** At runtime: whether env var is set */
  available?: boolean
}

export const TEXT_PROVIDER_CATALOG: ProviderInfo[] = [
  {
    id: "gemini",
    name: "Google Gemini Flash",
    tagline: "Miễn phí hoàn toàn",
    freeTier: "1M tokens/ngày — hoàn toàn miễn phí qua Google AI Studio",
    getKeyUrl: "https://aistudio.google.com/apikey",
    envKey: "GOOGLE_AI_API_KEY",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    tagline: "Gần như miễn phí",
    freeTier: "$0.14/1M input tokens — rẻ nhất thị trường, chất lượng ngang GPT-4",
    getKeyUrl: "https://platform.deepseek.com/api_keys",
    envKey: "DEEPSEEK_API_KEY",
  },
  {
    id: "openai",
    name: "OpenAI GPT-4o mini",
    tagline: "Rẻ, phổ biến",
    freeTier: "$0.15/1M input tokens · gpt-4o-mini (fast), gpt-4o (quality)",
    getKeyUrl: "https://platform.openai.com/api-keys",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "claude",
    name: "Claude (Anthropic)",
    tagline: "Chất lượng cao nhất",
    freeTier: "$0.80/1M input (Haiku) · $3/1M (Sonnet) — không có free tier",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    envKey: "ANTHROPIC_API_KEY",
  },
]

export const IMAGE_PROVIDER_CATALOG: ProviderInfo[] = [
  {
    id: "pollinations",
    name: "Pollinations.ai",
    tagline: "Miễn phí, không cần API key",
    freeTier: "Hoàn toàn miễn phí — Flux model, không giới hạn",
    getKeyUrl: "https://pollinations.ai",
    envKey: "", // no key needed
  },
  {
    id: "dalle",
    name: "DALL-E 3",
    tagline: "OpenAI — ~$0.04/ảnh",
    freeTier: "$0.04/image 1024×1024 — dùng chung OPENAI_API_KEY",
    getKeyUrl: "https://platform.openai.com/api-keys",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "stability",
    name: "Stability AI",
    tagline: "Ảnh đẹp — $0.01/ảnh",
    freeTier: "$0.01/image — Stable Diffusion 3",
    getKeyUrl: "https://platform.stability.ai/account/keys",
    envKey: "STABILITY_API_KEY",
  },
]

// ── DB keys ───────────────────────────────────────────────────────────────────

const DB_KEY = (task: AITask) => `ai:provider:${task}`

export const DEFAULT_PROVIDERS: Record<AITask, string> = {
  post_generation:  "claude",
  blog_writing:     "claude",
  seo_meta:         "claude",
  image_generation: "pollinations",
}

export const TASK_LABELS: Record<AITask, string> = {
  post_generation:  "Tạo post Facebook/Zalo",
  blog_writing:     "Viết blog tự động",
  seo_meta:         "Generate SEO title & description",
  image_generation: "Tạo ảnh bìa blog",
}

// ── Read / Write ──────────────────────────────────────────────────────────────

export async function getProviderForTask(task: AITextTask): Promise<AITextProvider> {
  const row = await prisma.appSetting
    .findUnique({ where: { key: DB_KEY(task) } })
    .catch(() => null)
  const providerId = row?.value ?? DEFAULT_PROVIDERS[task]
  const quality: "fast" | "quality" = task === "blog_writing" ? "quality" : "fast"
  return createTextProvider(providerId, quality)
}

export async function getProviderIdForTask(task: AITask): Promise<string> {
  const row = await prisma.appSetting
    .findUnique({ where: { key: DB_KEY(task) } })
    .catch(() => null)
  return row?.value ?? DEFAULT_PROVIDERS[task]
}

export async function setProviderForTask(task: AITask, providerId: string): Promise<void> {
  await prisma.appSetting.upsert({
    where:  { key: DB_KEY(task) },
    update: { value: providerId },
    create: { key: DB_KEY(task), value: providerId },
  })
}

/** Read all task configs from DB in one shot */
export async function getAllProviderConfig(): Promise<Record<AITask, string>> {
  const tasks: AITask[] = ["post_generation", "blog_writing", "seo_meta", "image_generation"]
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: tasks.map(DB_KEY) } },
  }).catch(() => [] as { key: string; value: string }[])

  const result = { ...DEFAULT_PROVIDERS }
  for (const row of rows) {
    const task = row.key.replace("ai:provider:", "") as AITask
    if (task in result) result[task] = row.value
  }
  return result
}

/** Attach runtime `available` flag to each catalog entry */
export function withAvailability(catalog: ProviderInfo[]): (ProviderInfo & { available: boolean })[] {
  return catalog.map((p) => ({
    ...p,
    available: p.envKey === "" || isProviderAvailable(p.id),
  }))
}

// ── AI Feature flags (enable/disable per task to control cost) ────────────────

export interface FeatureMeta {
  label: string
  desc: string
  costNote: string
  /** Whether disabling this stops API calls (vs just UI changes) */
  blocksCost: boolean
}

export const FEATURE_META: Record<AITask, FeatureMeta> = {
  post_generation:  {
    label: "AI tạo post Facebook/Zalo",
    desc: "Tạo 3 biến thể post marketing cho từng sản phẩm trong tab Tạo nội dung",
    costNote: "~$0.001–0.002/post · ~500 tokens",
    blocksCost: true,
  },
  blog_writing: {
    label: "AI viết blog tự động",
    desc: "Viết bài blog dài từ 700–900 từ (quality model)",
    costNote: "~$0.04/bài · ~3000 tokens (quality mode)",
    blocksCost: true,
  },
  seo_meta: {
    label: "AI generate SEO meta",
    desc: "Tạo title/description cho trang ngách & trang so sánh (lazy generate)",
    costNote: "~$0.002/trang · admin-triggered + lazy 1 lần/sản phẩm",
    blocksCost: true,
  },
  image_generation: {
    label: "AI tạo ảnh bìa blog",
    desc: "Tạo cover image khi viết blog. Pollinations.ai miễn phí; DALL-E tốn tiền",
    costNote: "Miễn phí (Pollinations) hoặc $0.04/ảnh (DALL-E 3)",
    blocksCost: false, // Pollinations is always free
  },
}

const FEATURE_FLAG_KEY = (task: AITask) => `ai:feature:${task}:enabled`

/** Default: all features enabled. Returns false only when explicitly set to "false" in DB. */
export async function isFeatureEnabled(task: AITask): Promise<boolean> {
  const row = await prisma.appSetting
    .findUnique({ where: { key: FEATURE_FLAG_KEY(task) } })
    .catch(() => null)
  return row?.value !== "false"
}

export async function setFeatureEnabled(task: AITask, enabled: boolean): Promise<void> {
  const key = FEATURE_FLAG_KEY(task)
  await prisma.appSetting.upsert({
    where:  { key },
    update: { value: enabled ? "true" : "false" },
    create: { key, value: enabled ? "true" : "false" },
  })
}

export async function getAllFeatureFlags(): Promise<Record<AITask, boolean>> {
  const tasks: AITask[] = ["post_generation", "blog_writing", "seo_meta", "image_generation"]
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: tasks.map(FEATURE_FLAG_KEY) } },
  }).catch(() => [] as { key: string; value: string }[])

  const result: Record<AITask, boolean> = {
    post_generation: true, blog_writing: true, seo_meta: true, image_generation: true,
  }
  for (const row of rows) {
    const task = row.key.replace("ai:feature:", "").replace(":enabled", "") as AITask
    if (task in result) result[task] = row.value !== "false"
  }
  return result
}
