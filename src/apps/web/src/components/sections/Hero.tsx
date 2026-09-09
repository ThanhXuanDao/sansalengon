"use client"

import Image from "next/image"
import { ArrowRight } from "lucide-react"
import type { Product } from "@/types"
import { GalleryGrid, GalleryGridCell } from "@/components/blocks/cta-section-with-gallery"

interface HeroProps {
  featuredProducts?: Product[]
  onBuyProduct?: (productId: string, shopeeUrl: string) => void
  isFeaturedLoading?: boolean
  storeName?: string
  tagline?: string
}

const defaultFeatured: Product[] = [
  {
    id: "3",
    name: "Smart Home Security Camera",
    price: 280000,
    commission: 0,
    rating: 4.9,
    discountPct: null,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAStz6MWdhJ1zh4c0FwFqadWl6CZq5yq6-UlVR_qmFH3_loMLyyqbx3zne-khm5hPTJvfh1jA52Rnza1u51vuol1UW2bCTvHPHKqORb1UGD1RNbFG_MVh5A69rXC3IbEtRojtC9QmdCOivROrbCKT-ltHi0VDusfzZFZ263onsWtLZ8Kq0Em-IwzPQHBRdFNez08kHupdRaWZE1ZJY7to6Yaw_Fb-3xKMD806mIvw6va3dJeJvMrTegl9c3V-SVYZdaZlca2ZD5_Wc",
    imageAlt:
      "A modern minimalist mechanical keyboard on a pristine white desk setup, top-down view, sharp lighting, high contrast utilitarian aesthetic, highly detailed.",
    shopeeUrl: "#",
    categoryId: "cat1",
    category: { id: "cat1", name: "Elektronik", slug: "elektronik" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Wireless Earbuds ANC",
    price: 350000,
    commission: 0,
    rating: 4.5,
    discountPct: null,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAq3uVOfDHT35zefCDRgrqt2khWekMJD-uhSl5FzLgypPRdHepB2_ejWNHK7FJCA0zRbKqNm4IE_3qScrEx0KQ96sUDbjCmvhA5kryVfBw3OJltTCotP_W8vgbo-3JYrifB7rSWiOioLD-98KffR6uva4DWoA_nNdmcUaplsTn1ph53oD9lCo3xbgFvX21dBmBTmgewH6TWmU4G-ADl2QFPnXkGSbsOvC2zXHFkRLCyBaUhxbF7Sb8Vff8tYaOZbg9n-7gDWxfF4I",
    imageAlt:
      "A sleek minimalist stainless steel coffee tumbler on a concrete surface, dramatic lighting casting a hard shadow, brutalist industrial aesthetic, highly detailed.",
    shopeeUrl: "#",
    categoryId: "cat3",
    category: { id: "cat3", name: "Rumah Tangga", slug: "rumah-tangga" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "4",
    name: "Smartwatch Pro Max",
    price: 899000,
    commission: 0,
    rating: 4.7,
    discountPct: null,
    imageUrl:
      "https://images.unsplash.com/photo-1546868871-af0de0ae72b5?q=80&w=2487&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    imageAlt: "A modern smartwatch on a desk, sleek minimalist aesthetic.",
    shopeeUrl: "#",
    categoryId: "cat1",
    category: { id: "cat1", name: "Elektronik", slug: "elektronik" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "5",
    name: "Minimalist Desk Lamp",
    price: 180000,
    commission: 0,
    rating: 4.3,
    discountPct: null,
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2487&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    imageAlt: "A sleek desk lamp illuminating a workspace, warm lighting.",
    shopeeUrl: "#",
    categoryId: "cat3",
    category: { id: "cat3", name: "Rumah Tangga", slug: "rumah-tangga" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

export default function Hero({
  featuredProducts,
  onBuyProduct,
  isFeaturedLoading,
  storeName,
  tagline,
}: HeroProps) {
  const displayProducts = featuredProducts?.length ? featuredProducts : defaultFeatured
  const gridProducts = displayProducts.slice(0, 4)

  const handleCardClick = (productId: string, shopeeUrl: string) => {
    if (!onBuyProduct || shopeeUrl === "#") return
    onBuyProduct(productId, shopeeUrl)
  }

  return (
    <header className="pt-32 pb-20 px-4 md:px-8 max-w-[1200px] mx-auto w-full relative overflow-hidden">
      <div className="hero-scan-line" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6 z-10">
          <h1 className="font-sans text-display-lg-mobile md:text-display-lg text-ink leading-none uppercase text-pretty">
            {storeName || "Belanja Cerdas"},
            <br />
            Struk Berkualitas
          </h1>
          <p className="text-ink/60 max-w-md">
            {tagline || "Rekomendasi produk pilihan dari berbagai kategori. Terkurasi, terpercaya, harga transparan."}
          </p>
          <a href="#products" className="inline-block bg-primary text-ink px-8 py-4 font-bold rounded-full brutalist-shadow text-lg uppercase tracking-wider mt-4 focus-visible:ring-2 focus-visible:ring-primary">
            Lihat Semua Deal
          </a>
        </div>

        <div className="hidden md:block">
          {isFeaturedLoading ? (
            <GalleryGrid className="animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`relative overflow-hidden rounded-xl bg-[#e8e8e5] shadow-xl ${["col-start-2 col-end-3 row-start-1 row-end-3","col-start-1 col-end-2 row-start-2 row-end-4","col-start-1 col-end-2 row-start-4 row-end-6","col-start-2 col-end-3 row-start-3 row-end-5"][i]}`} />
              ))}
            </GalleryGrid>
          ) : (
            <GalleryGrid>
              {gridProducts.map((product, index) => (
                <GalleryGridCell key={product.id} index={index}>
                  <button
                    onClick={() => handleCardClick(product.id, product.shopeeUrl)}
                    className="group relative size-full cursor-pointer text-left overflow-hidden rounded-xl"
                    aria-label={`Lihat ${product.name}`}
                  >
                    <Image
                      src={product.imageUrl}
                      alt={product.imageAlt}
                      fill
                      loading={index < 2 ? "eager" : "lazy"}
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, 300px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <span className="font-mono text-[10px] uppercase text-white/70 tracking-wider">
                        {product.category.name}
                      </span>
                      <p className="font-sans text-sm font-bold text-white leading-tight mt-0.5 line-clamp-1">
                        {product.name}
                      </p>
                      <span className="font-mono text-xs text-white/90 mt-1 block">
                        Rp{(product.price / 1000).toFixed(0)}k
                      </span>
                    </div>
                    <ArrowRight className="absolute top-3 right-3 size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  </button>
                </GalleryGridCell>
              ))}
            </GalleryGrid>
          )}
        </div>
      </div>
    </header>
  )
}
