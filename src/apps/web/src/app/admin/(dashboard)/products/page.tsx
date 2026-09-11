"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Plus, Search, Copy, Pencil, Trash2, SortAsc, LayoutGrid } from "lucide-react"
import { Star } from "lucide-react"
import CategoryIcon from "@/components/ui/CategoryIcon"
import { fetchProducts, deleteProduct, updateProduct } from "@/lib/services/products"
import { useCategories } from "@/hooks/useCategories"
import { formatPrice } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Badge,
  Pagination,
  PageSpinner,
  EmptyState,
  ConfirmModal,
  useToast,
} from "@/components/admin/ui"
import type { Product } from "@/types"

type ProductWithClicks = Product & { _count?: { clicks: number } }

export default function AdminProducts() {
  const { success, error: toastError } = useToast()
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
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProduct(deleteTarget.id)
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      success(`Đã xóa "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch {
      toastError("Không thể xóa sản phẩm")
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    success("Đã sao chép liên kết")
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
      toastError("Không thể cập nhật trạng thái")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Sản phẩm"
        subtitle="Quản lý sản phẩm và liên kết affiliate."
        actions={
          <Button variant="primary" icon={Plus} as={Link} href="/admin/products/new">
            Thêm sản phẩm
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-[#e5e1d8] p-4">
        <div className="w-full sm:hidden relative flex items-center">
          <Search className="size-5 absolute left-3 text-[#5c403a]" aria-hidden="true" />
          <input
            id="admin-products-search"
            name="q"
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Tìm sản phẩm..."
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
          <Button
            variant="ghost"
            icon={SortAsc}
            onClick={() => setSort(sort === "newest" ? "price_asc" : "newest")}
          >
            {sort === "newest" ? "Mới nhất" : "Giá"}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-[#f4f4f1]/50">
              {["#", "Sản phẩm", "Danh mục", "Giá", "Rating", "Hoa hồng", "Clicks", "Trạng thái", "Thao tác"].map((h) => (
                <th
                  key={h}
                  className={`py-4 px-6 font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] font-bold uppercase ${
                    h === "Giá" || h === "Clicks" || h === "Thao tác" ? "text-right" : h === "Trạng thái" ? "text-center" : ""
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
                <td colSpan={9} className="py-16">
                  <PageSpinner />
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4">
                  <EmptyState
                    icon={Search}
                    title="Không tìm thấy sản phẩm"
                    description="Thử điều chỉnh tìm kiếm hoặc bộ lọc."
                  />
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
                  <span className="font-sans text-[16px] leading-[24px] text-[#1a1c1b]">{product.category?.name || "Chưa phân loại"}</span>
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
                    <Badge tone={product.isFeatured ? "green" : "gray"}>
                      {product.isFeatured ? "Nổi bật" : "Thường"}
                    </Badge>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.isSoldOut}
                        onChange={() => handleToggleSoldOut(product)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[0.5px] after:left-[0.5px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#ba1a1a] relative" />
                      <span className="font-mono text-[10px] uppercase text-[#5c403a]">{product.isSoldOut ? "Hết hàng" : "Còn hàng"}</span>
                    </label>
                  </div>
                </td>
                <td className="py-4 px-6 align-middle text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Copy}
                      onClick={() => handleCopyLink(product.shopeeUrl)}
                      aria-label="Sao chép liên kết"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Pencil}
                      as={Link}
                      href={`/admin/products/${product.id}`}
                      aria-label="Sửa sản phẩm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setDeleteTarget(product)}
                      aria-label="Xóa sản phẩm"
                      className="hover:text-[#ba1a1a] hover:bg-[#ffdad6]/20"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        total={filtered.length}
        pageSize={pageSize}
        onChange={setPage}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa sản phẩm"
        message={`Bạn có chắc muốn xóa "${deleteTarget?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
      />
    </div>
  )
}
