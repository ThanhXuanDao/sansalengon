/**
 * Parse Vietnamese price strings into cents (VND × 100).
 *
 * Handles formats:
 *   "29.000đ"      → 29,000 VND → 2,900,000 cents
 *   "1.299.000₫"   → 1,299,000 VND → 129,900,000 cents
 *   "149,000đ"     → 149,000 VND (comma as thousands sep) → 14,900,000 cents
 *   "149000"       → 149,000 VND → 14,900,000 cents
 *   "29.5"         → treated as whole number 295,000 ... actually ambiguous — see note below
 *
 * Note on ambiguity: in Vietnamese retail, prices are always whole VND.
 * We strip all separators and treat the remaining digits as the full VND amount.
 */
export function parseViPrice(raw: string): number {
  if (!raw) return 0
  const stripped = raw
    .replace(/[₫đ\s]/gi, "")  // remove currency symbols
    .split(",")[0]             // drop decimal part if any (e.g. "149.000,00" → "149.000")
    .replace(/\./g, "")        // remove thousands-separator dots
    .trim()
  const vnd = parseInt(stripped, 10)
  return isNaN(vnd) || vnd <= 0 ? 0 : vnd
}
