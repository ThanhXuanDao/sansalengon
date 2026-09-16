"use client"

import { createContext, useContext } from "react"
import type { NicheConfig } from "./niches"

const NicheContext = createContext<NicheConfig[]>([])

export function NicheProvider({ niches, children }: { niches: NicheConfig[]; children: React.ReactNode }) {
  return <NicheContext.Provider value={niches}>{children}</NicheContext.Provider>
}

export function useNiches(): NicheConfig[] {
  return useContext(NicheContext)
}

export function useNiche(id: string): NicheConfig | undefined {
  return useContext(NicheContext).find((n) => n.id === id)
}

export function useNicheByCategory(categorySlug: string): NicheConfig | undefined {
  return useContext(NicheContext).find((n) => n.categorySlug === categorySlug)
}
