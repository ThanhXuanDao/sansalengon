"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Mail, MapPin, Phone, Share2, Play, Send } from "lucide-react"
import { useSettings } from "@/hooks/useSettings"

interface NicheItem { id: string; name: string; emoji: string }
interface NavLink { id: string; slug: string; title: string }
type NavData = Record<string, NavLink[]>

function pageHref(slug: string) {
  return `/p/${slug}`
}

const FOOTER_STATS = [
  { target: 500, suffix: "+", label: "Sản phẩm" },
  { target: 10,  suffix: "K+", label: "Người dùng" },
  { target: 50,  suffix: "K+", label: "Lượt xem" },
]

const QUICK_LINKS_DEFAULT = [
  { href: "/", label: "Trang chủ" },
  { href: "/ma-giam-gia", label: "Mã giảm giá" },
  { href: "/contact", label: "Liên hệ" },
]

const SOCIAL = [
  { href: "#", label: "Facebook", icon: Share2 },
  { href: "#", label: "YouTube", icon: Play },
  { href: "#", label: "Telegram", icon: Send },
]

export default function Footer() {
  const [niches, setNiches] = useState<NicheItem[]>([])
  const [nav, setNav] = useState<NavData>({})
  const { data: settings } = useSettings()
  const [counts, setCounts] = useState(FOOTER_STATS.map(() => 0))
  const statsRef = useRef<HTMLDivElement>(null)
  const animated = useRef(false)

  useEffect(() => {
    fetch("/api/niches")
      .then((r) => r.json())
      .then((json) => { if (Array.isArray(json?.data)) setNiches(json.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/nav")
      .then((r) => r.json())
      .then((data: NavData) => { if (data && typeof data === "object") setNav(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || animated.current) return
      animated.current = true
      const duration = 1400
      const start = performance.now()
      function step(now: number) {
        const p = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setCounts(FOOTER_STATS.map((s) => Math.round(s.target * ease)))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      obs.disconnect()
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const limit = settings?.footerCategoryLimit ?? 0
  const visibleNiches = limit > 0 ? niches.slice(0, limit) : niches

  const quickLinks = nav.footer_col2?.length
    ? nav.footer_col2.map((p) => ({ href: pageHref(p.slug), label: p.title }))
    : QUICK_LINKS_DEFAULT

  const policyLinks = (nav.footer_bottom ?? []).map((p) => ({ href: pageHref(p.slug), label: p.title }))

  const col1Links = nav.footer_col1 ?? []
  const col3Links = nav.footer_col3 ?? []
  const col4Links = nav.footer_col4 ?? []

  return (
    <footer className="w-full">

      {/* ─── Top accent bar ─── */}
      <div className="h-1 bg-gradient-to-r from-primary via-[#00a87d] to-secondary" />

      {/* ─── Main grid ─── */}
      <div className="bg-[#1C1C4D] text-white">
        <div className="max-w-[1320px] mx-auto px-3 pt-14 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Col 1 — Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-4" aria-label="Trang chủ">
              <Image
                src="/logo.png"
                alt="SanSaleNgon"
                width={180}
                height={68}
                className="max-w-[180px] h-[80%] object-contain"
              />
            </Link>
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              Tuyển chọn sản phẩm Shopee affiliate — giá tốt, minh bạch, cập nhật tự động.
            </p>

            {/* Stats */}
            <div ref={statsRef} className="grid grid-cols-3 gap-3 mb-6 p-4">
              {FOOTER_STATS.map(({ suffix, label }, i) => (
                <div key={label} className="text-center">
                  <div className="text-lg font-bold text-primary font-display tabular-nums">
                    {counts[i]}{suffix}
                  </div>
                  <div className="text-[10px] text-white/50 mt-0.5 leading-tight">{label}</div>
                </div>
              ))}
            </div>

            {/* Social */}
            <div className="flex items-center gap-2.5">
              {SOCIAL.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition-colors"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>

            {/* Dynamic col1 pages */}
            {col1Links.length > 0 && (
              <ul className="mt-5 space-y-2">
                {col1Links.map((p) => (
                  <li key={p.id}>
                    <Link href={pageHref(p.slug)} className="text-sm text-white/60 hover:text-primary transition-colors flex items-center gap-2 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors shrink-0" aria-hidden="true" />
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Col 2 — Quick links */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-5 text-white/80">
              Liên kết nhanh
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/60 hover:text-primary transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors shrink-0" aria-hidden="true" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Contact */}
            <div className="mt-7 space-y-2.5">
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-3 text-white/80">
                Liên hệ
              </h3>
              <div className="flex items-start gap-2.5 text-sm text-white/60">
                <Phone className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span>Hỗ trợ 24/7 — miễn phí</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-white/60">
                <Mail className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <a href="mailto:hello@sansalengon.vn" className="hover:text-primary transition-colors break-all">
                  hello@sansalengon.vn
                </a>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-white/60">
                <MapPin className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span>Việt Nam</span>
              </div>
            </div>
          </div>

          {/* Col 3 — Categories + dynamic col3 pages */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-5 text-white/80">
              Danh mục nổi bật
            </h3>
            <ul className="grid grid-cols-2 gap-2">
              {visibleNiches.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/${n.id}`}
                    className="text-sm text-white/60 hover:text-primary transition-colors flex items-center gap-1.5 group"
                  >
                    <span aria-hidden="true" className="text-base leading-none">{n.emoji}</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">{n.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {col3Links.length > 0 && (
              <ul className="mt-3 space-y-2">
                {col3Links.map((p) => (
                  <li key={p.id}>
                    <Link href={pageHref(p.slug)} className="text-sm text-white/60 hover:text-primary transition-colors flex items-center gap-2 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors shrink-0" aria-hidden="true" />
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Col 4 — Newsletter + dynamic col4 pages */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-3 text-white/80">
              Nhận thông báo
            </h3>
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              Đăng ký để nhận deal tốt và mã giảm giá mới nhất mỗi ngày.
            </p>
            <form
              action="/api/contact"
              method="POST"
              className="flex flex-col gap-3"
              aria-label="Đăng ký nhận thông báo"
            >
              <input
                type="email"
                name="email"
                placeholder="Email của bạn..."
                aria-label="Địa chỉ email"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary focus:bg-white/15 transition-all"
              />
              <button
                type="submit"
                className="w-full bg-primary hover:bg-[#00a87d] text-white font-semibold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="size-4" aria-hidden="true" />
                Đăng ký nhận deal
              </button>
            </form>
            <p className="text-xs text-white/30 mt-3">
              Không spam. Hủy bất cứ lúc nào.
            </p>

            {/* Trust badges */}
            <div className="mt-5 flex gap-2 flex-wrap">
              {["Bảo mật SSL", "Miễn phí 100%", "Cập nhật tự động"].map((b) => (
                <span
                  key={b}
                  className="text-[10px] text-primary border border-primary/30 px-2 py-0.5 rounded-full"
                >
                  ✓ {b}
                </span>
              ))}
            </div>
            {col4Links.length > 0 && (
              <ul className="mt-4 space-y-2">
                {col4Links.map((p) => (
                  <li key={p.id}>
                    <Link href={pageHref(p.slug)} className="text-sm text-white/60 hover:text-primary transition-colors flex items-center gap-2 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors shrink-0" aria-hidden="true" />
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ─── Divider ─── */}
        <div className="border-t border-white/10" />

        {/* ─── Bottom bar ─── */}
        <div className="max-w-[1320px] mx-auto px-3 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            &copy; {new Date().getFullYear()} SanSaleNgon. All rights reserved. · Website tổng hợp deal Shopee affiliate.
          </p>
          <div className="flex items-center gap-4">
            {policyLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-white/40 hover:text-primary transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
