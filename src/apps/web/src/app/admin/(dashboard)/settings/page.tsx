"use client"

import {
  Globe, Palette, Search, Settings2, Shield, Save, RotateCcw,
  BarChart3, Phone, AlertTriangle, Info,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner, useToast, Tabs, TabList, TabTrigger, TabContent, ImageUpload } from "@/components/admin/ui"

const defaultSettings = {
  siteName: "",
  siteUrl: "",
  tagline: "",
  timezone: "Asia/Ho_Chi_Minh",
  dateFormat: "DD/MM/YYYY",
  decimalSeparator: ",",
  thousandSeparator: ".",
  currencySymbol: "₫",
  currencyPosition: "after",
  logo: "",
  favicon: "",
  footerDesc: "",
  hotline: "",
  facebookUrl: "",
  zaloUrl: "",
  youtubeUrl: "",
  ga4Id: "",
  gtmId: "",
  metaTitle: "",
  metaDesc: "",
  metaKeywords: "",
  ogImage: "",
  robotsDefault: "index,follow",
  sitemapEnabled: true,
  maintenanceMode: false,
  debugMode: false,
  showErrors: false,
  twoFA: false,
  cacheEnabled: true,
  footerCategoryLimit: 0,
  trendingCount: 10,
  featuredCount: 10,
}

type Settings = typeof defaultSettings

