"use client"

import { Store, Shield, Save, ArrowRight, Loader2, RotateCcw, TriangleAlert, Monitor, Smartphone, RefreshCw } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { getCsrfToken, ensureCsrfToken } from "@/lib/utils"

const tabs = ["Storefront", "Payouts", "Account", "Preview"]

const defaultSettings = {
  storeName: "",
  storeUrl: "",
  bio: "",
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  minPayout: 100000,
  primaryColor: "red",
  autoPayout: true,
  twoFA: false,
  logo: "",
}

type Settings = typeof defaultSettings

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("Storefront")
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const originalRef = useRef<Settings>(defaultSettings)
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [previewKey, setPreviewKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
          if (data.logo) setLogoPreview(data.logo)
        })
        .catch(() => setMessage({ type: "error", text: "Failed to load settings" }))
        .finally(() => setLoading(false))
    })
  }, [])

  function handleDiscard() {
    setSettings({ ...originalRef.current })
    setMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const payload = { ...settings }
      if (logoPreview && logoPreview.startsWith("data:")) {
        payload.logo = logoPreview
      }
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
      setMessage({ type: "success", text: "Settings saved successfully!" })
      setPreviewKey((k) => k + 1)
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save settings" })
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" })
      return
    }
    setChangingPassword(true)
    setMessage(null)
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
      setMessage({ type: "success", text: "Password updated successfully" })
      setShowPasswordForm(false)
      setCurrentPassword("")
      setNewPassword("")
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to update password" })
    } finally {
      setChangingPassword(false)
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto pb-24 flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin text-[#5c403a]" />
      </div>
    )
  }

  return (
    <div className="max-w-[800px] mx-auto pb-24">
      <div className="mb-8 border-b border-dashed border-[#e5beb6] pb-4">
        <h2 className="font-sans text-[40px] leading-[48px] tracking-[-0.02em] font-extrabold text-[#1a1c1b] uppercase mb-2">
          Settings
        </h2>
        <p className="font-sans text-[16px] leading-[24px] text-[#5c403a]">
          Manage your storefront, payouts, and security preferences.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-4 py-2 font-mono text-[13px] leading-[16px] tracking-[0.05em] transition-all focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                  tab === activeTab
                    ? "bg-[#fdc73a] text-[#6f5400] font-bold border-l-4 border-[#b51c00]"
                    : "text-[#5c403a] hover:bg-[#f4f4f1]"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 space-y-8">
          {activeTab === "Storefront" && (
          <section className="bg-white border border-[#e5e1d8] p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 size-6 bg-[#FAFAF7] rounded-full border border-[#e5e1d8]" />
            <h3 className="font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b] mb-6 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-4">
              <Store className="size-5 text-[#b51c00]" aria-hidden="true" />
              Storefront Settings
            </h3>

            <div className="space-y-6">
              <div>
                <label htmlFor="storeName" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Store Name</label>
                <input id="storeName" type="text" value={settings.storeName} onChange={(e) => update("storeName", e.target.value)}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
              <div>
                <label htmlFor="storeUrl" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Store URL</label>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[13px] text-[#5c403a]">shopby.io/</span>
                  <input id="storeUrl" type="text" value={settings.storeUrl} onChange={(e) => update("storeUrl", e.target.value)}
                    className="flex-1 border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[13px] tracking-[0.05em] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
                </div>
              </div>
              <div>
                <label htmlFor="bio" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Bio</label>
                <textarea id="bio" rows={2} value={settings.bio} onChange={(e) => update("bio", e.target.value)}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] resize-none focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>

              <div className="border-t border-dashed border-[#e5e1d8] my-6" />

              <div>
                <label className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-3">Branding</label>
                <div className="flex items-center gap-6 bg-white p-4 border border-dashed border-[#e5e1d8]">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="size-16 rounded-full border border-[#e5e1d8] bg-[#f4f4f1] flex items-center justify-center overflow-hidden hover:border-[#b51c00] transition-colors cursor-pointer"
                      aria-label="Upload logo"
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Store logo" className="size-full object-cover" />
                      ) : (
                        <Store className="size-6 text-[#5c403a]" aria-hidden="true" />
                      )}
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (file.size > 500_000) {
                            setMessage({ type: "error", text: "Image too large. Max 500KB." })
                            return
                          }
                          const reader = new FileReader()
                          reader.onloadend = () => setLogoPreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                    <span className="font-sans text-[12px] leading-[16px] font-medium text-[#5c403a]">Update Logo</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="font-sans text-[12px] text-[#5c403a]">Primary Color</span>
                    <div className="flex gap-2">
                      {(["red", "black", "yellow"] as const).map((color) => (
                        <button
                          key={color}
                          aria-label={`Primary color ${color}`}
                          onClick={() => update("primaryColor", color)}
                          className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${
                            settings.primaryColor === color
                              ? "border-[#b51c00]"
                              : "border-[#e5e1d8]"
                          } ${
                            color === "red" ? "bg-[#FF4D2D]" : color === "black" ? "bg-[#1a1c1b]" : "bg-[#FFC93C]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}

          {activeTab === "Payouts" && (
          <section className="bg-white border border-[#e5e1d8] p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 size-6 bg-[#FAFAF7] rounded-full border border-[#e5e1d8]" />
            <h3 className="font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b] mb-6 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-4">
              <Store className="size-5 text-[#b51c00]" aria-hidden="true" />
              Payout Information
            </h3>
            <div className="space-y-6">
              <div>
                <label htmlFor="bankName" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Bank Name</label>
                <input id="bankName" type="text" value={settings.bankName} onChange={(e) => update("bankName", e.target.value)}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] uppercase text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
              <div>
                <label htmlFor="accountNumber" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Account Number</label>
                <input id="accountNumber" type="text" value={settings.accountNumber} onChange={(e) => update("accountNumber", e.target.value)}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
              <div>
                <label htmlFor="accountHolder" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Account Holder Name</label>
                <input id="accountHolder" type="text" value={settings.accountHolder} onChange={(e) => update("accountHolder", e.target.value)}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] uppercase text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
              <div>
                <label htmlFor="minPayout" className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mb-1">Minimum Payout Threshold (Rp)</label>
                <input id="minPayout" type="number" value={settings.minPayout} onChange={(e) => update("minPayout", Number(e.target.value))}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[13px] font-bold text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
            </div>
          </section>
          )}

          {activeTab === "Preview" && (
          <section className="bg-white border border-[#e5e1d8] p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 size-6 bg-[#FAFAF7] rounded-full border border-[#e5e1d8]" />
            <h3 className="font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b] mb-6 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-4">
              <Monitor className="size-5 text-[#b51c00]" aria-hidden="true" />
              Live Preview
            </h3>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex bg-[#f4f4f1] rounded-full p-0.5 border border-[#e5e1d8]">
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono uppercase transition-all focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                    previewMode === "desktop"
                      ? "bg-white text-[#1a1c1b] font-bold shadow-sm"
                      : "text-[#5c403a] hover:text-[#1a1c1b]"
                  }`}
                >
                  <Monitor className="size-4" aria-hidden="true" />
                  Desktop
                </button>
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono uppercase transition-all focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                    previewMode === "mobile"
                      ? "bg-white text-[#1a1c1b] font-bold shadow-sm"
                      : "text-[#5c403a] hover:text-[#1a1c1b]"
                  }`}
                >
                  <Smartphone className="size-4" aria-hidden="true" />
                  Mobile
                </button>
              </div>
              <button
                onClick={() => setPreviewKey((k) => k + 1)}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-mono uppercase border border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
                aria-label="Refresh preview"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Refresh
              </button>
            </div>

            <div
              className={`border border-[#e5e1d8] bg-[#f4f4f1] overflow-hidden transition-all duration-300 ${
                previewMode === "mobile"
                  ? "max-w-[390px] mx-auto rounded-[32px] shadow-[0_0_0_1px_#e5e1d8,0_8px_32px_rgba(0,0,0,0.1)]"
                  : "w-full"
              }`}
              style={
                previewMode === "mobile"
                  ? { height: "750px" }
                  : { height: "600px" }
              }
            >
              <div
                className={`w-full h-full ${previewMode === "mobile" ? "overflow-y-auto overflow-x-hidden rounded-[31px]" : ""}`}
              >
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  src={typeof window !== "undefined" ? window.location.origin : "/"}
                  title="Site Preview"
                  className="w-full h-full border-0"
                  style={previewMode === "mobile" ? { width: "390px", minWidth: "390px" } : {}}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  loading="lazy"
                />
              </div>
            </div>

            <p className="font-mono text-[11px] text-[#5c403a] mt-4 text-center">
              Preview refreshes when you save changes. Use {previewMode === "desktop" ? "Mobile" : "Desktop"} view to check responsive layout.
            </p>
          </section>
          )}

          {activeTab === "Account" && (
          <section className="bg-white border border-[#e5e1d8] p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 size-6 bg-[#FAFAF7] rounded-full border border-[#e5e1d8]" />
            <h3 className="font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b] mb-6 flex items-center gap-2 text-[#ba1a1a] border-b border-dashed border-[#e5beb6] pb-4">
              <Shield className="size-5" aria-hidden="true" />
              Security
            </h3>
            <div className="space-y-4">
              <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="w-full flex justify-between items-center py-3 border-b border-dashed border-[#e5e1d8] hover:bg-[#f4f4f1] transition-colors group focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
                <span className="font-sans text-[16px] text-[#1a1c1b]">Change Password</span>
                <ArrowRight className="size-5 text-[#5c403a] group-hover:text-[#b51c00]" aria-hidden="true" />
              </button>
              <div className="flex justify-between items-center py-3">
                <div>
                  <div className="font-sans text-[16px] text-[#1a1c1b]">Auto-Payouts</div>
                  <div className="font-sans text-[12px] text-[#5c403a] mt-1">Transfer funds daily</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settings.autoPayout} onChange={() => update("autoPayout", !settings.autoPayout)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF4D2D]" />
                </label>
              </div>
              <div className="flex justify-between items-center py-3">
                <div>
                  <div className="font-sans text-[16px] text-[#1a1c1b] flex items-center gap-2">
                    Two-Factor Authentication
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fdc73a] text-[#6f5400] font-mono text-[10px] uppercase font-bold">
                      <TriangleAlert className="size-3" aria-hidden="true" />
                      Planned
                    </span>
                  </div>
                  <div className="font-sans text-[12px] text-[#5c403a] mt-1">Coming in a future update</div>
                </div>
                <div className="w-11 h-6 bg-[#e2e3e0] rounded-full opacity-50" />
              </div>
            </div>
          </section>
          )}

          {showPasswordForm && (
            <div className="bg-white border border-[#e5e1d8] p-6 relative">
              <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] mb-4">Change Password</h3>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[13px] tracking-[0.05em] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none mb-4"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[13px] tracking-[0.05em] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !currentPassword || !newPassword}
                  className="px-4 py-2 rounded-full font-mono text-[13px] bg-[#FF4D2D] text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#b51c00]"
                >
                  {changingPassword ? "Updating..." : "Update Password"}
                </button>
                <button
                  onClick={() => { setShowPasswordForm(false); setCurrentPassword(""); setNewPassword("") }}
                  className="px-4 py-2 rounded-full font-mono text-[13px] border border-[#e5e1d8] text-[#1a1c1b] hover:bg-[#f4f4f1] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {message && (
            <div
              className={`p-3 rounded border font-mono text-[13px] ${
                message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
              role="alert"
              aria-live="polite"
            >
              {message.text}
            </div>
          )}

          <div className="flex justify-end items-center gap-4 pt-4 border-t border-dashed border-[#e5e1d8]">
            <button onClick={handleDiscard} className="px-6 py-2 rounded-full font-mono text-[13px] tracking-[0.05em] border border-[#e5e1d8] text-[#1a1c1b] hover:bg-[#f4f4f1] transition-colors active:translate-y-0.5 active:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none flex items-center gap-1.5">
              <RotateCcw className="size-4" aria-hidden="true" />
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-full font-mono text-[13px] tracking-[0.05em] bg-[#FF4D2D] text-[#1a1c1b] border border-[#1a1c1b] font-bold active:translate-y-0.5 active:translate-x-0.5 transition-transform hover:scale-105 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" aria-hidden="true" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
