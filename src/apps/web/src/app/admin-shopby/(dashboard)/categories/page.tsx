"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Loader2, X, Check, ChevronDown } from "lucide-react"
import CategoryIcon, { CATEGORY_ICONS } from "@/components/ui/CategoryIcon"
import { ensureCsrfToken } from "@/lib/utils"

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formIcon, setFormIcon] = useState("LayoutGrid")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/categories")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setCategories(json.data)
    } catch {
      setError("Failed to load categories")
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

  async function handleSave() {
    if (!formName.trim()) return
    setSaving(true)
    setError(null)
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
      }
      setShowForm(false)
      setEditingId(null)
      setFormName("")
      setFormSlug("")
      await fetchCategories()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this category?")) return
    setDeleting(id)
    setError(null)
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete")
      }
      await fetchCategories()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-[800px] mx-auto pb-24">
      <div className="flex items-center justify-between mb-8 border-b border-dashed border-[#e5beb6] pb-4">
        <div>
          <h2 className="font-sans text-[40px] leading-[48px] tracking-[-0.02em] font-extrabold text-[#1a1c1b] uppercase mb-2">
            Categories
          </h2>
          <p className="font-sans text-[16px] leading-[24px] text-[#5c403a]">
            Manage product categories.
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[13px] bg-[#FF4D2D] text-[#1a1c1b] border border-[#1a1c1b] font-bold hover:shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Category
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded border font-mono text-[13px] bg-red-50 border-red-200 text-red-800" role="alert">{error}</div>
      )}

      {showForm && (
        <div className="bg-white border border-[#e5e1d8] p-6 mb-8 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 size-6 bg-[#FAFAF7] rounded-full border border-[#e5e1d8]" />
          <h3 className="font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b] mb-6 border-b border-dashed border-[#e5beb6] pb-4">
            {editingId ? "Edit Category" : "New Category"}
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="catName" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Name</label>
              <input
                id="catName"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
                placeholder="Category name"
                autoFocus
              />
            </div>
            {!editingId && (
              <div>
                <label htmlFor="catSlug" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Slug (URL path)</label>
                <input
                  id="catSlug"
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[13px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
                  placeholder="auto-generated from name"
                />
              </div>
            )}
            <div>
              <label htmlFor="catIcon" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Icon</label>
              <div className="relative">
                <select
                  id="catIcon"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[13px] text-[#1a1c1b] appearance-none pr-8 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
                >
                  {CATEGORY_ICONS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="size-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#5c403a]" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <CategoryIcon icon={formIcon} className="size-5 text-[#1a1c1b]" />
                <span className="font-mono text-[11px] text-[#906f69]">{formIcon}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-dashed border-[#e5e1d8]">
            <button
              onClick={() => { setShowForm(false); setEditingId(null) }}
              className="px-4 py-2 rounded-full font-mono text-[13px] border border-[#e5e1d8] text-[#1a1c1b] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[13px] bg-[#FF4D2D] text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#b51c00]"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" aria-hidden="true" />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#e5e1d8] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-[#5c403a]" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-16 font-mono text-[13px] text-[#5c403a]">No categories yet. Create your first category.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-dashed border-[#e5e1d8] bg-[#f4f4f1]">
                {["Icon", "Name", "Slug", "Actions"].map((h) => (
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
                      <button onClick={() => handleEdit(cat)} className="p-1.5 rounded text-[#5c403a] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none" aria-label={`Edit ${cat.name}`}>
                        <Pencil className="size-4" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} disabled={deleting === cat.id} className="p-1.5 rounded text-[#ba1a1a] hover:bg-[#ffdad6]/50 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none" aria-label={`Delete ${cat.name}`}>
                        {deleting === cat.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
