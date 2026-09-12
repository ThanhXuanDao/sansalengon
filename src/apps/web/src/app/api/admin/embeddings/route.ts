import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

// ── Embedding provider (same logic as NestJS EmbeddingService) ────────────────

type Provider = "openai" | "gemini" | "none"

function detectProvider(): Provider {
  if (process.env.OPENAI_API_KEY) return "openai"
  if (process.env.GOOGLE_AI_API_KEY) return "gemini"
  return "none"
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function generateVector(text: string, provider: Provider): Promise<{ vector: number[]; model: string; dims: number } | null> {
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

// ── GET: stats ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [total, embedded, sample] = await Promise.all([
    prisma.product.count(),
    prisma.productEmbedding.count(),
    prisma.productEmbedding.findFirst({ orderBy: { updatedAt: "desc" } }),
  ])

  return NextResponse.json({
    total,
    embedded,
    missing: total - embedded,
    provider: detectProvider(),
    model: sample?.model ?? null,
    dims: sample?.dims ?? null,
    lastUpdated: sample?.updatedAt ?? null,
  })
}

// ── POST: embed missing products ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const provider = detectProvider()
  if (provider === "none") {
    return NextResponse.json(
      { error: "No embedding provider available. Set OPENAI_API_KEY or GOOGLE_AI_API_KEY." },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => ({})) as { productIds?: string[]; limit?: number }
  const limit = Math.min(body.limit ?? 50, 100)

  const existing = new Set(
    (await prisma.productEmbedding.findMany({ select: { productId: true } })).map((r) => r.productId),
  )

  let products: { id: string; name: string }[]
  if (body.productIds?.length) {
    products = await prisma.product.findMany({
      where: { id: { in: body.productIds } },
      select: { id: true, name: true },
    })
  } else {
    products = await prisma.product.findMany({
      where: { id: { notIn: [...existing] } },
      select: { id: true, name: true },
      take: limit,
    })
  }

  let added = 0, failed = 0
  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    // 200ms giữa mỗi lần gọi embedding — tránh burst rate limit
    if (i > 0) await sleep(200)

    const result = await generateVector(p.name, provider).catch(() => null)
    if (!result) { failed++; continue }

    await prisma.productEmbedding.upsert({
      where: { productId: p.id },
      update: { embedding: JSON.stringify(result.vector), model: result.model, dims: result.dims },
      create: { productId: p.id, embedding: JSON.stringify(result.vector), model: result.model, dims: result.dims },
    }).catch(() => { failed++ })
    added++
  }

  return NextResponse.json({ ok: true, added, failed, skipped: existing.size })
}
