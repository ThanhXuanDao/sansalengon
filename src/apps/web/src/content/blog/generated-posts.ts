// AUTO-GENERATED — do not edit manually. Managed by /api/admin/generate-blog
import type React from "react"

export interface GeneratedPostMeta {
  slug: string
  niche: string
  title: string
  description: string
  date: string
  readTime: number
  tags: string[]
  coverImage?: string
  author?: string
}

export const GENERATED_POSTS: GeneratedPostMeta[] = []

export const GENERATED_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {}
