"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Settings,
  Store,
  HelpCircle,
  LogOut,
  Bell,
  Search,
  Menu,
  ExternalLink,
  X,
  LifeBuoy,
  Tags,
  MousePointerClick,
  MessageSquare,
} from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { getCsrfToken } from "@/lib/utils"

const navItems = [
  { href: "/admin-shopby", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin-shopby/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin-shopby/products", label: "Products", icon: Package },
  { href: "/admin-shopby/categories", label: "Categories", icon: Tags },
  { href: "/admin-shopby/click-logs", label: "Click Logs", icon: MousePointerClick },
  { href: "/admin-shopby/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin-shopby/settings", label: "Settings", icon: Settings },
]

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [ref, handler])
}

function FocusTrap({ containerRef, active }: { containerRef: React.RefObject<HTMLElement | null>; active: boolean }) {
  useEffect(() => {
    if (!active || !containerRef.current) return
    const container = containerRef.current
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (first) first.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    container.addEventListener("keydown", handleKeyDown)
    return () => container.removeEventListener("keydown", handleKeyDown)
  }, [active, containerRef])
  return null
}

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const csrf = getCsrfToken()
    if (!csrf) {
      fetch("/api/admin-shopby/csrf").catch(() => {})
    }
  }, [])

  const helpRef = useRef<HTMLDivElement>(null!)
  const notifRef = useRef<HTMLDivElement>(null!)
  const profileRef = useRef<HTMLDivElement>(null!)

  useClickOutside(helpRef, () => setHelpOpen(false))
  useClickOutside(notifRef, () => setNotifOpen(false))
  useClickOutside(profileRef, () => setProfileOpen(false))

  const handleLogout = async () => {
    await fetch("/api/admin-shopby/logout", {
      method: "POST",
      headers: { "x-csrf-token": getCsrfToken() },
    })
    router.push("/admin-shopby/login")
  }

  const notifications: { id: number; text: string; time: string }[] = []
  const hasUnread = notifications.length > 0

  return (
    <div className="min-h-screen flex bg-[#f9f9f6] text-[#1a1c1b] font-sans antialiased">
      {/* Sidebar (Desktop) */}
      <nav className="hidden md:flex flex-col h-screen w-64 border-r border-dashed border-[#e5beb6] bg-[#f9f9f6] py-4 shrink-0 sticky top-0">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="size-10 bg-[#1a1c1b] rounded-full flex items-center justify-center">
            <Store className="size-5 text-[#f9f9f6]" />
          </div>
          <div>
            <h1 className="font-sans text-[20px] leading-[28px] font-black text-[#1a1c1b] tracking-tight">
              Shopby Admin
            </h1>
            <p className="font-sans text-[12px] leading-[16px] font-medium text-[#5c403a]">
              Affiliate Portal
            </p>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded font-mono text-[13px] leading-[16px] tracking-[0.05em] transition-all active:translate-x-0.5 active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                  isActive
                    ? "bg-[#fdc73a] text-[#6f5400] font-bold border-l-4 border-[#b51c00]"
                    : "text-[#5c403a] hover:bg-[#f4f4f1]"
                }`}
              >
                <Icon className={`size-5 ${isActive ? "text-[#6f5400]" : ""}`} aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="px-4 mt-auto space-y-4 pt-4 border-t border-dashed border-[#e5beb6]">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full font-mono text-[13px] leading-[16px] tracking-[0.05em] border border-[#906f69] text-[#1a1c1b] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
          >
            <ExternalLink className="size-[18px]" aria-hidden="true" />
            View Storefront
          </a>
          <div className="space-y-1">
            <button onClick={() => setHelpOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 rounded text-[#5c403a] hover:bg-[#f4f4f1] font-mono text-[13px] leading-[16px] tracking-[0.05em] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
              <HelpCircle className="size-[18px]" aria-hidden="true" />
              Help
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 rounded text-[#ba1a1a] hover:bg-[#ffdad6]/20 font-mono text-[13px] leading-[16px] tracking-[0.05em] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
              <LogOut className="size-[18px]" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="flex justify-between items-center px-4 md:px-8 h-16 w-full sticky top-0 bg-[#f9f9f6] border-b border-dashed border-[#e5beb6] z-20 shrink-0">
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 rounded-full hover:bg-[#f4f4f1] transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <span className="font-sans text-[20px] leading-[28px] font-black text-[#b51c00] tracking-tight">
              Shopby
            </span>
          </div>

          <div className="hidden md:flex flex-1 items-center max-w-md">
            <div className="relative w-full">
              <Search className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5c403a]" aria-hidden="true" />
              <input
                ref={searchInputRef}
                id="admin-search"
                name="q"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/admin-shopby/products?q=${encodeURIComponent(searchQuery.trim())}`)
                    setSearchQuery("")
                  }
                }}
                placeholder="Search products...  Press / to focus"
                aria-label="Search products"
                autoComplete="off"
                className="w-full bg-transparent border-0 border-b border-[#e5beb6] focus:border-[#b51c00] focus:ring-0 pl-10 pr-4 py-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] placeholder:text-[#5c403a]/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-full text-[#5c403a] hover:bg-[#ffdf9a] transition-colors active:translate-x-0.5 active:translate-y-0.5 relative focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell className="size-5" aria-hidden="true" />
                {hasUnread && <span className="absolute top-2 right-2 size-2 bg-[#b51c00] rounded-full" aria-hidden="true" />}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#e5e1d8] shadow-[4px_4px_0px_0px_rgba(26,28,27,1)] z-50" role="menu" aria-label="Notifications">
                  <div className="p-3 border-b border-dashed border-[#e5e1d8]">
                    <p className="font-mono text-[11px] tracking-[0.05em] font-bold text-[#1a1c1b] uppercase">Notifications</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div key={n.id} className="p-3 border-b border-dashed border-[#e5e1d8] hover:bg-[#f4f4f1] transition-colors cursor-pointer">
                          <p className="font-sans text-[13px] text-[#1a1c1b]">{n.text}</p>
                          <p className="font-mono text-[10px] text-[#5c403a] mt-0.5">{n.time}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center">
                        <p className="font-mono text-[11px] text-[#5c403a]">No notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div ref={helpRef} className="relative">
              <button
                onClick={() => setHelpOpen(!helpOpen)}
                className="p-2 rounded-full text-[#5c403a] hover:bg-[#ffdf9a] transition-colors active:translate-x-0.5 active:translate-y-0.5 hidden sm:block focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
                aria-label="Help"
              >
                <HelpCircle className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="h-6 w-px border-r border-dashed border-[#e5beb6] mx-2 hidden sm:block" />

            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-[#ffdf9a] transition-colors active:translate-x-0.5 active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
                aria-label="Profile menu"
                aria-expanded={profileOpen}
              >
                <span className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#b51c00] hidden sm:block font-bold">
                  Admin
                </span>
                <div className="size-8 rounded-full bg-[#e2e3e0] border border-[#e5beb6] flex items-center justify-center text-[13px] font-bold text-[#5c403a]">
                  A
                </div>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#e5e1d8] shadow-[4px_4px_0px_0px_rgba(26,28,27,1)] z-50">
                  <div className="p-3 border-b border-dashed border-[#e5e1d8]">
                    <p className="font-sans text-[13px] font-bold text-[#1a1c1b]">Admin</p>
                  </div>
                  <Link href="/admin-shopby/settings" className="flex items-center gap-3 p-3 border-b border-dashed border-[#e5e1d8] hover:bg-[#f4f4f1] transition-colors font-sans text-[13px] text-[#1a1c1b]" onClick={() => setProfileOpen(false)}>
                    <Settings className="size-4 text-[#5c403a]" aria-hidden="true" />
                    Settings
                  </Link>
                  <button onClick={() => { setProfileOpen(false); handleLogout(); }} className="w-full flex items-center gap-3 p-3 hover:bg-[#f4f4f1] transition-colors font-sans text-[13px] text-[#ba1a1a]">
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-30">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setMobileMenuOpen(false)}
            />
            <nav className="absolute left-0 top-16 bottom-0 w-64 bg-[#f9f9f6] border-r border-dashed border-[#e5beb6] p-4 flex flex-col">
              <div className="flex-1 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded font-mono text-[13px] leading-[16px] tracking-[0.05em] transition-all focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                        isActive
                          ? "bg-[#fdc73a] text-[#6f5400] font-bold border-l-4 border-[#b51c00]"
                          : "text-[#5c403a] hover:bg-[#f4f4f1]"
                      }`}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
              <div className="pt-4 border-t border-dashed border-[#e5beb6] space-y-1">
                <button onClick={() => { setHelpOpen(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 rounded text-[#5c403a] hover:bg-[#f4f4f1] font-mono text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
                  <HelpCircle className="size-[18px]" aria-hidden="true" />
                  Help
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 rounded text-[#ba1a1a] hover:bg-[#ffdad6]/20 font-mono text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
                  <LogOut className="size-[18px]" aria-hidden="true" />
                  Logout
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* Help Modal */}
        {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => setHelpOpen(false)} />
            <div ref={helpRef} className="relative bg-white border border-[#e5e1d8] shadow-[8px_8px_0px_0px_rgba(26,28,27,1)] max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
              <FocusTrap containerRef={helpRef} active={helpOpen} />
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-sans text-[20px] font-black text-[#1a1c1b] tracking-tight uppercase">Help & Resources</h2>
                <button onClick={() => setHelpOpen(false)} className="p-1 hover:bg-[#f4f4f1] rounded transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none" aria-label="Close help">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-4">
                <a href="/admin-shopby/help" className="block p-4 border border-[#e5e1d8] hover:bg-[#f4f4f1] transition-colors" style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}>
                  <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] flex items-center gap-2">
                    <LifeBuoy className="size-5 text-[#b51c00]" aria-hidden="true" />
                    Help Center
                  </h3>
                  <p className="font-sans text-[13px] text-[#5c403a] mt-1">Browse guides and FAQs for managing your affiliate links.</p>
                </a>
                <a href="/admin-shopby/help" className="block p-4 border border-[#e5e1d8] hover:bg-[#f4f4f1] transition-colors" style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}>
                  <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] flex items-center gap-2">
                    <BarChart3 className="size-5 text-[#b51c00]" aria-hidden="true" />
                    Analytics Guide
                  </h3>
                  <p className="font-sans text-[13px] text-[#5c403a] mt-1">Understand your metrics and optimize conversions.</p>
                </a>
                <a href="https://shopee.co.id" target="_blank" rel="noopener noreferrer" className="block p-4 border border-[#e5e1d8] hover:bg-[#f4f4f1] transition-colors" style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}>
                  <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] flex items-center gap-2">
                    <ExternalLink className="size-5 text-[#b51c00]" aria-hidden="true" />
                    Shopee Affiliate
                  </h3>
                  <p className="font-sans text-[13px] text-[#5c403a] mt-1">Visit Shopee Affiliate Program for more resources.</p>
                </a>
              </div>
              <div className="mt-6 pt-4 border-t border-dashed border-[#e5e1d8] text-center">
                <p className="font-mono text-[11px] text-[#5c403a]">Need more help? Contact support</p>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#FAFAF7]">
          {children}
        </main>
      </div>
    </div>
  )
}
