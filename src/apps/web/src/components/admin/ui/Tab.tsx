"use client"

import { createContext, useContext, type ReactNode } from "react"

interface TabsContextValue {
  active: string
  onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export function Tabs({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <TabsContext.Provider value={{ active: value, onChange }}>
      {children}
    </TabsContext.Provider>
  )
}

export function TabList({ children }: { children: ReactNode }) {
  return (
    <div className="flex border-b border-[#e5e1d8]" role="tablist">
      {children}
    </div>
  )
}

export function TabTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error("TabTrigger must be inside Tabs")
  const isActive = ctx.active === value
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onChange(value)}
      className={`px-5 py-3 font-mono text-[13px] border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b51c00] ${
        isActive
          ? "border-[#b51c00] text-[#b51c00] font-bold"
          : "border-transparent text-[#5c403a] hover:text-[#1a1c1b]"
      }`}
    >
      {children}
    </button>
  )
}

export function TabContent({
  value,
  children,
}: {
  value: string
  children: ReactNode
}) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error("TabContent must be inside Tabs")
  if (ctx.active !== value) return null
  return <div role="tabpanel">{children}</div>
}
