"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import CategoryIcon, { CATEGORY_ICONS } from "@/components/ui/CategoryIcon"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Alert,
  Spinner,
  EmptyState,
  Input,
  Select,
  Modal,
  ConfirmModal,
  useToast,
} from "@/components/admin/ui"

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
}

export default function AdminCategories() {
  const { success, error: toastError } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formIcon, setFormIcon] = useState("LayoutGrid")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        const slug = formSlug.trim() || formName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
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
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Danh mục"
        subtitle="Quản lý danh mục sản phẩm."
        actions={
          <Button variant="primary" icon={Plus} onClick={handleNew}>
            Thêm danh mục
          </Button>
        }
      />

      {fetchError && <Alert tone="error">{fetchError}</Alert>}

      {/* Table */}
      <div className="bg-white border border-[#e5e1d8] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Chưa có danh mục nào"
            description="Tạo danh mục đầu tiên để bắt đầu phân loại sản phẩm."
            action={<Button variant="primary" icon={Plus} onClick={handleNew}>Thêm danh mục</Button>}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-dashed border-[#e5e1d8] bg-[#f4f4f1]">
                {["Icon", "Tên", "Slug", "Thao tác"].map((h) => (
                  <th key={h} className="py-3 px-6 text-left font-mono text-[12px] leading-[16px] tracking-[0.05em] text-[#5c403a] uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-dashed border-[#e5e1d8] hover:bg-[#f4f4f1]/50 transition-colors">
                  <td className="py-4 px-6">
                    <CategoryIcon icon={cat.icon} className="size-5 text-[#1a1c1b]" />
                  </td>
                  <td className="py-4 px-6 font-sans text-[16px] font-bold text-[#1a1c1b]">{cat.name}</td>
                  <td className="py-4 px-6 font-mono text-[13px] text-[#906f69]">/category/{cat.slug}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={handleCloseForm}
        title={editingId ? "Sửa danh mục" : "Thêm danh mục"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseForm} disabled={saving}>Hủy</Button>
            <Button variant="primary" onClick={handleSave} loading={saving} disabled={!formName.trim()}>
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
              <option key={name} value={name}>{name}</option>
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
