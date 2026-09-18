"use client"

import Image from "next/image"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Search, Copy, Pencil, Trash2, ImageIcon } from "lucide-react"
import { Star, AlertTriangle } from "lucide-react"
import { fetchProducts, deleteProduct, updateProduct } from "@/lib/services/products"
import { useCategories } from "@/hooks/useCategories"
import { formatPrice } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Badge,
  ConfirmModal,
  useToast,
  AdminFilterBar,
  FilterSelect,
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTablePagination,
  ProductFormModal,
} from "@/components/admin/ui"
import type { TableColumn, SortState } from "@/components/admin/ui"
import type { Product } from "@/types"

type ProductWithClicks = Product & { _count?: { clicks: number } }

const FEATURED_OPTIONS = [
  { value: "all",      label: "Tất cả" },
  { value: "featured", label: "Nổi bật" },
  { value: "normal",   label: "Bình thường" },
]

const SOLDOUT_OPTIONS = [
  { value: "all",     label: "Tất cả" },
  { value: "instock", label: "Còn hàng" },
  { value: "soldout", label: "Hết hàng" },
]

const SOURCE_OPTIONS = [
  { value: "all",         label: "Tất cả nguồn" },
  { value: "tiki",        label: "Tiki" },
  { value: "shopee",      label: "Shopee" },
  { value: "accesstrade", label: "AccessTrade" },
  { value: "lazada",      label: "Lazada" },
]

const SOURCE_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  tiki:        { label: "Tiki",        bg: "bg-[#e3f2fd]", text: "text-[#0d5cb6]", border: "border-[#0d5cb6]/20" },
  shopee:      { label: "Shopee",      bg: "bg-[#fff3e0]", text: "text-[#c05800]", border: "border-[#c05800]/20" },
  accesstrade: { label: "AccessTrade", bg: "bg-[#f3e8ff]", text: "text-[#7c3aed]", border: "border-[#7c3aed]/20" },
  lazada:      { label: "Lazada",      bg: "bg-[#e8f5e9]", text: "text-[#1a6b3c]", border: "border-[#1a6b3c]/20" },
}

