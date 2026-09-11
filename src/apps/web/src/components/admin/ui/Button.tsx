import { forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactNode, type ElementType, type ComponentPropsWithRef } from "react"
import { Loader2 } from "lucide-react"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

type ButtonOwnProps<E extends ElementType = "button"> = {
  as?: E
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ElementType | ReactNode
  iconRight?: ElementType | ReactNode
}

type ButtonProps<E extends ElementType = "button"> = ButtonOwnProps<E> &
  Omit<ComponentPropsWithRef<E>, keyof ButtonOwnProps<E>>

const base =
  "inline-flex items-center justify-center gap-2 font-mono font-bold tracking-[0.03em] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"

const variants: Record<Variant, string> = {
  primary:   "bg-[#b51c00] text-white hover:bg-[#8b1500] active:translate-x-px active:translate-y-px",
  secondary: "border border-[#e5beb6] bg-white text-[#1a1c1b] hover:bg-[#f4f4f1]",
  ghost:     "text-[#5c403a] hover:bg-[#f4f4f1]",
  danger:    "bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/30 hover:bg-[#ffb4ab]",
}

const sizes: Record<Size, string> = {
  sm: "text-[11px] px-3 py-1.5",
  md: "text-[13px] px-4 py-2",
  lg: "text-[14px] px-5 py-2.5",
}

function renderIcon(icon: ElementType | ReactNode, cls = "size-3.5") {
  if (!icon) return null
  if (isValidElement(icon)) return icon
  if (typeof icon === "function" || typeof icon === "object") {
    const Icon = icon as ElementType
    return <Icon className={cls} />
  }
  return icon as ReactNode
}

export const Button = forwardRef(function Button<E extends ElementType = "button">(
  { as, variant = "primary", size = "md", loading, icon, iconRight, children, disabled, className = "", ...props }:
    ButtonOwnProps<E> & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps<E>>,
  ref: React.Ref<HTMLButtonElement>
) {
  const Tag = (as ?? "button") as ElementType
  return (
    <Tag
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : renderIcon(icon)}
      {children}
      {!loading && renderIcon(iconRight)}
    </Tag>
  )
}) as <E extends ElementType = "button">(props: ButtonProps<E>) => React.ReactElement | null

;(Button as { displayName?: string }).displayName = "Button"
