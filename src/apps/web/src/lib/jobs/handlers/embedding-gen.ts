import { prisma } from "@/lib/prisma"
import type { JobConfig, JobResult, JobError } from "../types"

type Provider = "openai" | "gemini" | "none"

function detectProvider(): Provider {
  if (process.env.OPENAI_API_KEY) return "openai"
  if (process.env.GOOGLE_AI_API_KEY) return "gemini"
  return "none"
}

async function generateVector(
  text: string,
  provider: Provider,
): Promise<{ vector: number[]; model: string; dims: number } | null> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const json = await res.json() as { data: { embedding: number[] }[] }
    const vector = json.data[0].embedding
    return { vector, model: "text-embedding-3-small", dims: vector.length }
  }
  if (provider === "gemini") {
    const key = process.env.GOOGLE_AI_API_KEY
    const model = "text-embedding-004"
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (!res.ok) return null
    const json = await res.json() as { embedding: { values: number[] } }
    const vector = json.embedding.values
    return { vector, model, dims: vector.length }
  }
  return null
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function embeddingGenHandler(config: JobConfig): Promise<JobResult> {
  const provider = detectProvider()
  if (provider === "none") {
    return {
      itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0,
      summary: "Không có embedding provider. Cần OPENAI_API_KEY hoặc GOOGLE_AI_API_KEY.",
      errors: [{ reason: "No embedding provider configured" }],
    }
  }

  const limit = Math.min(Number(config.limit ?? 50), 200)

  const existing = new Set(
    (await prisma.productEmbedding.findMany({ select: { productId: true } })).map((r) => r.productId),
  )

  const products = await prisma.product.findMany({
    where: { id: { notIn: [...existing] } },
    select: { id: true, name: true },
    take: limit,
  })

  const total = products.length
  let success = 0
  let failed = 0
  const errors: JobError[] = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    if (i > 0) await sleep(200)

    try {
      const result = await generateVector(p.name, provider)
      if (!result) { failed++; errors.push({ item: p.name, reason: "Provider returned null" }); continue }

      await prisma.productEmbedding.upsert({
        where: { productId: p.id },
        update: { embedding: JSON.stringify(result.vector), model: result.model, dims: result.dims },
        create: { productId: p.id, embedding: JSON.stringify(result.vector), model: result.model, dims: result.dims },
      })
      success++
    } catch (err) {
      failed++
      errors.push({ item: p.name, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    itemsTotal: total,
    itemsSuccess: success,
    itemsFailed: failed,
    source: provider,
    summary: `Tạo embedding cho ${success}/${total} sản phẩm (${failed} lỗi). Provider: ${provider}.`,
    errors: errors.slice(0, 20),
    meta: { skippedAlreadyEmbedded: existing.size },
  }
}
