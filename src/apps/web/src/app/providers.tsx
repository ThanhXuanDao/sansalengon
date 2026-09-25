"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { CurrencyProvider } from "@/lib/currency-context"
import NavigationProgress from "@/components/ui/NavigationProgress"

interface ProvidersProps {
  children: React.ReactNode
  currencySymbol?: string
  currencyPosition?: string
  thousandSeparator?: string
  dateFormat?: string
}

export default function Providers({
  children,
  currencySymbol = "₫",
  currencyPosition = "after",
  thousandSeparator = ".",
  dateFormat = "DD/MM/YYYY",
}: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider opts={{ currencySymbol, currencyPosition, thousandSeparator, dateFormat }}>
        <NavigationProgress />
        {children}
      </CurrencyProvider>
    </QueryClientProvider>
  )
}
