"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Link2, MousePointerClick, Wallet } from "lucide-react"
import { fetchStats, fetchAnalytics } from "@/lib/services/products"
import { formatPrice } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { StatCard, SegmentedControl, useToast } from "@/components/admin/ui"

type Period = "all" | "month" | "week" | "year"

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: "Tất cả", value: "all" },
  { label: "Năm nay", value: "year" },
  { label: "Tháng này", value: "month" },
  { label: "Tuần này", value: "week" },
]

export default function AdminDashboard() {
  const { error: toastError } = useToast()
  const [period, setPeriod] = useState<Period>("all")
  const [loading, setLoading] = useState(true)

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

  const [revenueData, setRevenueData] = useState<{ day: string; clicks: number; conversions: number; revenue: number }[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStats(period), fetchAnalytics(period)])
      .then(([stats, analytics]) => {
        setStatsData(stats)
        setRevenueData(analytics.revenueData || [])
      })
      .catch(() => toastError("Không thể tải dữ liệu. Vui lòng thử lại."))
      .finally(() => setLoading(false))
  }, [period])

  const topProducts = (statsData?.topProducts ?? [])
    .filter((p) => p.clicks > 0)
    .slice(0, 7)

  const maxClicks = revenueData.length > 0 ? Math.max(...revenueData.map((d) => d.clicks), 1) : 1
  const maxRev = revenueData.length > 0 ? Math.max(...revenueData.map((d) => d.revenue), 1) : 1

  return (
    <div className="flex flex-col gap-8 flex-1 min-h-0 overflow-y-auto">

      <AdminPageShell
        title="Tổng quan"
        subtitle={new Date().toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" })}
        actions={
          <SegmentedControl
            value={period}
            options={PERIOD_OPTIONS}
            onChange={setPeriod}
          />
        }
      />

      {/* Stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tổng sản phẩm"
          value={statsData ? String(statsData.totalProducts) : "—"}
          sub={statsData ? `${statsData.activeProducts} đang bán · ${statsData.soldOut} hết hàng` : ""}
          icon={Link2}
          loading={loading}
        />
        <StatCard
          label="Lượt nhấp"
          value={statsData ? statsData.totalClicks.toLocaleString("vi-VN") : "—"}
          sub="Tổng lượt click affiliate"
          icon={MousePointerClick}
          loading={loading}
        />
        <StatCard
          label="Doanh thu ước tính"
          value={statsData ? formatPrice(statsData.totalSales || 0) : "0₫"}
          sub={statsData ? `Hoa hồng TB: ${formatPrice(statsData.avgCommission || 0)}` : ""}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          label="TB mỗi lượt nhấp"
          value={statsData && statsData.totalClicks > 0
            ? formatPrice(Math.round(statsData.totalSales / statsData.totalClicks))
            : "0₫"}
          sub="Hoa hồng trên mỗi click"
          icon={Wallet}
          loading={loading}
        />
      </section>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Bar chart — clicks */}
        <section className="lg:col-span-3 bg-white border border-[#e5e1e9] p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-sans text-base font-bold text-[#1a1c1b]">Lượt nhấp theo ngày</h3>
            <div className="flex gap-4 text-xs text-[#5c403a]">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#b51c00] inline-block" />Nhấp</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#FFC93C] inline-block" />Chuyển đổi</span>
            </div>
          </div>
          {loading ? (
            <div className="h-52 bg-[#f4f4f1] animate-pulse rounded" />
          ) : revenueData.length > 0 ? (
            <>
              <div className="relative h-52 w-full bg-[#FAFAF7] border border-[#e5beb6] flex items-end px-3 pb-2 gap-1">
                {revenueData.map((d) => (
                  <div key={d.day} className="flex-1 flex items-end gap-0.5 h-full pt-2">
                    <div
                      className="w-1/2 bg-[#b51c00] hover:opacity-80 transition-opacity rounded-t-sm"
                      style={{ height: `${(d.clicks / maxClicks) * 90}%` }}
                      title={`${d.clicks} lượt nhấp`}
                    />
                    <div
                      className="w-1/2 bg-[#FFC93C] hover:opacity-80 transition-opacity rounded-t-sm"
                      style={{ height: `${(d.conversions / maxClicks) * 90}%` }}
                      title={`${d.conversions} chuyển đổi`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1.5 px-1 text-[11px] text-[#5c403a]">
                {revenueData.map((d) => <span key={d.day}>{d.day}</span>)}
              </div>
            </>
          ) : (
            <div className="h-52 flex items-center justify-center bg-[#FAFAF7] border border-[#e5beb6] text-sm text-[#5c403a]">
              Chưa có dữ liệu — sẽ hiển thị sau khi có lượt nhấp
            </div>
          )}
        </section>

        {/* Line chart — revenue */}
        <section className="lg:col-span-2 bg-white border border-[#e5e1e9] p-5">
          <h3 className="font-sans text-base font-bold text-[#1a1c1b] mb-4">Doanh thu ước tính</h3>
          {loading ? (
            <div className="h-52 bg-[#f4f4f1] animate-pulse rounded" />
          ) : revenueData.length > 0 ? (
            <svg className="w-full h-52" viewBox="0 0 300 200" preserveAspectRatio="none">
              {[50, 100, 150].map((y) => (
                <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#e5beb6" strokeDasharray="4" strokeWidth="1" />
              ))}
              <path
                d={revenueData.map((d, i) => {
                  const x = 10 + i * (280 / Math.max(revenueData.length - 1, 1))
                  const y = 180 - (d.revenue / maxRev) * 160
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`
                }).join(" ")}
                stroke="#b51c00"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {revenueData.map((d, i) => {
                const x = 10 + i * (280 / Math.max(revenueData.length - 1, 1))
                const y = 180 - (d.revenue / maxRev) * 160
                return <circle key={i} cx={x} cy={y} r="3" fill="#b51c00" />
              })}
            </svg>
          ) : (
            <div className="h-52 flex items-center justify-center bg-[#FAFAF7] border border-[#e5beb6] text-sm text-[#5c403a]">
              Chưa có dữ liệu
            </div>
          )}
        </section>
      </div>

      {/* Top products */}
      <section className="bg-white border border-[#e5e1e9] overflow-hidden flex flex-col grow">
        <div className="p-4 border-b border-[#e5e1e9] bg-[#f4f4f1] flex justify-between items-center">
          <h3 className="font-sans text-base font-bold text-[#1a1c1b]">Sản phẩm nổi bật</h3>
          <span className="text-xs text-[#5c403a]">Top theo lượt nhấp</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-[#f4f4f1] animate-pulse rounded" />
            ))}
          </div>
        ) : topProducts.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e1e9] text-xs text-[#5c403a] uppercase">
                <th className="text-left p-3 font-semibold">Sản phẩm</th>
                <th className="text-left p-3 font-semibold hidden sm:table-cell">Danh mục</th>
                <th className="text-right p-3 font-semibold">Lượt nhấp</th>
                <th className="text-right p-3 font-semibold">Hoa hồng</th>
                <th className="text-right p-3 font-semibold">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.id} className={`border-b border-dashed border-[#e5e1e9] hover:bg-[#FAFAF7] transition-colors ${i % 2 === 1 ? "bg-[#f9f9f6]" : ""}`}>
                  <td className="p-3 font-medium text-[#1a1c1b] max-w-[200px] truncate">
                    <span className="text-xs text-[#5c403a] mr-2">{i + 1}.</span>
                    {p.name}
                  </td>
                  <td className="p-3 text-[#5c403a] hidden sm:table-cell">{p.category}</td>
                  <td className="p-3 text-right tabular-nums">{p.clicks.toLocaleString("vi-VN")}</td>
                  <td className="p-3 text-right tabular-nums text-[#b51c00]">{formatPrice(p.commission)}</td>
                  <td className="p-3 text-right tabular-nums font-bold">{formatPrice(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-sm text-[#5c403a]">
            Chưa có dữ liệu — sẽ hiển thị sau khi sản phẩm nhận được lượt nhấp
          </div>
        )}
      </section>

    </div>
  )
}
