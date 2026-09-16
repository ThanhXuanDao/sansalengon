"use client"

import { createContext, useContext } from "react"
import { formatPrice } from "@/lib/utils"

interface CurrencyOpts {
  currencySymbol: string
  currencyPosition: string
  thousandSeparator: string
}

const defaultOpts: CurrencyOpts = {
  currencySymbol: "₫",
  currencyPosition: "after",
  thousandSeparator: ".",
}

const CurrencyContext = createContext<CurrencyOpts>(defaultOpts)

export function CurrencyProvider({
  opts,
  children,
}: {
  opts: CurrencyOpts
  children: React.ReactNode
}) {
  return <CurrencyContext.Provider value={opts}>{children}</CurrencyContext.Provider>
}

export function useFormatPrice(): (price: number) => string {
  const opts = useContext(CurrencyContext)
  return (price: number) => formatPrice(price, opts)
}
