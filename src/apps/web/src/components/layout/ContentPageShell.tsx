interface ContentPageShellProps {
  title: string
  subtitle?: string
  /** "md" = 800px (default), "sm" = 600px cho các trang form/contact */
  width?: "sm" | "md"
  children: React.ReactNode
}

export default function ContentPageShell({
  title,
  subtitle,
  width = "md",
  children,
}: ContentPageShellProps) {
  return (
    <main
      className={`flex-grow w-full ${width === "sm" ? "max-w-[600px]" : "max-w-[800px]"} mx-auto px-4 md:px-8 pt-36 pb-16`}
    >
      <div
        className="bg-white border border-[#e5e1d8] p-8 md:p-12 clip-bevel-2xl"
      >
        <div className="text-center mb-10">
          <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-primary uppercase text-pretty">
            {title}
          </h1>
          {subtitle && (
            <p className="font-mono text-label-mono text-[#5c403a] mt-2">
              {subtitle}
            </p>
          )}
          <div className="w-16 h-1 bg-primary mx-auto mt-4" />
        </div>
        {children}
      </div>
    </main>
  )
}
