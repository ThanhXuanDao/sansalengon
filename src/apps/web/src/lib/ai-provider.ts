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

// ── OpenAI-compatible (OpenAI + DeepSeek + Groq) ──────────────────────────────

class OpenAICompatProvider implements AITextProvider {
  constructor(
    public id: string,
    public name: string,
    public model: string,
    private apiKey: string | undefined,
    private baseUrl: string,
  ) {}

  async generateText(prompt: string, opts?: AITextOptions): Promise<string> {
    if (!this.apiKey) throw new Error(`${this.name} API key not set`)

    const messages: { role: string; content: string }[] = []
    if (opts?.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt })
    messages.push({ role: "user", content: prompt })

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
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
    if (!res.ok) throw new Error(`${this.name} API ${res.status}: ${await res.text()}`)
    const json = await res.json() as { choices: { message: { content: string } }[] }
    return json.choices[0].message.content
  }
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

class GeminiProvider implements AITextProvider {
  id = "gemini"
  name = "Gemini"
  model = "gemini-1.5-flash"

  constructor(private apiKey = process.env.GOOGLE_AI_API_KEY) {}

  async generateText(prompt: string, opts?: AITextOptions): Promise<string> {
    if (!this.apiKey) throw new Error("GOOGLE_AI_API_KEY not set")

    // Gemini doesn't have a separate system role — prepend to user content
    const text = opts?.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
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
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`)
    const json = await res.json() as {
      candidates: { content: { parts: { text: string }[] } }[]
    }
    return json.candidates[0].content.parts[0].text
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
    case "deepseek":  return !!process.env.DEEPSEEK_API_KEY
    case "gemini":    return !!process.env.GOOGLE_AI_API_KEY
    case "openai":    return !!process.env.OPENAI_API_KEY
    case "claude":    return !!process.env.ANTHROPIC_API_KEY
    default:          return false
  }
}
