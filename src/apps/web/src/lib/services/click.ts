export type ClickSource = "website" | "zalo" | "facebook" | "direct"

export async function logClick(
  productId: string,
  source: ClickSource = "website"
): Promise<{ productUrl: string }> {
  const res = await fetch("/api/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, source }),
  })
  if (!res.ok) throw new Error("Failed to log click")
  return res.json()
}
