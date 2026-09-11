/**
 * Feedback sentiment classification.
 * Uses the configured AI provider (respects feature flag for post_generation task).
 * Gracefully degrades — returns null if AI is off or fails.
 */

import { getProviderForTask, isFeatureEnabled } from "./ai-config"

export type Sentiment = "positive" | "negative" | "neutral" | "suggestion"

export interface SentimentResult {
  sentiment: Sentiment
  score: number // 0.0–1.0 confidence
}

const SYSTEM_PROMPT = `You are a sentiment classifier for user feedback messages on a Vietnamese e-commerce affiliate website. Classify the message into exactly one of these categories:
- positive: praise, thanks, satisfaction
- negative: complaint, frustration, disappointment
- suggestion: feature request, improvement idea
- neutral: question, informational, unclear tone

Respond with ONLY a JSON object: {"sentiment":"<category>","score":<0.0-1.0>}`

export async function classifySentiment(message: string): Promise<SentimentResult | null> {
  try {
    const enabled = await isFeatureEnabled("post_generation")
    if (!enabled) return null

    const provider = await getProviderForTask("post_generation")
    const raw = await provider.generateText(
      `Classify this feedback message:\n\n"${message.slice(0, 500)}"`,
      { systemPrompt: SYSTEM_PROMPT, maxTokens: 80, temperature: 0 },
    )

    const json = JSON.parse(raw.trim()) as { sentiment: string; score: number }
    const validSentiments: Sentiment[] = ["positive", "negative", "neutral", "suggestion"]
    if (!validSentiments.includes(json.sentiment as Sentiment)) return null

    return {
      sentiment: json.sentiment as Sentiment,
      score: Math.max(0, Math.min(1, Number(json.score) || 0.5)),
    }
  } catch {
    return null
  }
}
