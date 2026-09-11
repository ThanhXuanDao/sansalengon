/**
 * AI image generation.
 * Default: Pollinations.ai — free, no API key, URL-based.
 * Optional: DALL-E 3 via OPENAI_API_KEY.
 */

export interface ImageGenerateOptions {
  width?: number
  height?: number
  prompt: string
}

export interface ImageResult {
  url: string
  provider: string
}

// ── Pollinations.ai (free, no key) ────────────────────────────────────────────

export function pollinationsUrl(prompt: string, width = 1200, height = 630): string {
  const encoded = encodeURIComponent(prompt)
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux&seed=${Date.now() % 10000}`
}

export async function generateWithPollinations(opts: ImageGenerateOptions): Promise<ImageResult> {
  return {
    url: pollinationsUrl(opts.prompt, opts.width, opts.height),
    provider: "pollinations",
  }
}

// ── DALL-E 3 (OpenAI key required) ───────────────────────────────────────────

export async function generateWithDalle(opts: ImageGenerateOptions): Promise<ImageResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not set")

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: opts.prompt,
      n: 1,
      size: "1792x1024", // closest to 1200×630 aspect
      quality: "standard",
    }),
  })
  if (!res.ok) throw new Error(`DALL-E API ${res.status}: ${await res.text()}`)
  const json = await res.json() as { data: { url: string }[] }
  return { url: json.data[0].url, provider: "dalle" }
}

// ── Stability AI ─────────────────────────────────────────────────────────────

export async function generateWithStability(opts: ImageGenerateOptions): Promise<ImageResult> {
  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) throw new Error("STABILITY_API_KEY not set")

  const form = new FormData()
  form.append("prompt", opts.prompt)
  form.append("output_format", "webp")
  form.append("aspect_ratio", "16:9")

  const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
    body: form,
  })
  if (!res.ok) throw new Error(`Stability API ${res.status}: ${await res.text()}`)
  const json = await res.json() as { image: string }
  return { url: `data:image/webp;base64,${json.image}`, provider: "stability" }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function generateImage(
  opts: ImageGenerateOptions,
  providerId = "pollinations",
): Promise<ImageResult> {
  switch (providerId) {
    case "dalle":      return generateWithDalle(opts)
    case "stability":  return generateWithStability(opts)
    case "pollinations":
    default:           return generateWithPollinations(opts)
  }
}

/** Build a blog cover image prompt from post metadata */
export function buildBlogCoverPrompt(
  nicheName: string,
  title: string,
  tags: string[],
): string {
  return `Professional lifestyle product photography for ${nicheName} affiliate blog. Article: "${title}". Style: clean flat-lay or hero shot, vibrant but tasteful colors, e-commerce aesthetic. Keywords: ${tags.slice(0, 3).join(", ")}. High quality, 16:9 format, no text overlay.`
}
