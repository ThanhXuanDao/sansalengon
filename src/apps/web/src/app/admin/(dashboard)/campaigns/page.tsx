"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  RefreshCw, ExternalLink, Loader2, CheckCircle2, Clock, XCircle,
  ChevronDown, Save, Antenna,
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

interface NicheMatch {
  nicheId: string
  matchedAt: string
}

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
  lastSeenAt: string
  createdAt: string
  nicheMatches: NicheMatch[]
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

const MATCH_OPTIONS = [
  { value: "all",       label: "Tất cả match" },
  { value: "matched",   label: "Đã match ngách" },
  { value: "unmatched", label: "Chưa match" },
]

const COLUMNS: TableColumn[] = [
  { key: "campaign", label: "Campaign" },
  { key: "id",       label: "ID",        width: "100px" },
  { key: "type",     label: "Loại",      width: "130px" },
  { key: "approval", label: "Trạng thái", width: "120px" },
  { key: "cookie",   label: "Cookie",    width: "80px" },
  { key: "niches",   label: "Match ngách" },
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { success, error: toastError } = useToast()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [approvalFilter, setApproval] = useState("all")
  const [typeFilter, setType]     = useState("all")
  const [matchFilter, setMatch]   = useState("all")
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(20)

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

  function openEdit(c: Campaign) {
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
      if (matchFilter === "matched" && c.nicheMatches.length === 0) return false
      if (matchFilter === "unmatched" && c.nicheMatches.length > 0) return false
      return true
    })
  }, [campaigns, search, approvalFilter, typeFilter, matchFilter])

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
          <Button variant="secondary" icon={loading ? undefined : RefreshCw} onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Tải lại
          </Button>
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
            <FilterSelect label="Match" value={matchFilter} onChange={(v) => { setMatch(v); resetPage() }} options={MATCH_OPTIONS} id="filter-match" />
          </>
        }
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && filtered.length === 0}
        emptyIcon={Antenna}
        emptyTitle={search || approvalFilter !== "all" || typeFilter !== "all" || matchFilter !== "all" ? "Không tìm thấy campaign" : "Chưa có campaign nào"}
        emptyDescription={
          search || approvalFilter !== "all" || typeFilter !== "all" || matchFilter !== "all"
            ? "Thử điều chỉnh bộ lọc."
            : "Trigger một lần sync để load campaign từ AccessTrade."
        }
      >
        {paginated.map((c) => {
          const platform = detectPlatform(c.name, c.merchant)
          const platformColor = platform ? PLATFORM_COLORS[platform] : "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"
          const typeColor = CAMPAIGN_TYPE_COLORS[c.campaignType] ?? "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"

          return (
            <DataTableRow key={c.id}>
              {/* Campaign */}
              <DataTableCell>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  onClick={() => openEdit(c)}
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
                  {c.cookieDuration != null ? `${c.cookieDuration}d` : "—"}
                </span>
              </DataTableCell>

              {/* Niche matches */}
              <DataTableCell>
                {c.campaignType === "tracking" ? (
                  <span className="px-2 py-0.5 bg-[#e3f2fd] border border-[#0d5cb6]/20 font-mono text-[10px] text-[#0d5cb6]">Tất cả</span>
                ) : c.nicheMatches.length === 0 ? (
                  <span className="font-mono text-[11px] text-[#906f69]">Chưa match</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {c.nicheMatches.map((m) => (
                      <span key={m.nicheId} title={`Matched: ${formatDate(m.matchedAt)}`}
                        className="px-2 py-0.5 bg-[#e8f5e9] border border-[#1a6b3c]/20 font-mono text-[10px] text-[#1a6b3c]">
                        {m.nicheId}
                      </span>
                    ))}
                  </div>
                )}
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
