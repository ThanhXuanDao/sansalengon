import type { Category } from "@/types"

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories")
  if (!res.ok) throw new Error("Failed to fetch categories")
  const json = await res.json()
  return json.data
}
