"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  Link2,
  MousePointerClick,
  Wallet,
} from "lucide-react"
import { fetchStats, fetchAnalytics } from "@/lib/services/products"
import { formatPrice } from "@/lib/utils"

export default function AdminDashboard() {
  const [statsData, setStatsData] = useState<{
    totalSales: number
    totalProducts: number
    activeProducts: number
    soldOut: number
    totalClicks: number
    avgCommission: number
    recentClicks: { productName: string; clickedAt: string }[]
    topProducts: { id: string; name: string; clicks: number; commission: number; revenue: number; category: string }[]
  } | null>(null)
  const [period, setPeriod] = useState("all")

  const [revenueData, setRevenueData] = useState<{ day: string; clicks: number; conversions: number; revenue: number }[]>([])
  const [loading, setLoading] = useState(true)

  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setFetchError(null)
    Promise.all([fetchStats(period), fetchAnalytics(period)])
      .then(([stats, analytics]) => {
        setStatsData(stats)
        setRevenueData(analytics.revenueData || [])
      })
      .catch(() => {
        setStatsData(null)
        setRevenueData([])
        setFetchError("Failed to load dashboard data. Please try again.")
      })
      .finally(() => setLoading(false))
  }, [period])

  const statCards = [
    {
      label: "Total Products",
      value: statsData ? String(statsData.totalProducts) : "—",
      trend: statsData ? `${statsData.activeProducts} active | ${statsData.soldOut} sold out` : "",
      icon: Link2,
      color: "text-[#5d5b62]",
    },
    {
      label: "Total Clicks",
      value: statsData ? statsData.totalClicks.toLocaleString("id-ID") : "—",
      trend: statsData ? `${statsData.totalClicks} recorded clicks` : "",
      icon: MousePointerClick,
      color: "text-[#b51c00]",
    },
    {
      label: "Total Revenue",
      value: statsData ? formatPrice(statsData.totalSales || 0) : "Rp0",
      trend: statsData ? formatPrice(statsData.avgCommission || 0) + " est. commission" : "",
      icon: TrendingUp,
      color: "text-[#b51c00]",
    },
    {
      label: "Avg per Click",
      value: statsData && statsData.totalClicks > 0 ? formatPrice(Math.round(statsData.totalSales / statsData.totalClicks)) : "Rp0",
      trend: statsData ? `Approx. ${formatPrice(50000)} per click` : "",
      icon: Wallet,
      color: "text-[#1a1c1b]",
    },
  ]

  const topProducts = (statsData?.topProducts ?? [])
    .filter((p) => p.clicks > 0)
    .slice(0, 5)
    .map((p) => ({
      product: p.name,
      clicks: p.clicks.toLocaleString("id-ID"),
      commission: formatPrice(p.commission),
      revenue: formatPrice(p.revenue),
      status: p.clicks >= 10 ? "Active" : "New",
    }))

  const hasTopProducts = topProducts.length > 0

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-dashed border-[#e5beb6] pb-4">
        <div>
          <h2 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-[#1a1c1b]">
            Dashboard
          </h2>
          <p className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mt-1 uppercase">
            Report Date: {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <button onClick={() => setPeriod(period === "all" ? "week" : "all")} className="flex items-center gap-2 font-mono text-[13px] leading-[16px] tracking-[0.05em] border border-[#e5e1e9] px-3 py-2 hover:bg-[#f4f4f1] transition-colors active:translate-x-0.5 active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
          <TrendingUp className="size-[18px]" aria-hidden="true" />
          {period === "all" ? "All Time" : "This Week"}
        </button>
      </div>

      {fetchError && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a] rounded px-4 py-3 font-mono text-[13px] leading-[16px] text-[#ba1a1a]" role="alert" aria-live="polite">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="space-y-8" aria-busy="true">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#e5e1e9] p-5 pl-8 animate-pulse">
                <div className="h-4 bg-[#e2e3e0] rounded w-2/3 mb-4" />
                <div className="h-8 bg-[#e2e3e0] rounded w-1/2" />
              </div>
            ))}
          </section>
          <div className="flex items-center justify-center">
            <p className="font-mono text-[13px] text-[#5c403a]">Loading dashboard data…</p>
          </div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="bg-white border border-[#e5e1e9] p-5 pl-8 flex flex-col gap-2 hover:bg-[#f4f4f1] transition-all hover:scale-[1.02] hover:shadow-lg"
                >
                  <span className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] uppercase">
                    {stat.label}
                  </span>
                  <span className="font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#1a1c1b] mt-2">
                    {stat.value}
                  </span>
                  {stat.trend && (
                    <div className={`flex items-center gap-1 font-sans text-[12px] leading-[16px] font-medium ${stat.color} mt-1`}>
                      <Icon className="size-[14px]" aria-hidden="true" />
                      <span>{stat.trend}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b]">
                  Click Activity
                </h3>
                <div className="flex gap-2 items-center">
                  <span className="size-3 bg-[#b51c00] inline-block" />
                  <span className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] uppercase">Revenue</span>
                </div>
              </div>
              <div className="border border-[#e5e1e9] bg-[#f9f9f6] p-4 flex-1 min-h-[300px] relative">
                {revenueData.length > 0 ? (
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 300">
                    {[50, 125, 200, 275].map((y) => (
                      <line key={y} className="stroke-[#e5beb6] stroke-dashed" x1="0" x2="800" y1={y} y2={y} />
                    ))}
                    <text fill="#5c403a" fontFamily="JetBrains Mono" fontSize="12" x="10" y="45">{formatPrice(Math.max(...revenueData.map(d => d.revenue), 1))}</text>
                    <text fill="#5c403a" fontFamily="JetBrains Mono" fontSize="12" x="10" y="120">{formatPrice(Math.round(Math.max(...revenueData.map(d => d.revenue), 1) * 2/3))}</text>
                    <text fill="#5c403a" fontFamily="JetBrains Mono" fontSize="12" x="10" y="195">{formatPrice(Math.round(Math.max(...revenueData.map(d => d.revenue), 1) * 1/3))}</text>
                    <text fill="#5c403a" fontFamily="JetBrains Mono" fontSize="12" x="10" y="270">0</text>
                    {revenueData.map((d, i) => {
                      const x = 80 + i * (600 / Math.max(revenueData.length - 1, 1))
                      return (
                        <text key={d.day} fill="#5c403a" fontFamily="JetBrains Mono" fontSize="12" x={x - 15} y="295">{d.day}</text>
                      )
                    })}
                    <path className="stroke-[#FF4D2D] fill-none stroke-[3]" d={
                      revenueData.map((d, i) => {
                        const x = 80 + i * (600 / Math.max(revenueData.length - 1, 1))
                        const maxRev = Math.max(...revenueData.map(r => r.revenue), 1)
                        const y = 275 - (d.revenue / maxRev) * 225
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`
                      }).join(" ")
                    } />
                    {revenueData.map((d, i) => {
                      const x = 80 + i * (600 / Math.max(revenueData.length - 1, 1))
                      const maxRev = Math.max(...revenueData.map(r => r.revenue), 1)
                      const y = 275 - (d.revenue / maxRev) * 225
                      return <circle key={i} cx={x} cy={y} fill="#FF4D2D" r="4" />
                    })}
                  </svg>
                ) : (
                  <div className="flex items-center justify-center h-full font-mono text-[13px] text-[#5c403a]" role="status">
                    <div className="text-center">
                      <MousePointerClick className="size-10 mx-auto text-[#5c403a]/40 mb-2" aria-hidden="true" />
                      <p>No click data recorded yet</p>
                      <p className="font-mono text-[11px] text-[#906f69] mt-1">Activity will appear after products receive clicks</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="lg:col-span-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b]">
                  Top Products
                </h3>
              </div>
              <div className="border border-[#e5e1e9] bg-[#f9f9f6] flex-1 overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] p-3 border-b border-[#e5e1e9] bg-[#f4f4f1] font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] uppercase text-xs">
                  <div>Product</div>
                  <div className="text-right">Clicks</div>
                  <div className="text-right">Komisi</div>
                  <div className="text-right">Revenue</div>
                </div>
                {hasTopProducts ? (
                  <ul className="flex flex-col">
                    {topProducts.map((item, i) => (
                      <li
                        key={i}
                        className={`grid grid-cols-[2fr_1fr_1fr_1fr] p-3 border-b border-dashed border-[#e5e1e9] items-center hover:bg-[#f4f4f1] transition-colors ${i % 2 === 1 ? "bg-[#f4f4f1]/50" : ""}`}
                      >
                        <div className="truncate pr-2 font-sans text-[14px] font-bold text-[#1a1c1b]">{item.product}</div>
                        <div className="text-right font-mono text-[14px] text-[#1a1c1b]">{item.clicks}</div>
                        <div className="text-right font-mono text-[14px] text-[#b51c00]">{item.commission}</div>
                        <div className="text-right font-mono text-[14px] text-[#1a1c1b] font-bold">{item.revenue}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center justify-center flex-1 min-h-[200px] p-6" role="status">
                    <div className="text-center">
                      <p className="font-mono text-[13px] text-[#5c403a]">No click data</p>
                      <p className="font-mono text-[11px] text-[#906f69] mt-1">Top products appear when clicks are recorded</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}