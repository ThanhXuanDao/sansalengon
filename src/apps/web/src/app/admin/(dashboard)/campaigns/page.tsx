"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  RefreshCw, ExternalLink, Loader2, CheckCircle2, Clock, XCircle,
  ChevronDown, Save, Image as ImageIcon, Tag, Percent, LayoutGrid,
} from "lucide-react"
import { ensureCsrfToken, getCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Modal,
  useToast,
  AdminFilterBar,
  FilterSelect,
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTablePagination,
} from "@/components/admin/ui"
import type { TableColumn } from "@/components/admin/ui"

// ── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string
  name: string
  merchant: string
  url: string
  approval: string
  cookieDuration: number | null
  status: number
  campaignType: string
  ctaTitle: string | null
  ctaDescription: string | null
  ctaImageUrl: string | null
  ctaLabel: string | null
  logoUrl: string | null
  ogImageUrl: string | null
  description: string | null
  category: string | null
  commission: string | null
  lastSeenAt: string
  createdAt: string
  banners: Banner[]
}

interface Banner {
  id: string
  imageUrl: string
  width: number | null
  height: number | null
  type: string | null
  affiliateLink: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_KEYWORDS: Record<string, string[]> = {
  tiki:   ["tiki"],
  lazada: ["lazada"],
  shopee: ["shopee"],
  sendo:  ["sendo"],
  tiktok: ["tiktok", "tik tok"],
}

function detectPlatform(name: string, merchant: string): string | null {
  const haystack = `${name} ${merchant}`.toLowerCase()
  for (const [platform, kws] of Object.entries(PLATFORM_KEYWORDS)) {
    if (kws.some((k) => haystack.includes(k))) return platform
  }
  return null
}

const PLATFORM_COLORS: Record<string, string> = {
  tiki:   "bg-[#0d5cb6]/10 text-[#0d5cb6] border-[#0d5cb6]/30",
  lazada: "bg-[#f57224]/10 text-[#c45e1a] border-[#f57224]/30",
  shopee: "bg-[#ee4d2d]/10 text-[#b83c22] border-[#ee4d2d]/30",
  sendo:  "bg-[#e53935]/10 text-[#b71c1c] border-[#e53935]/30",
  tiktok: "bg-[#010101]/10 text-[#010101] border-[#010101]/30",
}

const CAMPAIGN_TYPE_OPTIONS = [
  { value: "product",  label: "Product feed", hint: "Lấy sản phẩm qua AT /v1/offers" },
  { value: "tracking", label: "Tracking link", hint: "Fetch từ API nguồn (Tiki...) rồi wrap AT link — tự động match toàn bộ ngách" },
  { value: "app",      label: "App CTA",      hint: "Hiển thị card kêu gọi tải app" },
  { value: "link",     label: "Link CTA",     hint: "Hiển thị card kêu gọi mở link" },
  { value: "website",  label: "Website",      hint: "Cấu hình scraper nguồn web" },
]

const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  product:  "bg-[#e8f5e9] text-[#1a6b3c] border-[#1a6b3c]/20",
  tracking: "bg-[#e3f2fd] text-[#0d5cb6] border-[#0d5cb6]/20",
  app:      "bg-[#e8eaf6] text-[#3949ab] border-[#3949ab]/20",
  link:     "bg-[#fff8e1] text-[#6f5400] border-[#fdc73a]/40",
  website:  "bg-[#fce4ec] text-[#c2185b] border-[#c2185b]/20",
}

const APPROVAL_OPTIONS = [
  { value: "all",        label: "Tất cả trạng thái" },
  { value: "successful", label: "Approved" },
  { value: "pending",    label: "Pending" },
  { value: "other",      label: "Khác" },
]

const TYPE_OPTIONS = [
  { value: "all",      label: "Tất cả loại" },
  { value: "product",  label: "Product feed" },
  { value: "tracking", label: "Tracking link" },
  { value: "app",      label: "App CTA" },
  { value: "link",     label: "Link CTA" },
  { value: "website",  label: "Website" },
]

