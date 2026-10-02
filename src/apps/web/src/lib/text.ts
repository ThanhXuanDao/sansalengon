/**
 * Normalizes Vietnamese text for accent-insensitive search.
 * "Săn Sale Ngon" → "san sale ngon", "đồng hồ" → "dong ho"
 */
export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim()
}

export function normalizedIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true
  return normalizeText(haystack).includes(normalizeText(needle))
}

/**
 * Word-based match after normalization.
 * Short words (≤3 chars) require exact word match to avoid false positives
 * between Vietnamese words that share the same letters after diacritic removal
 * (e.g. "mon" should not match "mong" from "mọng").
 * Longer words (≥4 chars) use prefix match to allow partial search ("lapt" → "laptop").
 */
export function matchesQueryWords(text: string, queryWords: string[]): boolean {
  if (queryWords.length === 0) return true
  const textWords = normalizeText(text).split(/\s+/).filter(Boolean)
  return queryWords.every((qw) => {
    if (qw.length >= 4) return textWords.some((tw) => tw.startsWith(qw))
    return textWords.includes(qw)
  })
}
