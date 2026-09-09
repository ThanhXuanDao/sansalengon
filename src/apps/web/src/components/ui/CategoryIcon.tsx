import {
  LayoutGrid, Laptop, Shirt, Home, Sparkles, BookOpen, Music, Gamepad2,
  Smartphone, Car, Tv, UtensilsCrossed, Dumbbell, Backpack, Gem, Wrench,
  ShoppingBag, Baby, Dog, Cat, Palette, Heart, Star, Globe, Camera,
  Headphones, Watch, Monitor, Package, type LucideIcon,
} from "lucide-react"

const iconRegistry: Record<string, LucideIcon> = {
  LayoutGrid, Laptop, Shirt, Home, Sparkles, BookOpen, Music, Gamepad2,
  Smartphone, Car, Tv, UtensilsCrossed, Dumbbell, Backpack, Gem, Wrench,
  ShoppingBag, Baby, Dog, Cat, Palette, Heart, Star, Globe, Camera,
  Headphones, Watch, Monitor, Package,
}

export const CATEGORY_ICONS = Object.keys(iconRegistry).sort()

interface CategoryIconProps {
  icon?: string | null
  className?: string
  "aria-hidden"?: "true" | "false"
}

export default function CategoryIcon({ icon, className, ...props }: CategoryIconProps) {
  if (!icon) icon = "LayoutGrid"
  const Icon = iconRegistry[icon]
  if (!Icon) return <LayoutGrid className={className} aria-hidden="true" />
  return <Icon className={className} aria-hidden="true" />
}