function SourceBadge({ source }: { source: string }) {
  const s = SOURCE_STYLE[source] ?? { label: source, bg: "bg-[#f4f4f1]", text: "text-[#5c403a]", border: "border-[#e5e1d8]" }
  return (
    <span className={`inline-block px-2 py-0.5 font-mono text-[10px] border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  )
}

const COLUMNS: TableColumn[] = [
  { key: "number",   label: "#",         width: "56px" },
  { key: "name",     label: "Sản phẩm" },
  { key: "source",   label: "Nguồn",    align: "center", width: "110px" },
  { key: "category", label: "Danh mục" },
  { key: "price",    label: "Giá",      align: "right",  sortable: true },
  { key: "rating",   label: "Rating",   align: "center", sortable: true },
  { key: "clicks",   label: "Clicks",   align: "right" },
  { key: "featured", label: "Nổi bật",  align: "center" },
  { key: "soldout",  label: "Tồn kho",  align: "center" },
  { key: "actions",  label: "Thao tác", align: "right",  width: "100px" },
]

const SORT_MAP: Record<string, { asc: string; desc: string }> = {
  price:  { asc: "price_asc",  desc: "price_desc" },
  rating: { asc: "rating_asc", desc: "rating_desc" },
}

export default function AdminProducts() {
  const { success, error: toastError } = useToast()
  const { data: dbCategories } = useCategories()

  const [search, setSearch]     = useState("")
  const [category, setCategory] = useState("semua")
  const [featured, setFeatured] = useState("all")
  const [soldout, setSoldout]   = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [tableSort, setTableSort] = useState<SortState | undefined>(undefined)

  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)

  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const [createOpen, setCreateOpen]       = useState(false)
  const [editProductId, setEditProductId] = useState<string | undefined>(undefined)

  const categoryOptions = useMemo(() => {
    const base = [{ value: "semua", label: "Tất cả danh mục" }]
    if (dbCategories) {
      for (const cat of dbCategories) base.push({ value: cat.slug, label: cat.name })
    }
    return base
  }, [dbCategories])

  const effectiveSort = tableSort
    ? (tableSort.dir === "asc" ? SORT_MAP[tableSort.key]?.asc : SORT_MAP[tableSort.key]?.desc) ?? "newest"
    : "newest"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const result = await fetchProducts(
        category === "semua" ? undefined : category,
        effectiveSort,
        skip,
        pageSize,
        undefined,
        undefined,
        search || undefined,
      )
      setProducts(result.data)
      setTotal(result.total)
    } catch {
      setProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [category, effectiveSort, page, pageSize, search])

  useEffect(() => { load() }, [load])

  // Client-side featured / soldout filters (API doesn't expose these params)
  const filtered = useMemo(() => {
    let result = products
    if (featured === "featured")    result = result.filter((p) => p.isFeatured)
    if (featured === "normal")      result = result.filter((p) => !p.isFeatured)
    if (soldout === "soldout")      result = result.filter((p) => p.isSoldOut)
    if (soldout === "instock")      result = result.filter((p) => !p.isSoldOut)
    if (sourceFilter !== "all")     result = result.filter((p) => p.source === sourceFilter)
    return result
  }, [products, featured, soldout, sourceFilter])

  const handleSearch = () => { setPage(1); load() }

  const handleSort = (key: string) => {
    if (!SORT_MAP[key]) return
    setTableSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      return { key, dir: "desc" }
    })
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProduct(deleteTarget.id)
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setTotal((t) => t - 1)
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
        productUrl: product.productUrl,
        categoryId: product.categoryId,
        isFeatured: product.isFeatured,
        isSoldOut: !product.isSoldOut,
      })
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, isSoldOut: updated.isSoldOut } : p)))
    } catch {
      toastError("Không thể cập nhật trạng thái")
    }
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
      <AdminPageShell
        title="Sản phẩm"
        subtitle="Quản lý sản phẩm và liên kết affiliate."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            Thêm sản phẩm
          </Button>
        }
      />

      <AdminFilterBar
        search={{
          value: search,
          onChange: (v) => { setSearch(v); setPage(1) },
          placeholder: "Tên sản phẩm, ID...",
          id: "products-search",
        }}
        filters={
          <>
            <FilterSelect
              label="Danh mục"
              value={category}
              onChange={(v) => { setCategory(v); setPage(1) }}
              options={categoryOptions}
              id="filter-category"
            />
            <FilterSelect
              label="Nổi bật"
              value={featured}
              onChange={(v) => { setFeatured(v); setPage(1) }}
              options={FEATURED_OPTIONS}
              id="filter-featured"
            />
            <FilterSelect
              label="Tồn kho"
              value={soldout}
              onChange={(v) => { setSoldout(v); setPage(1) }}
              options={SOLDOUT_OPTIONS}
              id="filter-soldout"
            />
            <FilterSelect
              label="Nguồn"
              value={sourceFilter}
              onChange={(v) => { setSourceFilter(v); setPage(1) }}
              options={SOURCE_OPTIONS}
              id="filter-source"
            />
          </>
        }
        actions={
          <Button variant="secondary" icon={Search} onClick={handleSearch}>
            Tìm
          </Button>
        }
      />

      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && filtered.length === 0}
        emptyIcon={Search}
        emptyTitle="Không tìm thấy sản phẩm"
        emptyDescription="Thử điều chỉnh bộ lọc hoặc từ khoá tìm kiếm."
        sort={tableSort}
        onSort={handleSort}
      >
        {filtered.map((product) => (
          <DataTableRow key={product.id}>
            {/* # */}
            <DataTableCell>
              <span className="font-mono text-[13px] text-[#5c403a]">#{product.number}</span>
            </DataTableCell>

            {/* Sản phẩm */}
            <DataTableCell>
              <div className="flex items-center gap-3">
                <div className="relative size-10 shrink-0 bg-[#e2e3e0] overflow-hidden clip-bevel-sm">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.imageAlt || product.name}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="size-4 text-[#5c403a]/40" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-[14px] text-[#1a1c1b] truncate max-w-[240px]">{product.name}</p>
                  <p className="font-mono text-[11px] text-[#5c403a] mt-0.5">ID: {product.id.slice(0, 8)}…</p>
                </div>
              </div>
            </DataTableCell>

            {/* Nguồn */}
            <DataTableCell align="center">
              <SourceBadge source={product.source} />
            </DataTableCell>

            {/* Danh mục */}
            <DataTableCell>
              <span className="font-sans text-[14px] text-[#1a1c1b]">
                {product.category?.name || <span className="text-[#906f69]">Chưa phân loại</span>}
              </span>
            </DataTableCell>

            {/* Giá */}
            <DataTableCell align="right">
              <span className="font-mono text-[13px] font-bold text-[#1a1c1b] bg-[#FFC93C] px-2 py-0.5 tabular-nums">
                {formatPrice(product.price)}
              </span>
            </DataTableCell>

            {/* Rating */}
            <DataTableCell align="center">
              {product.rating > 0 ? (
                <div className="flex items-center justify-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`size-3 ${s <= product.rating ? "text-[#f59e0b] fill-[#f59e0b]" : "text-[#e2e3e0]"}`} aria-hidden="true" />
                  ))}
                </div>
              ) : (
                <span className="font-mono text-[11px] text-[#906f69]">—</span>
              )}
            </DataTableCell>

            {/* Clicks */}
            <DataTableCell align="right">
              <span className="font-mono text-[13px] tabular-nums text-[#1a1c1b]">
                {(product as ProductWithClicks)._count?.clicks ?? 0}
              </span>
            </DataTableCell>

            {/* Nổi bật */}
            <DataTableCell align="center">
              <Badge tone={product.isFeatured ? "green" : "gray"}>
                {product.isFeatured ? "Nổi bật" : "Bình thường"}
              </Badge>
            </DataTableCell>

            {/* Tồn kho */}
            <DataTableCell align="center">
              <label className="flex items-center gap-1.5 cursor-pointer justify-center">
                <input
                  type="checkbox"
                  checked={product.isSoldOut}
                  onChange={() => handleToggleSoldOut(product)}
                  className="sr-only peer"
                />
                <div className="relative w-8 h-4 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[0.5px] after:left-[0.5px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#ba1a1a]" />
                <span className="font-mono text-[10px] uppercase text-[#5c403a]">
                  {product.isSoldOut ? "Hết hàng" : "Còn hàng"}
                </span>
              </label>
            </DataTableCell>

            {/* Thao tác */}
            <DataTableCell align="right">
              <div className="flex items-center justify-end gap-0.5">
                <Button variant="ghost" size="sm" icon={Copy}   onClick={() => handleCopyLink(product.productUrl)} aria-label="Sao chép liên kết" />
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditProductId(product.id)} aria-label="Sửa" />
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteTarget(product)} aria-label="Xóa" className="hover:text-[#ba1a1a] hover:bg-[#ffdad6]/20" />
              </div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      <DataTablePagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        label="sản phẩm"
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa sản phẩm"
        icon={AlertTriangle}
        message={`Bạn có chắc muốn xóa "${deleteTarget?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        confirmIcon={Trash2}
        danger
        loading={deleting}
      />

      <ProductFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { load() }}
      />

      <ProductFormModal
        open={Boolean(editProductId)}
        onClose={() => setEditProductId(undefined)}
        productId={editProductId}
        onSaved={(updated) => {
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
        }}
      />
    </div>
  )
}
