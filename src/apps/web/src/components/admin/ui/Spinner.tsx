import { Loader2 } from "lucide-react"

interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = { sm: "size-4", md: "size-6", lg: "size-8" }

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return <Loader2 className={`animate-spin text-[#5c403a] ${sizes[size]} ${className}`} />
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size="lg" />
    </div>
  )
}
