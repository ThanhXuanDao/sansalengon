"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Pencil, Trash2, Search, LayoutGrid } from "lucide-react"
import CategoryIcon, { CATEGORY_ICONS } from "@/components/ui/CategoryIcon"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Alert,
  Input,
  Select,
  Modal,
  ConfirmModal,
  useToast,
  AdminFilterBar,
  DataTable,
  DataTableRow,
  DataTableCell,
} from "@/components/admin/ui"
import type { TableColumn } from "@/components/admin/ui"

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
}

const COLUMNS: TableColumn[] = [
  { key: "icon",    label: "Icon",     width: "64px" },
  { key: "name",    label: "Tên" },
  { key: "slug",    label: "Slug" },
  { key: "actions", label: "Thao tác", align: "right", width: "100px" },
]

export default function AdminCategories() {
  const { success, error: toastError } = useToast()
  const [categories, setCategories]   = useState<Category[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [search, setSearch]           = useState("")

  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [formName, setFormName]       = useState("")
  const [formSlug, setFormSlug]       = useState("")
  const [formIcon, setFormIcon]       = useState("LayoutGrid")
  const [saving, setSaving]           = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch("/api/categories")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setCategories(json.data)
    } catch {
      setFetchError("Không thể tải danh mục. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    )
  }, [categories, search])

  function handleEdit(cat: Category) {
    setEditingId(cat.id)
    setFormName(cat.name)
    setFormSlug(cat.slug)
    setFormIcon(cat.icon || "LayoutGrid")
    setShowForm(true)
  }

  function handleNew() {
    setEditingId(null)
    setFormName("")
    setFormSlug("")
    setFormIcon("LayoutGrid")
    setShowForm(true)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingId(null)
    setFormName("")
    setFormSlug("")
  }

  async function handleSave() {
    if (!formName.trim()) return
    setSaving(true)
    try {
      const csrfToken = await ensureCsrfToken()
      if (editingId) {
        const res = await fetch("/api/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ id: editingId, name: formName.trim(), icon: formIcon }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to update")
        }
        success("Đã cập nhật danh mục")
      } else {
        const slug =
          formSlug.trim() ||
          formName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ name: formName.trim(), slug, icon: formIcon }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to create")
        }
        success("Đã thêm danh mục mới")
      }
      handleCloseForm()
      await fetchCategories()
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Thao tác thất bại")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch(`/api/categories?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete")
      }
      success(`Đã xóa danh mục "${deleteTarget.name}"`)
      setDeleteTarget(null)
      await fetchCategories()
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Xóa thất bại")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <AdminPageShell
        title="Danh mục"
        subtitle={`Quản lý danh mục sản phẩm. ${categories.length > 0 ? `${categories.length} danh mục.` : ""}`}
        actions={
          <Button variant="primary" icon={Plus} onClick={handleNew}>
            Thêm danh mục
          </Button>
        }
      />

      {fetchError && <Alert tone="error">{fetchError}</Alert>}

      <AdminFilterBar
        search={{
          value: search,
          onChange: (v) => setSearch(v),
          placeholder: "Tên hoặc slug...",
          id: "categories-search",
        }}
        actions={
          <Button variant="secondary" icon={Search} onClick={() => {}}>
            Tìm
          </Button>
        }
      />

      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && filtered.length === 0}
        emptyIcon={LayoutGrid}
        emptyTitle={search ? "Không tìm thấy danh mục" : "Chưa có danh mục nào"}
        emptyDescription={
          search
            ? "Thử tìm với từ khoá khác."
            : "Tạo danh mục đầu tiên để bắt đầu phân loại sản phẩm."
        }
      >
        {filtered.map((cat) => (
          <DataTableRow key={cat.id}>
            {/* Icon */}
            <DataTableCell>
              <CategoryIcon icon={cat.icon} className="size-5 text-[#1a1c1b]" />
            </DataTableCell>

            {/* Tên */}
            <DataTableCell>
              <span className="font-sans text-[14px] font-semibold text-[#1a1c1b]">
                {cat.name}
              </span>
            </DataTableCell>

            {/* Slug */}
            <DataTableCell>
              <span className="font-mono text-[12px] text-[#906f69]">/category/{cat.slug}</span>
            </DataTableCell>

            {/* Thao tác */}
            <DataTableCell align="right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Pencil}
                  onClick={() => handleEdit(cat)}
                  aria-label={`Sửa ${cat.name}`}
                />
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setDeleteTarget(cat)}
                  aria-label={`Xóa ${cat.name}`}
                />
              </div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={handleCloseForm}
        title={editingId ? "Sửa danh mục" : "Thêm danh mục"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseForm} disabled={saving}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!formName.trim()}
            >
              {editingId ? "Cập nhật" : "Thêm mới"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="TÊN DANH MỤC"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Tên danh mục"
            autoFocus
          />
          {!editingId && (
            <Input
              label="SLUG (TỰ ĐỘNG TẠO NẾU ĐỂ TRỐNG)"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              placeholder="auto-generated-from-name"
            />
          )}
          <Select
            label="ICON"
            value={formIcon}
            onChange={(e) => setFormIcon(e.target.value)}
          >
            {CATEGORY_ICONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2 pt-1">
            <CategoryIcon icon={formIcon} className="size-5 text-[#1a1c1b]" />
            <span className="font-mono text-[11px] text-[#906f69]">{formIcon}</span>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa danh mục"
        message={`Bạn có chắc muốn xóa danh mục "${deleteTarget?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
      />
    </div>
  )
}