const COLUMNS: TableColumn[] = [
  { key: "campaign", label: "Campaign" },
  { key: "id",       label: "ID",        width: "100px" },
  { key: "type",     label: "Loại",      width: "130px" },
  { key: "approval", label: "Trạng thái", width: "120px" },
  { key: "cookie",   label: "Cookie",    width: "80px" },
  { key: "seen",     label: "Last seen", align: "right", width: "110px" },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "< 1 giờ trước"
  if (h < 24) return `${h}h trước`
  return `${Math.floor(h / 24)} ngày trước`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ApprovalBadge({ approval }: { approval: string }) {
  if (approval === "successful") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e6f4ea] text-[#1a6b3c] font-mono text-[10px] uppercase tracking-wider">
        <CheckCircle2 className="size-3" />Approved
      </span>
    )
  }
  if (approval === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fff8e1] text-[#6f5400] font-mono text-[10px] uppercase tracking-wider">
        <Clock className="size-3" />Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fce8e6] text-[#c5221f] font-mono text-[10px] uppercase tracking-wider">
      <XCircle className="size-3" />{approval}
    </span>
  )
}

// ── Edit modal content ────────────────────────────────────────────────────────

function EditFormContent({
  form,
  setForm,
}: {
  form: { campaignType: string; ctaTitle: string; ctaDescription: string; ctaImageUrl: string; ctaLabel: string }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
}) {
  const isCtaType = form.campaignType === "app" || form.campaignType === "link"
  return (
    <div className="space-y-4">
      <div>
        <label className="block font-mono text-[11px] uppercase tracking-[0.06em] text-[#5c403a] mb-1.5">
          Loại campaign
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, campaignType: opt.value }))}
              className={`flex flex-col items-start px-3 py-2 border text-left transition-colors ${
                form.campaignType === opt.value
                  ? "border-[#b51c00] bg-[#fff8f6]"
                  : "border-[#e5e1d8] hover:bg-[#f4f4f1]"
              }`}
            >
              <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 border mb-1 ${CAMPAIGN_TYPE_COLORS[opt.value]}`}>
                {opt.label}
              </span>
              <span className="font-mono text-[11px] text-[#5c403a]">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {isCtaType && (
        <div className="space-y-3 border-t border-dashed border-[#e5e1d8] pt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#906f69]">Nội dung CTA</p>
          <div>
            <label className="block font-mono text-[11px] text-[#5c403a] mb-1">Tiêu đề</label>
            <input value={form.ctaTitle} onChange={(e) => setForm((f) => ({ ...f, ctaTitle: e.target.value }))}
              placeholder="Cài ngay ứng dụng XXX"
              className="w-full border border-[#e5e1d8] px-2 py-1.5 font-mono text-[12px] focus:border-[#b51c00] focus:outline-none" />
          </div>
          <div>
            <label className="block font-mono text-[11px] text-[#5c403a] mb-1">Mô tả</label>
            <textarea rows={2} value={form.ctaDescription} onChange={(e) => setForm((f) => ({ ...f, ctaDescription: e.target.value }))}
              placeholder="Mô tả ngắn về app hoặc link..."
              className="w-full border border-[#e5e1d8] px-2 py-1.5 font-mono text-[12px] focus:border-[#b51c00] focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block font-mono text-[11px] text-[#5c403a] mb-1">URL hình ảnh</label>
            <input value={form.ctaImageUrl} onChange={(e) => setForm((f) => ({ ...f, ctaImageUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full border border-[#e5e1d8] px-2 py-1.5 font-mono text-[12px] focus:border-[#b51c00] focus:outline-none" />
          </div>
          <div>
            <label className="block font-mono text-[11px] text-[#5c403a] mb-1">Label nút CTA</label>
            <input value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
              placeholder="Cài ngay / Vào ngay"
              className="w-full border border-[#e5e1d8] px-2 py-1.5 font-mono text-[12px] focus:border-[#b51c00] focus:outline-none" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Campaign detail modal ────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-[#f0ede8] last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69] w-28 shrink-0 pt-0.5">{label}</span>
      <span className="font-mono text-[12px] text-[#1a1c1b] flex-1 break-all">{value}</span>
    </div>
  )
}

function CampaignDetailModal({
  campaign,
  onClose,
  onEdit,
}: {
  campaign: Campaign
  onClose: () => void
  onEdit: () => void
}) {
  const platform = detectPlatform(campaign.name, campaign.merchant)
  const platformColor = platform ? PLATFORM_COLORS[platform] : "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"
  const typeColor = CAMPAIGN_TYPE_COLORS[campaign.campaignType] ?? "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"
  const hasCta = campaign.ctaTitle || campaign.ctaDescription || campaign.ctaImageUrl || campaign.ctaLabel

  return (
    <Modal
      open
      onClose={onClose}
      title={campaign.name}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button variant="secondary" icon={ChevronDown} onClick={onEdit}>Cấu hình loại</Button>
        </>
      }
    >
      <div className="space-y-5">

        {/* ── Ảnh hero (ogImage) ── */}
        {campaign.ogImageUrl && (
          <div className="border border-[#e5e1d8] bg-[#f4f4f1] overflow-hidden -mx-1">
            <img
              src={campaign.ogImageUrl}
              alt={campaign.name}
              className="w-full max-h-52 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none" }}
            />
          </div>
        )}

        {/* ── Logo + badges + URL ── */}
        <div className="flex gap-4 items-start">
          {campaign.logoUrl ? (
            <img
              src={campaign.logoUrl}
              alt={campaign.merchant}
              className="w-20 h-20 object-contain border border-[#e5e1d8] bg-white shrink-0 p-1.5"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          ) : (
            <div className="w-20 h-20 border border-[#e5e1d8] bg-[#f4f4f1] flex items-center justify-center shrink-0">
              <ImageIcon className="size-7 text-[#906f69]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`px-1.5 py-0.5 border font-mono text-[10px] uppercase tracking-wider ${typeColor}`}>
                {campaign.campaignType}
              </span>
              {platform && (
                <span className={`px-1.5 py-0.5 border font-mono text-[10px] uppercase tracking-wider ${platformColor}`}>
                  {platform}
                </span>
              )}
              <ApprovalBadge approval={campaign.approval} />
              <span className={`px-1.5 py-0.5 border font-mono text-[10px] ${campaign.status === 1 ? "bg-[#e8f5e9] border-[#1a6b3c]/20 text-[#1a6b3c]" : "bg-[#fef2f2] border-red-200 text-red-700"}`}>
                {campaign.status === 1 ? "active" : "inactive"}
              </span>
            </div>
            <p className="font-mono text-[13px] text-[#1a1c1b] font-bold mb-0.5">{campaign.merchant}</p>
            <a href={campaign.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[#0d5cb6] hover:underline">
              {campaign.url.length > 55 ? campaign.url.slice(0, 55) + "…" : campaign.url}
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
        </div>

        {/* ── Thông tin chi tiết ── */}
        <div className="border border-[#e5e1d8] bg-[#fafaf7] px-4 py-1">
          <InfoRow label="Campaign ID" value={campaign.id} />
          {campaign.commission && <InfoRow label="Hoa hồng" value={<strong className="text-[#1a6b3c]">{campaign.commission}</strong>} />}
          {campaign.category && <InfoRow label="Ngành hàng" value={campaign.category} />}
          {campaign.cookieDuration != null && <InfoRow label="Cookie" value={`${campaign.cookieDuration / 86400 | 0} ngày`} />}
          <InfoRow label="Loại" value={campaign.campaignType} />
          <InfoRow label="Phê duyệt" value={campaign.approval} />
          <InfoRow label="Ngày tạo" value={formatDate(campaign.createdAt)} />
          <InfoRow label="Last seen" value={formatDate(campaign.lastSeenAt)} />
        </div>

        {/* ── Mô tả ── */}
        {campaign.description && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69] mb-2">Mô tả chiến dịch</p>
            <div className="p-3 bg-[#fafaf7] border border-dashed border-[#e5e1d8] font-mono text-[12px] text-[#1a1c1b] leading-relaxed max-h-40 overflow-y-auto scrollbar-hide">
              {campaign.description}
            </div>
          </div>
        )}

        {/* ── CTA config (nếu đã cấu hình) ── */}
        {hasCta && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69] mb-2">CTA đã cấu hình</p>
            <div className="border border-[#e5e1d8] bg-[#fafaf7] px-4 py-1">
              {campaign.ctaTitle && <InfoRow label="Tiêu đề" value={campaign.ctaTitle} />}
              {campaign.ctaDescription && <InfoRow label="Mô tả CTA" value={campaign.ctaDescription} />}
              {campaign.ctaLabel && <InfoRow label="Nút CTA" value={campaign.ctaLabel} />}
              {campaign.ctaImageUrl && (
                <div className="py-2 border-b border-[#f0ede8] last:border-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69] mb-1.5">Ảnh CTA</p>
                  <img
                    src={campaign.ctaImageUrl}
                    alt="CTA"
                    className="max-h-28 object-contain border border-[#e5e1d8]"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { success, error: toastError } = useToast()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [approvalFilter, setApproval] = useState("all")
  const [typeFilter, setType]     = useState("all")
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(20)

  const [detailTarget, setDetailTarget] = useState<Campaign | null>(null)
  const [editTarget, setEditTarget] = useState<Campaign | null>(null)
  const [editForm, setEditForm]     = useState({ campaignType: "", ctaTitle: "", ctaDescription: "", ctaImageUrl: "", ctaLabel: "" })
  const [saving, setSaving]         = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/at-campaigns", { headers: { "x-csrf-token": csrf } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
    } catch (e: unknown) {
      toastError(`Không tải được danh sách campaign: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { fetchData() }, [fetchData])

  function openDetail(c: Campaign) {
    setDetailTarget(c)
  }

  function openEdit(c: Campaign) {
    setDetailTarget(null)
    setEditForm({
      campaignType: c.campaignType ?? "product",
      ctaTitle: c.ctaTitle ?? "",
      ctaDescription: c.ctaDescription ?? "",
      ctaImageUrl: c.ctaImageUrl ?? "",
      ctaLabel: c.ctaLabel ?? "",
    })
    setEditTarget(c)
  }

  async function handleSave() {
    if (!editTarget) return
    setSaving(true)
    try {
      await ensureCsrfToken()
      const res = await fetch("/api/admin/at-campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ id: editTarget.id, ...editForm }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      success(`Đã cập nhật campaign "${editTarget.name}"`)
      setCampaigns((prev) => prev.map((c) => c.id === editTarget.id ? { ...c, ...editForm } : c))
      setEditTarget(null)
    } catch (e: unknown) {
      toastError(`Lỗi: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Filter + paginate ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return campaigns.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.merchant.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false
      if (approvalFilter !== "all") {
        if (approvalFilter === "other") {
          if (c.approval === "successful" || c.approval === "pending") return false
        } else if (c.approval !== approvalFilter) return false
      }
      if (typeFilter !== "all" && c.campaignType !== typeFilter) return false
      return true
    })
  }, [campaigns, search, approvalFilter, typeFilter])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  function resetPage() { setPage(1) }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      <AdminPageShell
        title="AccessTrade Campaigns"
        subtitle="Danh sách campaign đã đăng ký & được duyệt. Click loại campaign để cấu hình CTA."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={loading ? undefined : RefreshCw} onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Tải lại
            </Button>
          </div>
        }
      />

      {/* Filter bar */}
      <AdminFilterBar
        search={{
          value: search,
          onChange: (v) => { setSearch(v); resetPage() },
          placeholder: "Tên campaign, merchant, ID...",
          id: "campaigns-search",
        }}
        filters={
          <>
            <FilterSelect label="Loại" value={typeFilter} onChange={(v) => { setType(v); resetPage() }} options={TYPE_OPTIONS} id="filter-type" />
            <FilterSelect label="Trạng thái" value={approvalFilter} onChange={(v) => { setApproval(v); resetPage() }} options={APPROVAL_OPTIONS} id="filter-approval" />
          </>
        }
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && filtered.length === 0}
        emptyIcon={Tag}
        emptyTitle={search || approvalFilter !== "all" || typeFilter !== "all" ? "Không tìm thấy campaign" : "Chưa có campaign nào"}
        emptyDescription={
          search || approvalFilter !== "all" || typeFilter !== "all"
            ? "Thử điều chỉnh bộ lọc."
            : "Trigger một lần sync để load campaign từ AccessTrade."
        }
      >
        {paginated.map((c) => {
          const platform = detectPlatform(c.name, c.merchant)
          const platformColor = platform ? PLATFORM_COLORS[platform] : "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"
          const typeColor = CAMPAIGN_TYPE_COLORS[c.campaignType] ?? "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"

          return (
            <DataTableRow key={c.id} onClick={() => openDetail(c)} className="cursor-pointer hover:bg-[#fafaf7]">
              {/* Campaign */}
              <DataTableCell>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.logoUrl && (
                      <img src={c.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                    )}
                    <span className="font-mono text-[13px] font-bold text-[#1a1c1b]">{c.name}</span>
                    {platform && (
                      <span className={`px-1.5 py-0.5 border font-mono text-[10px] uppercase tracking-wider ${platformColor}`}>
                        {platform}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[11px] text-[#5c403a]">{c.merchant}</span>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[#906f69] hover:text-[#b51c00] transition-colors">
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              </DataTableCell>

              {/* ID */}
              <DataTableCell>
                <span className="font-mono text-[11px] text-[#5c403a] bg-[#f4f4f1] px-1.5 py-0.5">{c.id}</span>
              </DataTableCell>

              {/* Type */}
              <DataTableCell>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                  className={`flex items-center gap-1 px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wider hover:opacity-80 transition-opacity ${typeColor}`}
                  title="Click để sửa loại campaign"
                >
                  {c.campaignType}
                  <ChevronDown className="size-3" />
                </button>
              </DataTableCell>

              {/* Approval */}
              <DataTableCell>
                <ApprovalBadge approval={c.approval} />
              </DataTableCell>

              {/* Cookie */}
              <DataTableCell>
                <span className="font-mono text-[12px] text-[#1a1c1b]">
                  {c.cookieDuration != null ? `${Math.round(c.cookieDuration / 86400)} ngày` : "—"}
                </span>
              </DataTableCell>

              {/* Last seen */}
              <DataTableCell align="right">
                <span className="font-mono text-[11px] text-[#5c403a]" title={formatDate(c.lastSeenAt)}>
                  {relativeTime(c.lastSeenAt)}
                </span>
              </DataTableCell>
            </DataTableRow>
          )
        })}
      </DataTable>

      <DataTablePagination
        page={page}
        total={filtered.length}
        pageSize={pageSize}
        pageSizeOptions={[20, 50, 100]}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        label="campaign"
      />

      {/* Detail modal */}
      {detailTarget && (
        <CampaignDetailModal
          campaign={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => openEdit(detailTarget)}
        />
      )}

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget?.name ?? ""}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={saving}>Huỷ</Button>
            <Button variant="primary" icon={Save} onClick={handleSave} loading={saving}>Lưu</Button>
          </>
        }
      >
        {editTarget && (
          <div className="mb-2">
            <p className="font-mono text-[11px] text-[#5c403a]">ID: {editTarget.id}</p>
          </div>
        )}
        <EditFormContent form={editForm} setForm={setEditForm} />
      </Modal>
    </div>
  )
}
