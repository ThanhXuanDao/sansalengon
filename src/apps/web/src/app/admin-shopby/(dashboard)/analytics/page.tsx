"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  Receipt,
  ShoppingCart,
  Calendar,
} from "lucide-react"
import { fetchAnalytics } from "@/lib/services/products"
import { formatPrice } from "@/lib/utils"

export default function AdminAnalytics() {
  const [data, setData] = useState<{
    totalRevenue: number
    aov: number
    conversionRate: number
    bounceRate: number
    totalClicks: number
    totalProducts: number
    revenueData: { day: string; clicks: number; conversions: number; revenue: number }[]
    topProducts: Record<string, { name: string; clicks: number; revenue: number; commission: number }>
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [analyticsPeriod, setAnalyticsPeriod] = useState("All Time")

  useEffect(() => {
    setLoading(true)
    fetchAnalytics(analyticsPeriod)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [analyticsPeriod])

  const metrics = [
    {
      label: "Total Clicks",
      value: data ? data.totalClicks.toLocaleString("id-ID") : "—",
      trend: data ? `${data.totalProducts} products tracked` : "",
      icon: ShoppingCart,
      trendIcon: TrendingUp,
      trendColor: "text-[#b51c00]",
    },
    {
      label: "Total Revenue",
      value: data ? formatPrice(data.totalRevenue || 0) : "Rp0",
      trend: "Est. from click data",
      icon: Wallet,
      trendIcon: TrendingUp,
      trendColor: "text-[#b51c00]",
    },
    {
      label: "Avg per Click",
      value: data && data.totalClicks > 0 ? formatPrice(Math.round(data.totalRevenue / data.totalClicks)) : "Rp0",
      trend: "Komisi per klik",
      icon: Receipt,
      trendIcon: Minus,
      trendColor: "text-[#5c403a]",
    },
    {
      label: "Komisi Terkumpul",
      value: data ? formatPrice(data.totalRevenue || 0) : "Rp0",
      trend: "Total dari semua produk",
      icon: Wallet,
      trendIcon: TrendingUp,
      trendColor: "text-[#b51c00]",
    },
  ]

  const barData = data?.revenueData ?? []

  const maxClicks = barData.length > 0 ? Math.max(...barData.map((d) => d.clicks), 1) : 1

  const topProducts = data?.topProducts
    ? Object.values(data.topProducts)
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
    : []

  const totalProductClicks = topProducts.reduce((sum, p) => sum + p.clicks, 0)
  const totalProductRevenue = topProducts.reduce((sum, p) => sum + p.revenue, 0)

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8" aria-busy="true">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-dashed border-[#e5beb6] pb-6">
          <div>
            <h2 className="font-sans text-[40px] leading-[48px] tracking-[-0.02em] font-extrabold text-[#1a1c1b] uppercase mb-1">Analytics</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#e5e1e9] p-5 animate-pulse">
              <div className="h-4 bg-[#e2e3e0] rounded w-2/3 mb-4" />
              <div className="h-8 bg-[#e2e3e0] rounded w-1/2" />
            </div>
          ))}
        </div>
        <p className="font-mono text-[13px] text-[#5c403a] text-center">Loading analytics…</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-dashed border-[#e5beb6] pb-6">
        <div>
          <h2 className="font-sans text-[40px] leading-[48px] tracking-[-0.02em] font-extrabold text-[#1a1c1b] uppercase mb-1">
            Analytics
          </h2>
          <p className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a]">
            Performance &amp; Metrics Overview
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#f4f4f1] border border-[#e5beb6] p-1 pl-3">
          <Calendar className="size-[18px] text-[#5c403a]" aria-hidden="true" />
          <select value={analyticsPeriod} onChange={(e) => setAnalyticsPeriod(e.target.value)} className="bg-transparent border-none font-mono text-[13px] text-[#1a1c1b] focus:ring-0 py-1.5 pl-1 pr-8 cursor-pointer">
            <option>All Time</option>
            <option>This Year</option>
            <option>This Month</option>
            <option>This Week</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon
          const TrendIcon = m.trendIcon
          return (
            <div key={m.label} className="bg-white border border-[#e5e1e9] p-5 pt-8 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] uppercase">{m.label}</span>
                <Icon className="size-5 text-[#b51c00]" aria-hidden="true" />
              </div>
              <div className="font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#1a1c1b] mb-2 mt-auto">{m.value}</div>
              {m.trend && (
                <div className={`flex items-center gap-1 font-sans text-[12px] leading-[16px] font-medium ${m.trendColor}`}>
                  <TrendIcon className="size-[14px]" aria-hidden="true" />
                  <span>{m.trend}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-white border border-[#e5e1e9] p-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-dashed border-[#e5beb6]">
          <h3 className="font-sans text-[20px] leading-[28px] font-bold uppercase">Clicks vs Conversions</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-[#b51c00] border border-[#1a1c1b]" />
              <span className="font-mono text-[13px] text-[#5c403a]">Clicks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-[#FFC93C] border border-[#1a1c1b]" />
              <span className="font-mono text-[13px] text-[#5c403a]">Conversions</span>
            </div>
          </div>
        </div>
        {barData.length > 0 ? (
          <>
            <div className="relative h-64 w-full bg-[#FAFAF7] border border-[#e5beb6] flex items-end p-4 gap-2">
              <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="w-full h-px bg-[#e5beb6] border-t border-dashed opacity-50" />
                ))}
              </div>
              {barData.map((d) => (
                <div key={d.day} className="flex-1 flex items-end gap-1 h-full">
                  <div className="w-1/2 bg-[#b51c00] transition-all hover:opacity-80" style={{ height: `${(d.clicks / maxClicks) * 100}%` }} title={`${d.clicks} clicks`} />
                  <div className="w-1/2 bg-[#FFC93C] transition-all hover:opacity-80" style={{ height: `${(d.conversions / maxClicks) * 100}%` }} title={`${d.conversions} conversions`} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-2 font-mono text-[13px] text-[#5c403a] opacity-70">
              {barData.map((d) => (
                <span key={d.day}>{d.day}</span>
              ))}
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center bg-[#FAFAF7] border border-[#e5beb6]" role="status">
            <div className="text-center">
              <p className="font-mono text-[13px] text-[#5c403a]">No click data yet</p>
              <p className="font-mono text-[11px] text-[#906f69] mt-1">Chart will populate once products receive clicks</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-[#e5e1e9] overflow-hidden">
          <div className="p-4 border-b border-[#e5e1e9] bg-[#f4f4f1]">
            <h3 className="font-sans text-[20px] leading-[28px] font-bold uppercase">Top Products</h3>
          </div>
          {topProducts.length > 0 ? (
            <ul className="flex flex-col">
              <li className="grid grid-cols-[2fr_1fr_1fr_1fr] p-3 border-b border-[#e5e1e9] bg-[#f4f4f1] font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] uppercase text-xs">
                <div>Product</div>
                <div className="text-right">Clicks</div>
                <div className="text-right">Komisi</div>
                <div className="text-right">Revenue</div>
              </li>
              {topProducts.map((p, i) => (
                <li key={p.name} className="grid grid-cols-[2fr_1fr_1fr_1fr] p-4 border-b border-dashed border-[#e5e1e9] hover:bg-[#FAFAF7] transition-colors hover:border-l-4 hover:border-[#b51c00] items-center">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[13px] font-bold text-[#1a1c1b] w-4">{i + 1}.</span>
                    <span className="font-sans text-[16px] leading-[24px] text-[#1a1c1b]">{p.name}</span>
                  </div>
                  <div className="text-right font-mono text-[14px] text-[#1a1c1b]">{p.clicks}</div>
                  <div className="text-right font-mono text-[14px] text-[#b51c00]">{formatPrice(p.commission)}</div>
                  <div className="text-right font-mono text-[14px] font-bold text-[#1a1c1b]">{formatPrice(p.revenue)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8" role="status">
              <p className="font-mono text-[13px] text-[#5c403a]">No click data yet</p>
              <p className="font-mono text-[11px] text-[#906f69] mt-2">Promote your products to start collecting analytics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}