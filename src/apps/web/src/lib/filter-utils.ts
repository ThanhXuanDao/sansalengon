import type { FilterItem } from "@/components/sections/FilterBar"
import type { SyncSourcePublic } from "@/hooks/useSources"
import type { Category } from "@/types"

export function toSourceItems(sources: SyncSourcePublic[]): FilterItem[] {
  return sources.map((s) => ({ slug: s.slug, label: s.name, icon: s.icon }))
}

export function toCategoryItems(cats: Category[]): FilterItem[] {
  return cats.map((c) => ({ slug: c.id, label: c.name, emoji: c.emoji }))
}

export function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]
}
