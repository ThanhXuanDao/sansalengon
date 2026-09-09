export default function Loading() {
  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 h-16 bg-bg/95 border-b border-border-color flex items-center px-4 md:px-8">
        <div className="flex items-center gap-4 w-full justify-between">
          <div className="h-7 skeleton-shimmer w-24" />
          <div className="hidden md:flex items-center gap-6">
            <div className="h-4 skeleton-shimmer w-12" />
            <div className="h-4 skeleton-shimmer w-16" />
          </div>
        </div>
      </nav>

      <header className="pt-32 pb-20 px-4 md:px-8 max-w-[1200px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="h-12 skeleton-shimmer w-3/4" />
            <div className="h-12 skeleton-shimmer w-1/2" />
            <div className="h-5 skeleton-shimmer w-2/3 mt-4" />
            <div className="h-14 skeleton-shimmer w-48 mt-6 rounded-full" />
          </div>
          <div className="relative h-[400px] hidden md:block">
            <div className="absolute top-10 right-10 w-64 receipt-card p-4 -rotate-[3deg] z-10" style={{ background: "white", clipPath: "polygon(10px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 10px)" }}>
              <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-bg border border-border-color z-20" />
              <div className="mt-8">
                <div className="w-full h-40 skeleton-shimmer mb-4" />
                <div className="h-3 skeleton-shimmer w-16 mb-2" />
                <div className="h-4 skeleton-shimmer w-36" />
              </div>
              <div className="pt-4 flex justify-between items-end border-t border-dashed border-border-color mt-3">
                <div className="h-6 skeleton-shimmer w-20" />
                <div className="size-5 skeleton-shimmer" />
              </div>
            </div>
            <div className="absolute bottom-10 left-10 w-64 receipt-card p-4 rotate-[2deg] z-0" style={{ background: "white", clipPath: "polygon(10px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 10px)" }}>
              <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-bg border border-border-color z-20" />
              <div className="mt-8">
                <div className="w-full h-40 skeleton-shimmer mb-4" />
                <div className="h-3 skeleton-shimmer w-16 mb-2" />
                <div className="h-4 skeleton-shimmer w-36" />
              </div>
              <div className="pt-4 flex justify-between items-end border-t border-dashed border-border-color mt-3">
                <div className="h-6 skeleton-shimmer w-20" />
                <div className="size-5 skeleton-shimmer" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-8 py-12">
        <div className="flex md:hidden gap-2 pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-nav-${i}`} className="h-8 skeleton-shimmer rounded-full shrink-0" style={{ width: `${70 + i * 20}px` }} />
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-8 mt-3 md:mt-0">
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white border-r border-dashed border-border-color p-4">
              <div className="mb-6">
                <div className="h-6 skeleton-shimmer w-24 mb-2" />
                <div className="h-3 skeleton-shimmer w-16" />
              </div>
              <ul className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={`sk-side-${i}`}><div className="h-10 skeleton-shimmer w-full" /></li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="flex-grow">
            <div className="mb-12">
              <div className="h-6 skeleton-shimmer w-48 mb-6" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`sk-feat-${i}`} className="receipt-card p-3" style={{ clipPath: "polygon(10px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 10px)" }}>
                    <div className="h-48 skeleton-shimmer w-full mb-3" />
                    <div className="h-3 skeleton-shimmer w-1/4 mb-2" />
                    <div className="h-4 skeleton-shimmer w-3/4" />
                    <div className="mt-3 pt-3 border-t border-dashed border-border-color space-y-2">
                      <div className="h-6 skeleton-shimmer w-1/3" />
                      <div className="h-8 skeleton-shimmer w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-6 skeleton-shimmer w-32 mb-6" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`sk-all-${i}`} className="receipt-card p-3" style={{ clipPath: "polygon(10px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 10px)" }}>
                  <div className="h-32 skeleton-shimmer w-full mb-3" />
                  <div className="h-4 skeleton-shimmer w-2/3" />
                  <div className="mt-3 pt-3 border-t border-dashed border-border-color space-y-2">
                    <div className="h-6 skeleton-shimmer w-1/3" />
                    <div className="h-8 skeleton-shimmer w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full mt-20 border-t-2 border-dashed border-border-color py-8 px-4 md:px-8 bg-[#e8e8e5]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="h-4 skeleton-shimmer w-16" />
            <div className="h-3 skeleton-shimmer w-72" />
            <div className="h-3 skeleton-shimmer w-48" />
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`sk-foot-${i}`} className="h-3 skeleton-shimmer w-20" />
            ))}
          </div>
        </div>
      </footer>
    </>
  )
}