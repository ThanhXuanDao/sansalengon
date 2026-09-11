import { Injectable, Logger } from "@nestjs/common"
import { PlatformAdapter, NormalizedProduct } from "../platform.adapter"
import { EmbeddingService, cosineSimilarity } from "./embedding.service"

export interface MatchCandidate {
  platformProductId: string
  platformUrl: string
  candidateName: string
  candidatePrice: number
  confidence: number
}

@Injectable()
export class ProductMatcherService {
  private readonly log = new Logger(ProductMatcherService.name)

  constructor(private readonly embeddings: EmbeddingService) {}

  /**
   * Find the best candidate on a platform for a given product name.
   * When `productId` is given, loads its stored embedding for cosine similarity boost.
   */
  async findCandidates(
    productName: string,
    adapter: PlatformAdapter,
    limit = 5,
    productId?: string,
  ): Promise<MatchCandidate[]> {
    let results: NormalizedProduct[]

    try {
      results = await adapter.searchByName(productName, limit * 2)
    } catch (e) {
      this.log.warn(`${adapter.platformId}: search failed for "${productName}": ${(e as Error).message}`)
      return []
    }

    // Load stored embedding for query product (if available)
    const queryEmbedding = productId ? await this.embeddings.loadEmbedding(productId).catch(() => null) : null

    // Generate on-the-fly embeddings for all candidate names in parallel (if provider available)
    let candidateVectors: Map<string, number[]> = new Map()
    if (queryEmbedding && this.embeddings.isAvailable()) {
      const vectors = await Promise.all(
        results.map((r) =>
          this.embeddings.generateVector(r.name)
            .then((v) => ({ id: r.platformProductId, vector: v?.vector ?? null }))
            .catch(() => ({ id: r.platformProductId, vector: null }))
        ),
      )
      for (const { id, vector } of vectors) {
        if (vector) candidateVectors.set(id, vector)
      }
    }

    return results
      .map((r) => {
        const candidateVector = candidateVectors.get(r.platformProductId) ?? null
        const embeddingSim = queryEmbedding && candidateVector
          ? cosineSimilarity(queryEmbedding.vector, candidateVector)
          : null
        return {
          platformProductId: r.platformProductId,
          platformUrl: r.platformUrl,
          candidateName: r.name,
          candidatePrice: r.price,
          confidence: this.computeConfidence(productName, r, embeddingSim),
        }
      })
      .filter((c) => c.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
  }

  private computeConfidence(query: string, candidate: NormalizedProduct, embeddingSim: number | null = null): number {
    const normQuery = this.normalize(query)
    const normName = this.normalize(candidate.name)

    // Barcode / SKU exact match → perfect confidence
    if (candidate.barcode) {
      const barcodeInQuery = normQuery.includes(candidate.barcode.toLowerCase())
      if (barcodeInQuery) return 1.0
    }

    // Token overlap score
    const queryTokens = new Set(normQuery.split(/\s+/).filter((t) => t.length > 1))
    const nameTokens = normName.split(/\s+/).filter((t) => t.length > 1)

    if (queryTokens.size === 0) return 0

    let matchedTokens = 0
    for (const t of nameTokens) {
      if (queryTokens.has(t)) matchedTokens++
    }

    const tokenOverlap = matchedTokens / Math.max(queryTokens.size, nameTokens.length)

    // Levenshtein similarity for full string
    const editSim = 1 - this.levenshtein(normQuery, normName) / Math.max(normQuery.length, normName.length)

    // Weighted blend: use embedding when available, else token+edit
    const score = embeddingSim !== null
      ? embeddingSim * 0.50 + tokenOverlap * 0.35 + editSim * 0.15
      : tokenOverlap * 0.70 + editSim * 0.30

    return Math.min(score, 0.99) // barcode exact is the only way to reach 1.0
  }

  private normalize(s: string): string {
    return s
      .toLowerCase()
      // Remove Vietnamese diacritics
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // Remove common noise words and colour/size info
      .replace(/\b(màu|size|cỡ|loại|hộp|gói|bịch|kg|ml|g|l|cm|m|mm)\b/gi, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    const m = a.length
    const n = b.length
    const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)

    for (let i = 1; i <= m; i++) {
      let prev = dp[0]
      dp[0] = i
      for (let j = 1; j <= n; j++) {
        const temp = dp[j]
        dp[j] = a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1])
        prev = temp
      }
    }

    return dp[n]
  }
}
