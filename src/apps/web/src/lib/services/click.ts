export async function logClick(
  productId: string
): Promise<{ shopeeUrl: string }> {
  const res = await fetch("/api/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  })
  if (!res.ok) throw new Error("Failed to log click")
  return res.json()
}
