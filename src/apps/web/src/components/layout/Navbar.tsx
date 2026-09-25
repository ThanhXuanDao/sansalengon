"use client"

import Link from "next/link"
import Image from "next/image"
import { useRef, useEffect, useCallback, useState } from "react"
import { usePathname } from "next/navigation"
import { Search, X, Phone, Tag, Flame, Percent } from "lucide-react"
import { useSettings } from "@/hooks/useSettings"

interface NavbarProps {
  onSearch?: (q: string) => void
  searchQuery?: string
}

export default function Navbar({ onSearch, searchQuery = "" }: NavbarProps) {
  const pathname = usePathname()
  const [inputValue, setInputValue] = useState(searchQuery)
  const [logoError, setLogoError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: settings } = useSettings()

  useEffect(() => { setInputValue(searchQuery) }, [searchQuery])

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch?.(value), 300)
  }, [onSearch])

  const handleClear = useCallback(() => {
    setInputValue("")
    onSearch?.("")
    inputRef.current?.focus()
  }, [onSearch])

  const handleSearch = () => onSearch?.(inputValue)

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  const navLinkClass = (href: string) =>
    `relative flex items-center gap-1 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
      pathname === href
        ? "text-secondary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-secondary after:rounded-full"
        : "text-[#4F586D] hover:text-secondary"
    }`

  const storeName = settings?.siteName || "Săn Sale Ngon"

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white navbar-shadow">

      {/* ─── Announcement bar ─── */}
      <div className="bg-[#1C1C4D] text-white text-xs py-1.5 text-center hidden sm:block">
        <span className="inline-flex items-center gap-2">
          <Tag className="size-3 text-primary" aria-hidden="true" />
          Cập nhật deal Shopee mới nhất — <strong className="text-primary">miễn phí 100%</strong>
        </span>
      </div>

      {/* ─── Row 1: Logo + Search + Hotline + User ─── */}
      <div className="border-b border-[#DFE0E4] bg-[#F7FDFC]">
      <div className="max-w-[1320px] mx-auto px-3 py-2.5 flex items-center gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0 min-w-[120px]" aria-label="Trang chủ">
          {logoError ? (
            <div className="flex items-center gap-1.5 h-14">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <Tag className="size-5 text-white" aria-hidden="true" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold text-[#FF6B00] uppercase tracking-tight">Săn Sale</div>
                <div className="text-[11px] font-semibold text-[#1C1C4D] uppercase tracking-wider">Ngon</div>
              </div>
            </div>
          ) : (
            <Image
              src="/logo.png"
              alt={storeName}
              width={180}
              height={68}
              className="h-12 w-auto max-w-[220px] object-contain"
              priority
              onError={() => setLogoError(true)}
            />
          )}
        </Link>

        {/* Search bar */}
        <div className="flex flex-1 border border-[#DFE0E4] rounded-lg focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(0,194,146,0.12)] transition-all">
          {/* Input */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="navbar-search"
              name="q"
              type="search"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Tìm sản phẩm, thương hiệu..."
              aria-label="Tìm kiếm sản phẩm"
              autoComplete="off"
              className="w-full h-full px-4 py-2 text-sm text-[#222E48] placeholder:text-[#4F586D]/50 bg-white outline-none rounded-l-lg"
            />
            {inputValue && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#4F586D]/50 hover:text-[#222E48] transition-colors"
                aria-label="Xóa tìm kiếm"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={handleSearch}
            className="bg-secondary hover:bg-[#e55f00] text-white px-4 py-2 text-sm font-semibold shrink-0 transition-colors flex items-center gap-1.5 rounded-r-lg"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Tìm</span>
          </button>
        </div>

        {/* Right: hotline + user */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2">
            <Phone className="size-4 text-primary shrink-0" aria-hidden="true" />
            <div className="leading-tight">
              <div className="text-[11px] font-semibold text-[#222E48]">Hỗ trợ 24/7</div>
              <div className="text-[11px] text-primary font-medium">Miễn phí</div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ─── Row 2: Navigation links ─── */}
      <div className="bg-white border-b border-[#DFE0E4]">
      <div className="max-w-[1320px] mx-auto px-3 flex items-center justify-between">

        {/* Left nav — 3 featured items + secondary links */}
        <div className="flex items-center gap-1.5">

          {/* Khuyến mãi HOT → trang chủ */}
          <Link
            href="/"
            className={`group relative flex items-center gap-1.5 px-3.5 py-1.5 my-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${
              pathname === "/"
                ? "bg-secondary text-white shadow-[0_3px_12px_rgba(255,107,0,0.45)]"
                : "bg-secondary/10 text-secondary hover:bg-secondary hover:text-white hover:shadow-[0_3px_12px_rgba(255,107,0,0.35)] hover:scale-[1.04]"
            }`}
          >
            <Flame className="size-3.5 shrink-0 group-hover:animate-bounce" aria-hidden="true" />
            <span>Khuyến mãi HOT</span>
            {/* Pulsing live dot */}
            <span className="relative flex size-2 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${pathname === "/" ? "bg-white" : "bg-secondary"}`} />
              <span className={`relative inline-flex rounded-full size-2 ${pathname === "/" ? "bg-white" : "bg-secondary"}`} />
            </span>
          </Link>

          {/* Mã giảm giá */}
          <Link
            href="/ma-giam-gia"
            className={`group flex items-center gap-1.5 px-3.5 py-1.5 my-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              pathname === "/ma-giam-gia"
                ? "bg-primary text-white shadow-[0_3px_10px_rgba(0,194,146,0.35)]"
                : "text-[#4F586D] hover:bg-primary/10 hover:text-primary hover:scale-[1.04]"
            }`}
          >
            <Tag className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Mã giảm giá</span>
          </Link>

          {/* Ưu đãi dịch vụ */}
          <Link
            href="/uu-dai-dich-vu"
            className={`group flex items-center gap-1.5 px-3.5 py-1.5 my-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              pathname === "/uu-dai-dich-vu"
                ? "bg-blue-500 text-white shadow-[0_3px_10px_rgba(59,130,246,0.35)]"
                : "text-[#4F586D] hover:bg-blue-500/10 hover:text-blue-600 hover:scale-[1.04]"
            }`}
          >
            <Percent className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Ưu đãi dịch vụ</span>
          </Link>

          <Link href="/affiliate" className={`${navLinkClass("/affiliate")} hidden md:flex ml-2`}>
            Affiliate
          </Link>
        </div>

        {/* Right nav */}
        <div className="hidden md:flex items-center gap-5">
          <Link href="/about" className={navLinkClass("/about")}>
            Giới thiệu
          </Link>
          <Link href="/contact" className={navLinkClass("/contact")}>
            Liên hệ
          </Link>
        </div>
      </div>
      </div>
    </nav>
  )
}
