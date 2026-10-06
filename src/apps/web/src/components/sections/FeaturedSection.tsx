"use client"

import { motion, useReducedMotion } from "framer-motion"
import ProductCard from "./ProductCard"
import ProductCardSkeleton from "@/components/ui/ProductCardSkeleton"
import type { Product } from "@/types"
import { useCouponCounts } from "@/hooks/useCouponCounts"

interface FeaturedSectionProps {
  products?: Product[]
  isLoading?: boolean
  onBuyProduct?: (productId: string) => void
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
}

export default function FeaturedSection({ products = [], isLoading, onBuyProduct }: FeaturedSectionProps) {
  const prefersReducedMotion = useReducedMotion()
  const couponCounts = useCouponCounts()

  if (!isLoading && products.length === 0) return null

  return (
    <div className="w-full bg-white isolate">
      <div className="max-w-[1320px] mx-auto px-3 py-8">
        {!isLoading && (
          <div className="mb-4 pb-4">
            <h2 className="font-sans font-extrabold text-lg text-ink tracking-tight">
              🔥 Đề xuất hôm nay
            </h2>
            <p className="font-mono text-xs text-ink/50 mt-0.5">
              Những sản phẩm đang giảm giá nhiều nhất, được chọn lọc mỗi ngày
            </p>
          </div>
        )}

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
          variants={prefersReducedMotion ? undefined : containerVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "visible"}
        >
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={`s-feat-${i}`} />)
            : products.map((product, i) => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} onBuy={onBuyProduct} couponCount={couponCounts[product.source] ?? 0} priority={i < 5} />
                </motion.div>
              ))}
        </motion.div>
      </div>
    </div>
  )
}
