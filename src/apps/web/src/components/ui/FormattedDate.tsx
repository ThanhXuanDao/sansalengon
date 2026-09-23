"use client"

import { useFormatDate } from "@/lib/currency-context"

export default function FormattedDate({
  date,
  className,
}: {
  date: string | Date | null | undefined
  className?: string
}) {
  const formatDate = useFormatDate()
  return <span className={className}>{formatDate(date)}</span>
}
