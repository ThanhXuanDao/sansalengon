import { Injectable, Logger } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { PrismaClient } from "@prisma/client"

// ── Provider detection ────────────────────────────────────────────────────────

type EmbeddingProvider = "openai" | "gemini" | "none"

function detectProvider(): EmbeddingProvider {
  if (process.env.OPENAI_API_KEY) return "openai"
  if (process.env.GOOGLE_AI_API_KEY) return "gemini"
  return "none"
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function openaiEmbed(text: string): Promise<{ vector: number[]; model: string; dims: number }> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  })
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`)
  const json = await res.json() as { data: { embedding: number[] }[] }
  const vector = json.data[0].embedding
  return { vector, model: "text-embedding-3-small", dims: vector.length }
}

async function geminiEmbed(text: string): Promise<{ vector: number[]; model: string; dims: number }> {
  const key = process.env.GOOGLE_AI_API_KEY
  const model = "text-embedding-004"
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    },
  )
  if (!res.ok) throw new Error(`Gemini embeddings ${res.status}: ${await res.text()}`)
  const json = await res.json() as { embedding: { values: number[] } }
  const vector = json.embedding.values
  return { vector, model, dims: vector.length }
}

// ── Cosine similarity ─────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ── Service ───────────────────────────────────────────────────────────────────

export interface EmbeddingRecord {
  productId: string
  vector: number[]
  model: string
  dims: number
}

@Injectable()
export class EmbeddingService {
  private readonly log = new Logger(EmbeddingService.name)
  private readonly prisma = new PrismaClient()
  private readonly provider: EmbeddingProvider = detectProvider()

  isAvailable(): boolean { return this.provider !== "none" }

  async generateVector(text: string): Promise<{ vector: number[]; model: string; dims: number } | null> {
    try {
      if (this.provider === "openai") return await openaiEmbed(text)
      if (this.provider === "gemini") return await geminiEmbed(text)
      return null
    } catch (e: any) {
      this.log.warn(`Embedding generation failed: ${e.message}`)
      return null
    }
  }

  async upsertEmbedding(productId: string, productName: string): Promise<boolean> {
    const result = await this.generateVector(productName)
    if (!result) return false

    await this.prisma.productEmbedding.upsert({
      where: { productId },
      update: { embedding: JSON.stringify(result.vector), model: result.model, dims: result.dims },
      create: { productId, embedding: JSON.stringify(result.vector), model: result.model, dims: result.dims },
    })
    return true
  }

  async loadEmbedding(productId: string): Promise<EmbeddingRecord | null> {
    const row = await this.prisma.productEmbedding.findUnique({ where: { productId } }).catch(() => null)
    if (!row) return null
    return { productId, vector: JSON.parse(row.embedding) as number[], model: row.model, dims: row.dims }
  }

  async loadAllEmbeddings(): Promise<Map<string, EmbeddingRecord>> {
    const rows = await this.prisma.productEmbedding.findMany().catch(() => [])
    const map = new Map<string, EmbeddingRecord>()
    for (const row of rows) {
      map.set(row.productId, {
        productId: row.productId,
        vector: JSON.parse(row.embedding) as number[],
        model: row.model,
        dims: row.dims,
      })
    }
    return map
  }

  async getStats(): Promise<{ total: number; embedded: number; provider: string; dims: number | null }> {
    const [total, embedded] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.productEmbedding.count(),
    ])
    const sample = embedded > 0 ? await this.prisma.productEmbedding.findFirst() : null
    return { total, embedded, provider: this.provider, dims: sample?.dims ?? null }
  }

  /** Embed all products that don't have an embedding yet. Run via admin or weekly cron. */
  async embedMissing(): Promise<{ added: number; skipped: number; failed: number }> {
    if (!this.isAvailable()) return { added: 0, skipped: 0, failed: 1 }

    const existing = new Set((await this.prisma.productEmbedding.findMany({ select: { productId: true } })).map((r) => r.productId))
    const products = await this.prisma.product.findMany({ select: { id: true, name: true } })
    const missing = products.filter((p) => !existing.has(p.id))

    let added = 0, failed = 0
    for (const p of missing) {
      const ok = await this.upsertEmbedding(p.id, p.name)
      if (ok) added++
      else failed++
      // Small delay to avoid rate-limiting
      await new Promise((r) => setTimeout(r, 200))
    }

    return { added, skipped: existing.size, failed }
  }

  /** Weekly cron: re-embed any product whose embedding might be stale (older than 30 days) */
  @Cron("0 3 * * 0") // Sunday 3am
  async weeklyReEmbed() {
    if (!this.isAvailable()) return
    this.log.log("Running weekly embedding refresh")
    try {
      const result = await this.embedMissing()
      this.log.log(`Embedding refresh done: +${result.added} new, ${result.skipped} existing, ${result.failed} failed`)
    } catch (e: any) {
      this.log.error(`Embedding refresh failed: ${e.message}`)
    }
  }
}
