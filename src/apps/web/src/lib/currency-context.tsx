"use client"

import { createContext, useContext } from "react"
import { formatPrice, formatDate } from "@/lib/utils"

interface FormatOpts {
  currencySymbol: string
  currencyPosition: string
  thousandSeparator: string
  dateFormat: string
}

const defaultOpts: FormatOpts = {
  currencySymbol: "₫",
  currencyPosition: "after",
  thousandSeparator: ".",
  dateFormat: "DD/MM/YYYY",
}

const FormatContext = createContext<FormatOpts>(defaultOpts)

export function CurrencyProvider({
  opts,
  children,
}: {
  opts: Partial<FormatOpts>
  children: React.ReactNode
}) {
  return <FormatContext.Provider value={{ ...defaultOpts, ...opts }}>{children}</FormatContext.Provider>
}

export function useFormatPrice(): (price: number | null | undefined) => string {
  const opts = useContext(FormatContext)
  return (price) => (price == null ? "" : formatPrice(price, opts))
}

export function useFormatDate(): (date: Date | string | null | undefined) => string {
  const { dateFormat } = useContext(FormatContext)
  return (date) => formatDate(date, dateFormat)
}
