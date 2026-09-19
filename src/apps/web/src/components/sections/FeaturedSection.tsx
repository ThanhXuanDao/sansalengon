"use client"

import { motion, useReducedMotion } from "framer-motion"
import ProductCard from "./ProductCard"
import ProductCardSkeleton from "@/components/ui/ProductCardSkeleton"
import type { Product } from "@/types"

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

  return (
    <div className="w-full bg-white">
      <div className="max-w-[1320px] mx-auto px-3 py-8">
        <div className="mb-4 pb-4">
          <h2 className="font-sans font-extrabold text-lg text-ink tracking-tight">
            🔥 Đề xuất hôm nay
          </h2>
          <p className="font-mono text-xs text-ink/50 mt-0.5">
            Những sản phẩm đang giảm giá nhiều nhất, được chọn lọc mỗi ngày
          </p>
        </div>

        {/* Desktop: 3-col grid */}
        <motion.div
          className="hidden md:grid grid-cols-3 gap-6"
          variants={prefersReducedMotion ? undefined : containerVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "visible"}
        >
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <ProductCardSkeleton key={`s-feat-${i}`} />)
            : products.map((product) => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} onBuy={onBuyProduct} />
                </motion.div>
              ))}
        </motion.div>

        {/* Mobile: horizontal scroll strip */}
        <div className="md:hidden -mx-3">
          {isLoading ? (
            <div className="flex gap-3 px-3 overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`s-feat-m-${i}`} className="shrink-0 w-44">
                  <ProductCardSkeleton />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 px-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              {products.map((product) => (
                <div key={product.id} className="shrink-0 w-44 snap-start">
                  <ProductCard product={product} onBuy={onBuyProduct} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
