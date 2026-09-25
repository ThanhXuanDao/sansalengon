/**
 * Multi-provider AI text generation abstraction.
 * All providers use fetch — no extra npm packages needed.
 */

export interface AITextOptions {
  maxTokens?: number
  systemPrompt?: string
  temperature?: number
}

export interface AITextProvider {
  id: string
  name: string
  model: string
  generateText(prompt: string, options?: AITextOptions): Promise<string>
}

// ── Claude (Anthropic) ────────────────────────────────────────────────────────

class ClaudeProvider implements AITextProvider {
  constructor(
    public model = "claude-haiku-4-5-20251001",
    private apiKey = process.env.ANTHROPIC_API_KEY,
  ) {}

  get id() { return "claude" }
  get name() { return "Claude" }

  async generateText(prompt: string, opts?: AITextOptions): Promise<string> {
    if (!this.apiKey) throw new Error("ANTHROPIC_API_KEY not set")

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: opts?.maxTokens ?? 800,
      messages: [{ role: "user", content: prompt }],
    }
    if (opts?.systemPrompt) body.system = opts.systemPrompt

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
    const json = await res.json() as { content: { type: string; text: string }[] }
    return json.content[0].text
  }
}

// ── OpenAI-compatible (OpenAI + DeepSeek + OpenRouter + ...) ─────────────────

class OpenAICompatProvider implements AITextProvider {
  constructor(
    public id: string,
    public name: string,
    public model: string,
    private apiKey: string | undefined,
    private baseUrl: string,
    private extraHeaders: Record<string, string> = {},
  ) {}

  async generateText(prompt: string, opts?: AITextOptions): Promise<string> {
    if (!this.apiKey) throw new Error(`${this.name} API key not set`)

    const messages: { role: string; content: string }[] = []
    if (opts?.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt })
    messages.push({ role: "user", content: prompt })

    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: opts?.maxTokens ?? 800,
          temperature: opts?.temperature ?? 0.7,
        }),
      })
    } catch (e) {
      if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
        throw new Error(`${this.name} timeout (60s). Thử lại sau.`)
      }
      throw e
    }
    if (!res.ok) throw new Error(`${this.name} API ${res.status}: ${await res.text()}`)
    const json = await res.json() as { choices: { message: { content: string | null } }[] }
    const content = json.choices[0]?.message?.content
    if (!content) throw new Error(`${this.name} returned empty content`)
    return content
  }
}

// ── OpenRouter ────────────────────────────────────────────────────────────────

// nvidia/nemotron-3-super-120b-a12b:free — 120B, tested working, free tier
const OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"

class OpenRouterProvider implements AITextProvider {
  id = "openrouter"
  name = "OpenRouter"
  model = OPENROUTER_MODEL

  constructor(private apiKey = process.env.OPENROUTER_API_KEY) {}

  async generateText(prompt: string, opts?: AITextOptions): Promise<string> {
    if (!this.apiKey) throw new Error("OPENROUTER_API_KEY not set")

    const messages: { role: string; content: string }[] = []
    if (opts?.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt })
    messages.push({ role: "user", content: prompt })

    let res: Response
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://sansale.vn",
          "X-Title": "SanSale Affiliate",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages,
          max_tokens: opts?.maxTokens ?? 800,
          temperature: opts?.temperature ?? 0.7,
        }),
      })
    } catch (e) {
      if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
        throw new Error("OpenRouter timeout (60s) — model đang quá tải. Thử lại sau vài phút hoặc đổi sang Groq.")
      }
      throw e
    }
    if (!res.ok) throw new Error(`OpenRouter API ${res.status}: ${await res.text()}`)
    const json = await res.json() as { choices: { message: { content: string | null } }[] }
    const content = json.choices[0]?.message?.content
    if (!content) throw new Error(`OpenRouter returned empty content`)
    return content
  }
}

// ── Groq (OpenAI-compatible, fastest free tier) ───────────────────────────────

// Groq uses custom LPU hardware — 500+ tokens/sec, sub-5s for typical blog requests.
// Free tier: 14,400 req/day, 30 req/min. Sign up: console.groq.com
const GROQ_MODEL_FAST    = "llama-3.1-8b-instant"
const GROQ_MODEL_QUALITY = "llama-3.3-70b-versatile"

