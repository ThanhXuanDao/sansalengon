"use client"

import Link from "next/link"
import { useState, useRef, useEffect, useCallback } from "react"
import { Search, X } from "lucide-react"
import { useSettings } from "@/hooks/useSettings"

interface NavbarProps {
  onSearch?: (q: string) => void
  searchQuery?: string
}

export default function Navbar({ onSearch, searchQuery = "" }: NavbarProps) {
  const [active, setActive] = useState("deals")
  const [inputValue, setInputValue] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: settings } = useSettings()

  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch?.(value)
      }, 300)
    },
    [onSearch]
  )

  const handleClear = useCallback(() => {
    setInputValue("")
    onSearch?.("")
    inputRef.current?.focus()
  }, [onSearch])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current && !inputValue) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [inputValue])

  const linkClass = (id: string) =>
    id === active
      ? "text-primary font-bold border-b-2 border-primary focus-visible:ring-2 focus-visible:ring-primary"
      : "text-ink/60 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary"

  return (
    <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-8 py-2 h-16 bg-bg/95 backdrop-blur-sm border-b border-border-color">
      <div className="flex items-center gap-4 shrink-0">
        {settings?.logo && (
          <img src={settings.logo} alt="" className="size-8 rounded-full object-cover border border-border-color" aria-hidden="true" />
        )}
        <span className="font-sans text-headline-md md:text-display-lg-mobile uppercase tracking-tighter text-primary" translate="no">
          {settings?.storeName || "Shopby"}
        </span>
      </div>
      <div className="flex items-center gap-4 flex-1 max-w-lg ml-4 md:ml-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink/40 pointer-events-none" aria-hidden="true" />
          <input
            ref={inputRef}
            id="navbar-search"
            name="q"
            type="search"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Cari produk, kategori..."
            aria-label="Cari produk"
            autoComplete="off"
            className="w-full bg-[#f4f4f1] border border-border-color rounded-full pl-9 pr-8 py-2 font-sans text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors"
          />
          {inputValue && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="hidden md:flex items-center gap-6 shrink-0">
          <Link
            href="/#products"
            onClick={() => setActive("deals")}
            className={linkClass("deals")}
          >
            Deals
          </Link>
          <Link
            href="/#categories"
            onClick={() => setActive("kategori")}
            className={linkClass("kategori")}
          >
            Kategori
          </Link>
        </div>
      </div>
    </nav>
  )
}