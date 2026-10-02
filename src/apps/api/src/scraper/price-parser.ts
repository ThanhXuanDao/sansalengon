/**
 * Parse Vietnamese price strings into whole VND.
 *
 * Handles:
 *   "22.990.000 ₫"   → 22990000  (dot = thousands, VN style)
 *   "38,990,000 ₫"   → 38990000  (comma = thousands, US style — e.g. Hoàng Hà Mobile)
 *   "149.000,00"      → 149000    (dot = thousands, comma = decimal — European)
 *   "149,000đ"        → 149000    (comma = thousands, 3 digits after)
 *   "46,990,000 ₫\n- 17%" → 46990000  (extra text after price — ignored)
 */
export function parseViPrice(raw: string): number {
  if (!raw) return 0

  // Extract first price-like token (digits + separators), stopping at non-price chars
  const match = raw.replace(/[₫đ]/gi, "").match(/\d[\d.,]*/)
  if (!match) return 0
  let s = match[0]

  const lastComma = s.lastIndexOf(",")
  const lastDot   = s.lastIndexOf(".")

  if (lastComma > lastDot) {
    // Comma is the rightmost separator
    const afterComma = s.slice(lastComma + 1)
    if (afterComma.length <= 2) {
      // Decimal comma (e.g. "149.000,00") — drop decimal part, remove dot-thousands
      s = s.slice(0, lastComma).replace(/\./g, "")
    } else {
      // Thousands comma (e.g. "38,990,000") — remove all commas
      s = s.replace(/,/g, "")
    }
  } else {
    // Dot is rightmost or no comma — dots are thousands separators
    s = s.replace(/[.,]/g, "")
  }

  const vnd = parseInt(s, 10)
  return isNaN(vnd) || vnd <= 0 ? 0 : vnd
}
