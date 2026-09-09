"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Plus,
  Search,
  Copy,
  Pencil,
  Trash2,
  SortAsc,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from "lucide-react"
import { Star } from "lucide-react"
import CategoryIcon from "@/components/ui/CategoryIcon"
import { fetchProducts, deleteProduct, updateProduct } from "@/lib/services/products"
import { useCategories } from "@/hooks/useCategories"
import { formatPrice } from "@/lib/utils"
import type { Product, Category } from "@/types"

type ProductWithClicks = Product & { _count?: { clicks: number } }

export default function AdminProducts() {
  const searchParams = useSearchParams()
  const [activeCategory, setActiveCategory] = useState("semua")
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const paramsQ = searchParams.get("q") || ""
  if (paramsQ && paramsQ !== searchQuery) {
    setSearchQuery(paramsQ)
  }
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sort, setSort] = useState("newest")

  const { data: dbCategories } = useCategories()
  const categories = useMemo(() => {
    const all: { slug: string; name: string; icon: React.ReactNode }[] = [
      { slug: "semua", name: "All", icon: <LayoutGrid className="size-3" aria-hidden="true" /> },
    ]
    if (dbCategories) {
      for (const cat of dbCategories) {
        all.push({ slug: cat.slug, name: cat.name, icon: <CategoryIcon icon={cat.icon} className="size-3" /> })
      }
    }
    return all
  }, [dbCategories])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const result = await fetchProducts(
          activeCategory === "semua" ? undefined : activeCategory,
          sort
        )
        setProducts(result.data)
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [activeCategory, sort])

  const filtered = searchQuery
    ? products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return
    try {
      await deleteProduct(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch {
      alert("Failed to delete product")
    }
  }

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url)
  }

  const handleToggleSoldOut = async (product: Product) => {
    try {
      const updated = await updateProduct(product.id, {
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        shopeeUrl: product.shopeeUrl,
        categoryId: product.categoryId,
        isFeatured: product.isFeatured,
        isSoldOut: !product.isSoldOut,
      })
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isSoldOut: updated.isSoldOut } : p))
      )
    } catch {
      alert("Failed to update product")
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-[#1a1c1b]">
            Product Links
          </h2>
          <p className="font-sans text-[16px] leading-[24px] text-[#5c403a] mt-1">
            Manage your active affiliate links and track commission rates.
          </p>
        </div>
        <Link
          href="/admin-shopby/products/new"
          className="bg-[#b51c00] text-white font-mono text-[13px] leading-[16px] tracking-[0.05em] py-3 px-6 rounded-full flex items-center justify-center gap-2 shrink-0 hover:shadow-lg transition-all active:translate-x-0.5 active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
        >
          <Plus className="size-[18px]" aria-hidden="true" />
          Add New Link
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#e5e1d8] p-4">
        <div className="w-full sm:hidden relative flex items-center">
          <Search className="size-5 absolute left-3 text-[#5c403a]" aria-hidden="true" />
          <input
            id="admin-products-search"
            name="q"
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full bg-transparent border-0 border-b border-[#e5beb6] focus:border-[#b51c00] focus:ring-0 pl-10 pr-4 py-2 font-sans text-[16px] text-[#1a1c1b] placeholder:text-[#5c403a]/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {categories.map((cat) => {
            const isActive = cat.slug === activeCategory
            return (
              <button
                key={cat.slug}
                onClick={() => { setActiveCategory(cat.slug); setPage(1) }}
                className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-mono text-[11px] whitespace-nowrap transition-all active:translate-y-0.5 active:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                  isActive
                    ? "bg-[#1a1c1b] text-[#FAFAF7]"
                    : "border border-[#e5e1d8] text-[#1a1c1b] hover:bg-[#f4f4f1]"
                }`}
              >
                {cat.icon}
                {cat.name}
              </button>
            )
          })}
        </div>

        <div className="w-full sm:w-auto flex justify-end">
          <button onClick={() => setSort(sort === "newest" ? "price_asc" : "newest")} className="flex items-center gap-2 text-[#5c403a] hover:text-[#1a1c1b] font-mono text-[13px] leading-[16px] tracking-[0.05em] p-2 rounded hover:bg-[#f4f4f1] transition-colors">
            <SortAsc className="size-[18px]" aria-hidden="true" />
            Sort: {sort === "newest" ? "Newest" : "Price"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-[#f4f4f1]/50">
              {["#", "Product", "Category", "Price", "Rating", "Komisi", "Clicks", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  className={`py-4 px-6 font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] font-bold uppercase ${
                    h === "Price" || h === "Clicks" || h === "Actions" ? "text-right" : h === "Status" ? "text-center" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-[#e5e1d8]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12" aria-busy="true">
                  <div className="animate-pulse space-y-3 max-w-md mx-auto">
                    <div className="h-4 bg-[#e2e3e0] rounded" />
                    <div className="h-4 bg-[#e2e3e0] rounded w-3/4 mx-auto" />
                    <div className="h-4 bg-[#e2e3e0] rounded w-1/2 mx-auto" />
                  </div>
                  <p className="font-mono text-[13px] text-[#5c403a] mt-4">Loading…</p>
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 font-mono text-[13px] text-[#5c403a]">
                  <div role="status">
                    <p className="font-mono text-[13px] text-[#5c403a]">No products found</p>
                    <p className="font-mono text-[11px] text-[#906f69] mt-2">Try adjusting your search or filter to find what you&apos;re looking for.</p>
                  </div>
                </td>
              </tr>
            ) : paginated.map((product) => (
              <tr key={product.id} className="group hover:bg-[#FAFAF7] transition-colors border-b border-dashed border-[#e5e1d8]">
                <td className="py-4 px-6 align-middle">
                  <span className="font-mono text-[13px] text-[#5c403a]">#{product.number}</span>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="relative size-12 bg-[#e2e3e0] shrink-0 flex items-center justify-center font-mono text-xs text-[#5c403a] overflow-hidden"
                      style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    >
                      {product.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-sans text-[16px] leading-[24px] font-bold text-[#1a1c1b]">{product.name}</p>
                      <p className="font-mono text-[11px] text-[#5c403a] mt-1">ID: {product.id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 align-middle">
                  <span className="font-sans text-[16px] leading-[24px] text-[#1a1c1b]">{product.category?.name || "Uncategorized"}</span>
                </td>
                <td className="py-4 px-6 align-middle text-right">
                  <span className="font-mono text-[16px] font-bold text-[#1a1c1b] bg-[#FFC93C] px-2 py-0.5">
                    {formatPrice(product.price)}
                  </span>
                </td>
                <td className="py-4 px-6 align-middle text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {product.rating > 0 ? (
                      [1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`size-3 ${s <= product.rating ? "text-[#f59e0b] fill-[#f59e0b]" : "text-[#e2e3e0]"}`} aria-hidden="true" />
                      ))
                    ) : (
                      <span className="font-mono text-[11px] text-[#906f69]">—</span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 align-middle text-right">
                  <span className="font-mono text-[16px] font-bold text-[#b51c00]">
                    {formatPrice(product.commission)}
                  </span>
                </td>
                <td className="py-4 px-6 align-middle text-right">
                  <span className="font-mono text-[16px] font-bold text-[#b51c00]">{(product as ProductWithClicks)._count?.clicks ?? 0}</span>
                </td>
                <td className="py-4 px-6 align-middle text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[11px] uppercase ${
                      product.isFeatured
                        ? "border-[#e5e1d8] bg-white text-[#1a1c1b]"
                        : "border-[#e5e1d8] bg-[#e2e3e0] text-[#5c403a]"
                    }`}>
                      <span className={`size-1.5 rounded-full ${product.isFeatured ? "bg-green-500" : "bg-[#906f69]"}`} />
                      {product.isFeatured ? "Featured" : "Standard"}
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.isSoldOut}
                        onChange={() => handleToggleSoldOut(product)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[0.5px] after:left-[0.5px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#ba1a1a] relative" />
                      <span className="font-mono text-[10px] uppercase text-[#5c403a]">{product.isSoldOut ? "Sold Out" : "Active"}</span>
                    </label>
                  </div>
                </td>
                <td className="py-4 px-6 align-middle text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleCopyLink(product.shopeeUrl)} className="p-1.5 text-[#5c403a] hover:text-[#1a1c1b] hover:bg-[#f4f4f1] rounded transition-colors active:scale-90" aria-label="Copy link">
                      <Copy className="size-5" aria-hidden="true" />
                    </button>
                    <Link href={`/admin-shopby/products/${product.id}`} className="p-1.5 text-[#5c403a] hover:text-[#1a1c1b] hover:bg-[#f4f4f1] rounded transition-colors active:scale-90" aria-label="Edit product">
                      <Pencil className="size-5" aria-hidden="true" />
                    </Link>
                    <button onClick={() => handleDelete(product.id)} className="p-1.5 text-[#5c403a] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/20 rounded transition-colors active:scale-90" aria-label="Delete product">
                      <Trash2 className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between py-4 font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] border-t border-dashed border-[#e5e1d8] mt-4">
        <p>Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}-{Math.min(page * pageSize, filtered.length)} of {filtered.length} items</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1 hover:text-[#1a1c1b] disabled:opacity-50 transition-colors" aria-label="Previous page">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`size-6 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${page === p ? "bg-[#1a1c1b] text-[#FAFAF7]" : "hover:bg-[#f4f4f1]"}`}
            >
              {p}
            </button>
          ))}
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || totalPages === 0} className="p-1 hover:text-[#1a1c1b] disabled:opacity-50 transition-colors" aria-label="Next page">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}