const inputCls = "w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[13px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none placeholder:text-[#5c403a]/40"
const labelCls = "block font-mono text-[14px] tracking-[0.06em] text-[#5c403a] mb-1.5"
const sectionCls = "bg-white border border-[#e5e1d8] p-6"
const sectionTitleCls = "font-sans text-[16px] font-bold text-[#1a1c1b] mb-5 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-3"

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only peer" />
      <div className="w-11 h-6 bg-[#e2e3e0] rounded-full peer peer-focus:ring-2 peer-focus:ring-[#b51c00] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#b51c00]" />
    </label>
  )
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 font-mono text-[11px] text-[#5c403a]/70">{hint}</p>}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-dashed border-[#e5e1d8] last:border-0">
      <div>
        <div className={`font-sans text-[14px] font-medium ${disabled ? "text-[#1a1c1b]/40" : "text-[#1a1c1b]"}`}>{label}</div>
        {hint && <div className="font-mono text-[11px] text-[#5c403a] mt-0.5">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function AdminSettings() {
  const [tab, setTab] = useState("general")
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const originalRef = useRef<Settings>(defaultSettings)
  const { success, error: toastError } = useToast()

  useEffect(() => {
    ensureCsrfToken().then((csrfToken) => {
      fetch("/api/settings", { headers: { "x-csrf-token": csrfToken } })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch")
          return res.json()
        })
        .then((data) => {
          const normalized = { ...defaultSettings, ...data }
          setSettings(normalized)
          originalRef.current = { ...normalized }
        })
        .catch(() => toastError("Không thể tải cài đặt"))
        .finally(() => setLoading(false))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function handleDiscard() {
    setSettings({ ...originalRef.current })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { ...settings }
      const csrfToken = await ensureCsrfToken()
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.details?.join(", ") || err.error || "Failed to save")
      }
      const data = await res.json()
      setSettings(data.settings)
      originalRef.current = { ...data.settings }
      success("Đã lưu cài đặt thành công!")
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Không thể lưu cài đặt")
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 12) {
      toastError("Mật khẩu mới phải có ít nhất 12 ký tự")
      return
    }
    if (newPassword !== confirmPassword) {
      toastError("Mật khẩu xác nhận không khớp")
      return
    }
    setChangingPassword(true)
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update password")
      }
      success("Đã cập nhật mật khẩu")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Không thể cập nhật mật khẩu")
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PageSpinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell title="Cài đặt" subtitle="Cấu hình ứng dụng, thương hiệu, SEO và hệ thống." />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <TabTrigger value="general"><Globe className="size-3.5 inline -mt-0.5 mr-1.5" />Tổng quát</TabTrigger>
          <TabTrigger value="brand"><Palette className="size-3.5 inline -mt-0.5 mr-1.5" />Thương hiệu</TabTrigger>
          <TabTrigger value="seo"><Search className="size-3.5 inline -mt-0.5 mr-1.5" />SEO & Analytics</TabTrigger>
          <TabTrigger value="system"><Settings2 className="size-3.5 inline -mt-0.5 mr-1.5" />Hệ thống</TabTrigger>
          <TabTrigger value="security"><Shield className="size-3.5 inline -mt-0.5 mr-1.5" />Bảo mật</TabTrigger>
        </TabList>

        <div className="mt-6 space-y-6">
          {/* ─── GENERAL ─── */}
          <TabContent value="general">
            <div className="space-y-6">
              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Globe className="size-4 text-[#b51c00]" />
                  Thông tin ứng dụng
                </h3>
                <div className="space-y-5">
                  <FieldRow label="Tên ứng dụng" hint="Hiển thị trên tab trình duyệt và header site">
                    <input type="text" value={settings.siteName} onChange={(e) => update("siteName", e.target.value)} className={inputCls} placeholder="Săn Sale Ngon" />
                  </FieldRow>
                  <FieldRow label="URL Site" hint="URL đầy đủ của trang web (bao gồm https://)">
                    <input type="url" value={settings.siteUrl} onChange={(e) => update("siteUrl", e.target.value)} className={inputCls} placeholder="https://sansalengon.com" />
                  </FieldRow>
                  <FieldRow label="Mô tả ngắn (Tagline)" hint="Hiển thị ở Hero section và footer">
                    <textarea rows={2} value={settings.tagline} onChange={(e) => update("tagline", e.target.value)} className={`${inputCls} resize-none`} placeholder="Tuyển chọn deal Shopee affiliate — cập nhật tự động." />
                  </FieldRow>
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Globe className="size-4 text-[#b51c00]" />
                  Định dạng ngày & số
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FieldRow label="Múi giờ">
                    <select value={settings.timezone} onChange={(e) => update("timezone", e.target.value)} className={`${inputCls} cursor-pointer`}>
                      <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
                      <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                      <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="Định dạng ngày">
                    <select value={settings.dateFormat} onChange={(e) => update("dateFormat", e.target.value)} className={`${inputCls} cursor-pointer`}>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </FieldRow>
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Globe className="size-4 text-[#b51c00]" />
                  Tiền tệ
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FieldRow label="Ký hiệu tiền tệ">
                    <input type="text" value={settings.currencySymbol} onChange={(e) => update("currencySymbol", e.target.value)} className={inputCls} placeholder="₫" />
                  </FieldRow>
                  <FieldRow label="Vị trí ký hiệu">
                    <select value={settings.currencyPosition} onChange={(e) => update("currencyPosition", e.target.value)} className={`${inputCls} cursor-pointer`}>
                      <option value="after">Sau số (100.000₫)</option>
                      <option value="before">Trước số (₫100.000)</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="Dấu phân cách thập phân">
                    <select value={settings.decimalSeparator} onChange={(e) => update("decimalSeparator", e.target.value)} className={`${inputCls} cursor-pointer`}>
                      <option value=",">, (phẩy)</option>
                      <option value=".">. (chấm)</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="Dấu phân cách hàng nghìn">
                    <select value={settings.thousandSeparator} onChange={(e) => update("thousandSeparator", e.target.value)} className={`${inputCls} cursor-pointer`}>
                      <option value=".">. (chấm)</option>
                      <option value=",">, (phẩy)</option>
                    </select>
                  </FieldRow>
                </div>
              </div>
            </div>
          </TabContent>

          {/* ─── BRAND ─── */}
          <TabContent value="brand">
            <div className="space-y-6">
              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Palette className="size-4 text-[#b51c00]" />
                  Nhận diện thương hiệu
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ImageUpload
                    label="Logo"
                    hint="Hiển thị trên header và tab trình duyệt."
                    value={settings.logo || null}
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    acceptLabel="PNG, SVG, JPG"
                    maxSizeKB={1024}
                    onError={toastError}
                    onChange={(v) => update("logo", v ?? "")}
                  />
                  <ImageUpload
                    label="Favicon"
                    hint="Hiện trên tab trình duyệt. Khuyến nghị 32×32px."
                    value={settings.favicon || null}
                    accept="image/x-icon,image/png,image/svg+xml"
                    acceptLabel="ICO, PNG, SVG"
                    maxSizeKB={500}
                    onError={toastError}
                    onChange={(v) => update("favicon", v ?? "")}
                  />
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Globe className="size-4 text-[#b51c00]" />
                  Footer & Mạng xã hội
                </h3>
                <div className="space-y-5">
                  <FieldRow label="Mô tả footer">
                    <textarea rows={2} value={settings.footerDesc} onChange={(e) => update("footerDesc", e.target.value)} className={`${inputCls} resize-none`} placeholder="Mô tả ngắn hiển thị ở footer..." />
                  </FieldRow>
                  <FieldRow label="Hotline / Số điện thoại">
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-[#5c403a]/50 flex-shrink-0" />
                      <input type="tel" value={settings.hotline} onChange={(e) => update("hotline", e.target.value)} className={inputCls} placeholder="0123 456 789" />
                    </div>
                  </FieldRow>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <FieldRow label="Facebook URL">
                      <input type="url" value={settings.facebookUrl} onChange={(e) => update("facebookUrl", e.target.value)} className={inputCls} placeholder="https://facebook.com/..." />
                    </FieldRow>
                    <FieldRow label="Zalo URL">
                      <input type="url" value={settings.zaloUrl} onChange={(e) => update("zaloUrl", e.target.value)} className={inputCls} placeholder="https://zalo.me/..." />
                    </FieldRow>
                    <FieldRow label="YouTube URL">
                      <input type="url" value={settings.youtubeUrl} onChange={(e) => update("youtubeUrl", e.target.value)} className={inputCls} placeholder="https://youtube.com/@..." />
                    </FieldRow>
                  </div>
                </div>
              </div>
            </div>
          </TabContent>

          {/* ─── SEO & ANALYTICS ─── */}
          <TabContent value="seo">
            <div className="space-y-6">
              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <BarChart3 className="size-4 text-[#b51c00]" />
                  Google Analytics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FieldRow label="Google Analytics 4 ID" hint="Dạng G-XXXXXXXXXX">
                    <input type="text" value={settings.ga4Id} onChange={(e) => update("ga4Id", e.target.value)} className={`${inputCls} font-mono`} placeholder="G-XXXXXXXXXX" />
                  </FieldRow>
                  <FieldRow label="Google Tag Manager ID" hint="Dạng GTM-XXXXXXX">
                    <input type="text" value={settings.gtmId} onChange={(e) => update("gtmId", e.target.value)} className={`${inputCls} font-mono`} placeholder="GTM-XXXXXXX" />
                  </FieldRow>
                </div>
                {(settings.ga4Id || settings.gtmId) && (
                  <div className="mt-4 flex items-start gap-2 p-3 bg-[#f0fff4] border border-[#86efac] text-[#166534] font-mono text-[11px]">
                    <Info className="size-3.5 flex-shrink-0 mt-0.5" />
                    Script sẽ được inject vào &lt;head&gt; tự động sau khi lưu.
                  </div>
                )}
              </div>

              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Search className="size-4 text-[#b51c00]" />
                  SEO mặc định
                </h3>
                <div className="space-y-5">
                  <FieldRow label="Meta Title mặc định" hint="Để trống để dùng tên ứng dụng">
                    <input type="text" value={settings.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} className={inputCls} placeholder="Tên trang | Tên site" />
                  </FieldRow>
                  <FieldRow label="Meta Description mặc định" hint="Tối đa 160 ký tự">
                    <textarea rows={2} value={settings.metaDesc} onChange={(e) => update("metaDesc", e.target.value)} className={`${inputCls} resize-none`} placeholder="Mô tả ngắn cho SEO..." maxLength={160} />
                    <span className="font-mono text-[10px] text-[#5c403a]/50">{settings.metaDesc.length}/160</span>
                  </FieldRow>
                  <FieldRow label="Meta Keywords" hint="Phân cách bằng dấu phẩy">
                    <input type="text" value={settings.metaKeywords} onChange={(e) => update("metaKeywords", e.target.value)} className={inputCls} placeholder="shopee, deal, giảm giá, affiliate" />
                  </FieldRow>
                  <FieldRow label="OG Image URL" hint="Ảnh preview khi chia sẻ lên mạng xã hội (1200×630px). Phải là URL công khai.">
                    <input type="url" value={settings.ogImage} onChange={(e) => update("ogImage", e.target.value)} className={inputCls} placeholder="https://..." />
                  </FieldRow>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FieldRow label="Robots mặc định">
                      <select value={settings.robotsDefault} onChange={(e) => update("robotsDefault", e.target.value)} className={`${inputCls} cursor-pointer`}>
                        <option value="index,follow">index, follow</option>
                        <option value="noindex,nofollow">noindex, nofollow</option>
                        <option value="index,nofollow">index, nofollow</option>
                        <option value="noindex,follow">noindex, follow</option>
                      </select>
                    </FieldRow>
                    <div className="flex items-center justify-between pt-5">
                      <div>
                        <div className="font-mono text-[12px] tracking-[0.06em] text-[#5c403a]">Sitemap XML</div>
                        <div className="font-mono text-[11px] text-[#5c403a]/70 mt-0.5">/sitemap.xml</div>
                      </div>
                      <Toggle checked={settings.sitemapEnabled} onChange={() => update("sitemapEnabled", !settings.sitemapEnabled)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabContent>

          {/* ─── SYSTEM ─── */}
          <TabContent value="system">
            <div className="space-y-6">
              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Settings2 className="size-4 text-[#b51c00]" />
                  Hiển thị
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FieldRow label="Số sản phẩm &quot;Đang xem nhiều&quot;" hint="Số lượng sản phẩm hiển thị trong section Trending. Mặc định 10.">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={settings.trendingCount}
                      onChange={(e) => update("trendingCount", Math.max(1, parseInt(e.target.value) || 10))}
                      className={inputCls}
                      placeholder="20"
                    />
                  </FieldRow>
                  <FieldRow label="Số sản phẩm &quot;Đề xuất hôm nay&quot;" hint="Số lượng sản phẩm hiển thị trong section Đề xuất hôm nay. Mặc định 10.">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={settings.featuredCount}
                      onChange={(e) => update("featuredCount", Math.max(1, parseInt(e.target.value) || 10))}
                      className={inputCls}
                      placeholder="20"
                    />
                  </FieldRow>
                  <FieldRow label="Số danh mục nổi bật ở footer" hint="Số danh mục hiển thị trong &quot;Danh mục nổi bật&quot; ở footer. Để trống hoặc 0 để hiển thị tất cả.">
                    <input
                      type="number"
                      min={0}
                      value={settings.footerCategoryLimit === 0 ? "" : settings.footerCategoryLimit}
                      onChange={(e) => update("footerCategoryLimit", e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                      className={inputCls}
                      placeholder="0 — hiển thị tất cả"
                    />
                  </FieldRow>
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className={sectionTitleCls}>
                  <Settings2 className="size-4 text-[#b51c00]" />
                  Chế độ hệ thống
                </h3>
                {settings.maintenanceMode && (
                  <div className="mb-4 flex items-start gap-2 p-3 bg-[#fff7ed] border border-[#fed7aa] text-[#9a3412] font-mono text-[11px]">
                    <AlertTriangle className="size-3.5 flex-shrink-0 mt-0.5" />
                    Chế độ bảo trì đang BẬT — khách truy cập sẽ thấy trang thông báo bảo trì.
                  </div>
                )}
                <ToggleRow
                  label="Chế độ bảo trì"
                  hint="Hiển thị trang maintenance cho visitor. Admin vẫn truy cập bình thường."
                  checked={settings.maintenanceMode}
                  onChange={() => update("maintenanceMode", !settings.maintenanceMode)}
                />
                <ToggleRow
                  label="Debug mode"
                  hint="Bật log chi tiết ở server (không ảnh hưởng UI người dùng)."
                  checked={settings.debugMode}
                  onChange={() => update("debugMode", !settings.debugMode)}
                />
                <ToggleRow
                  label="Hiển thị lỗi chi tiết"
                  hint="Hiện stack trace thay vì trang lỗi generic. Chỉ bật khi dev."
                  checked={settings.showErrors}
                  onChange={() => update("showErrors", !settings.showErrors)}
                />
                <ToggleRow
                  label="Bật cache hệ thống"
                  hint="Tắt khi develop để xem thay đổi ngay lập tức. Bật khi production để tăng hiệu năng."
                  checked={settings.cacheEnabled}
                  onChange={() => update("cacheEnabled", !settings.cacheEnabled)}
                />
              </div>
            </div>
          </TabContent>

          {/* ─── SECURITY ─── */}
          <TabContent value="security">
            <div className="space-y-6">
            <div className={sectionCls}>
              <h3 className={sectionTitleCls}>
                <Shield className="size-4 text-[#b51c00]" />
                Xác thực hai bước (2FA)
              </h3>
              <ToggleRow
                label="Bật xác thực OTP khi đăng nhập"
                hint="Sau khi nhập đúng mật khẩu, hệ thống sẽ gửi mã OTP qua email để xác nhận."
                checked={false}
                onChange={() => {}}
                disabled
              />
              <div className="mt-3 flex items-start gap-2 p-3 bg-[#fff7ed] border border-[#fed7aa] text-[#9a3412] font-mono text-[11px]">
                <AlertTriangle className="size-3.5 flex-shrink-0 mt-0.5" />
                Tính năng này yêu cầu cấu hình SMTP (email server). Vui lòng thiết lập tài khoản email trước khi bật.
              </div>
            </div>
            <div className={sectionCls}>
              <h3 className={`${sectionTitleCls} text-[#ba1a1a]`}>
                <Shield className="size-4" />
                Đổi mật khẩu
              </h3>
              <div className="space-y-5 max-w-sm">
                <FieldRow label="Mật khẩu hiện tại">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow label="Mật khẩu mới" hint="Tối thiểu 12 ký tự">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow label="Xác nhận mật khẩu mới">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputCls} ${confirmPassword && confirmPassword !== newPassword ? "border-[#ba1a1a]" : ""}`}
                  />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="mt-1.5 font-mono text-[11px] text-[#ba1a1a]">Mật khẩu không khớp</p>
                  )}
                </FieldRow>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="primary"
                    icon={Save}
                    onClick={handleChangePassword}
                    loading={changingPassword}
                    disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {changingPassword ? "Đang lưu..." : "Lưu mật khẩu"}
                  </Button>
                  <Button
                    variant="ghost"
                    icon={RotateCcw}
                    onClick={() => { setCurrentPassword(""); setNewPassword(""); setConfirmPassword("") }}
                    disabled={changingPassword}
                  >
                    Hoàn tác
                  </Button>
                </div>
              </div>
            </div>
            </div>
          </TabContent>

          {/* ─── SAVE BAR ─── */}
          <div className="flex justify-end items-center gap-4 pt-4 border-t border-dashed border-[#e5e1d8]">
            <Button variant="ghost" icon={RotateCcw} onClick={handleDiscard}>
              Hoàn tác
            </Button>
            <Button variant="primary" icon={Save} onClick={handleSave} loading={saving} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