class GroqProvider implements AITextProvider {
  id = "groq"
  name = "Groq"
  model = GROQ_MODEL_QUALITY

  constructor(private apiKey = process.env.GROQ_API_KEY) {}

  async generateText(prompt: string, opts?: AITextOptions): Promise<string> {
    if (!this.apiKey) throw new Error("GROQ_API_KEY not set")

    const messages: { role: string; content: string }[] = []
    if (opts?.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt })
    messages.push({ role: "user", content: prompt })

    let res: Response
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: opts?.maxTokens ?? 800,
          temperature: opts?.temperature ?? 0.7,
        }),
      })
    } catch (e) {
      if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
        throw new Error("Groq timeout (30s) — thử lại sau.")
      }
      throw e
    }
    if (!res.ok) throw new Error(`Groq API ${res.status}: ${await res.text()}`)
    const json = await res.json() as { choices: { message: { content: string | null } }[] }
    const content = json.choices[0]?.message?.content
    if (!content) throw new Error(`Groq returned empty content`)
    return content
  }
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

class GeminiProvider implements AITextProvider {
  id = "gemini"
  name = "Gemini"
  // gemini-flash-lite-latest = alias cho flash lite mới nhất — không thinking, ~1-4s
  model = "gemini-flash-lite-latest"

  constructor(private apiKey = process.env.GOOGLE_AI_API_KEY) {}

  async generateText(prompt: string, opts?: AITextOptions): Promise<string> {
    if (!this.apiKey) throw new Error("GOOGLE_AI_API_KEY not set")

    // Gemini doesn't have a separate system role — prepend to user content
    const text = opts?.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt

    let res: Response
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(30_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              maxOutputTokens: opts?.maxTokens ?? 800,
              temperature: opts?.temperature ?? 0.7,
            },
          }),
        },
      )
    } catch (e) {
      if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
        throw new Error("Gemini timeout (30s). Thử lại sau.")
      }
      throw e
    }
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`)
    const json = await res.json() as {
      candidates: { content: { parts: { text: string }[] } }[]
    }
    const output = json.candidates[0]?.content?.parts?.[0]?.text
    if (!output) throw new Error("Gemini returned empty content")
    return output
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export type ProviderQuality = "fast" | "quality"

/**
 * Create a text provider instance.
 * quality="fast"    → cheaper/faster model per provider
 * quality="quality" → better model (Sonnet, GPT-4o, Gemini Pro, DeepSeek-R1)
 */
export function createTextProvider(
  providerId: string,
  quality: ProviderQuality = "fast",
): AITextProvider {
  switch (providerId) {
    case "deepseek":
      return new OpenAICompatProvider(
        "deepseek", "DeepSeek",
        quality === "quality" ? "deepseek-reasoner" : "deepseek-chat",
        process.env.DEEPSEEK_API_KEY,
        "https://api.deepseek.com/v1",
      )

    case "gemini":
      // Fast: Flash (free) | Quality: Flash-Thinking (free)
      return new GeminiProvider()

    case "openai":
      return new OpenAICompatProvider(
        "openai", "OpenAI",
        quality === "quality" ? "gpt-4o" : "gpt-4o-mini",
        process.env.OPENAI_API_KEY,
        "https://api.openai.com/v1",
      )

    case "openrouter":
      return new OpenRouterProvider()

    case "groq":
      return new GroqProvider()

    case "claude":
    default:
      return new ClaudeProvider(
        quality === "quality" ? "claude-sonnet-5" : "claude-haiku-4-5-20251001",
      )
  }
}

/** Test if a provider's API key is present */
export function isProviderAvailable(providerId: string): boolean {
  switch (providerId) {
    case "deepseek":    return !!process.env.DEEPSEEK_API_KEY
    case "gemini":      return !!process.env.GOOGLE_AI_API_KEY
    case "openai":      return !!process.env.OPENAI_API_KEY
    case "claude":      return !!process.env.ANTHROPIC_API_KEY
    case "openrouter":  return !!process.env.OPENROUTER_API_KEY
    case "groq":        return !!process.env.GROQ_API_KEY
    default:            return false
  }
}
