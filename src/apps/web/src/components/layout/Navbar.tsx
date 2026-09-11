"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useRef, useEffect, useCallback } from "react"
import { Search, X, ChevronDown, Phone, User, Tag } from "lucide-react"
import { useSettings } from "@/hooks/useSettings"
import { NICHES } from "@/lib/niches"

interface NavbarProps {
  onSearch?: (q: string) => void
  searchQuery?: string
}

export default function Navbar({ onSearch, searchQuery = "" }: NavbarProps) {
  const [activeNav, setActiveNav] = useState("")
  const [inputValue, setInputValue] = useState(searchQuery)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [logoError, setLogoError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const catRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCategoryOpen(false)
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  const navLinkClass = (id: string) =>
    `relative flex items-center gap-1 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
      activeNav === id
        ? "text-secondary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-secondary after:rounded-full"
        : "text-[#4F586D] hover:text-secondary"
    }`

  const storeName = settings?.siteName || "Săn Sale Ngon"

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>

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
            <div className="flex items-center gap-1.5 h-11">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <Tag className="size-4 text-white" aria-hidden="true" />
              </div>
              <div className="leading-tight">
                <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-tight">Săn Sale</div>
                <div className="text-[10px] font-semibold text-[#1C1C4D] uppercase tracking-wider">Ngon</div>
              </div>
            </div>
          ) : (
            <Image
              src="/logo.png"
              alt={storeName}
              width={160}
              height={56}
              className="h-11 w-auto object-contain"
              priority
              onError={() => setLogoError(true)}
            />
          )}
        </Link>

        {/* Search bar — no overflow-hidden so dropdown isn't clipped */}
        <div className="flex flex-1 border border-[#DFE0E4] rounded-lg focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(0,194,146,0.12)] transition-all">
          {/* Category dropdown */}
          <div className="relative shrink-0" ref={catRef}>
            <button
              type="button"
              onClick={() => setCategoryOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-[#4F586D] bg-[#F5F5F5] border-r border-[#DFE0E4] whitespace-nowrap hover:bg-[#EBECEF] transition-colors h-full rounded-l-lg"
              aria-expanded={categoryOpen}
              aria-haspopup="listbox"
            >
              <span className="hidden sm:inline">
                {selectedCategory ? NICHES.find((n) => n.id === selectedCategory)?.name ?? "Tất cả" : "Danh mục"}
              </span>
              <ChevronDown className={`size-3.5 transition-transform ${categoryOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {categoryOpen && (
              <ul
                role="listbox"
                className="absolute top-[calc(100%+4px)] left-0 bg-white border border-[#DFE0E4] shadow-xl min-w-[200px] py-1 z-[200] rounded-lg"
              >
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedCategory === ""}
                    onClick={() => { setSelectedCategory(""); setCategoryOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-[#4F586D] hover:bg-[#F5F5F5] hover:text-primary"
                  >
                    Tất cả danh mục
                  </button>
                </li>
                {NICHES.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedCategory === n.id}
                      onClick={() => { setSelectedCategory(n.id); setCategoryOpen(false) }}
                      className="w-full text-left px-4 py-2 text-sm text-[#4F586D] hover:bg-[#F5F5F5] hover:text-primary flex items-center gap-2"
                    >
                      <span aria-hidden="true">{n.emoji}</span>
                      {n.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
              className="w-full h-full px-4 py-2.5 text-sm text-[#222E48] placeholder:text-[#4F586D]/50 bg-white outline-none"
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
            className="bg-secondary hover:bg-[#e55f00] text-white px-5 py-2.5 text-sm font-semibold shrink-0 transition-colors flex items-center gap-2 rounded-r-lg"
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
          <Link
            href="/admin/login"
            className="p-2 text-[#4F586D] hover:text-primary hover:bg-[#F5F5F5] rounded-full transition-colors"
            aria-label="Đăng nhập quản trị"
          >
            <User className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      </div>

      {/* ─── Row 2: Navigation links ─── */}
      <div className="bg-white border-b border-[#DFE0E4]">
      <div className="max-w-[1320px] mx-auto px-3 flex items-center justify-between">
        {/* Left nav */}
        <div className="flex items-center gap-5">
          <Link href="/ma-giam-gia" onClick={() => setActiveNav("coupons")} className={navLinkClass("coupons")}>
            Mã giảm giá
          </Link>

          <Link href="/affiliate" onClick={() => setActiveNav("affiliate")} className={`${navLinkClass("affiliate")} hidden md:flex`}>
            Affiliate
          </Link>
        </div>

        {/* Right nav */}
        <div className="hidden md:flex items-center gap-5">
          <Link href="/about" onClick={() => setActiveNav("about")} className={navLinkClass("about")}>
            Giới thiệu
          </Link>
          <Link href="/contact" onClick={() => setActiveNav("contact")} className={navLinkClass("contact")}>
            Liên hệ
          </Link>
        </div>
      </div>
      </div>
    </nav>
  )
}
