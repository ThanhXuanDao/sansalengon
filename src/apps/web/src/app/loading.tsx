export default function Loading() {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* navbar placeholder */}
      <div className="h-[102px] md:h-[134px]" />
      {/* banner skeleton */}
      <div className="max-w-[1320px] mx-auto px-3 py-3 md:py-4">
        <div className="w-full aspect-[2/1] md:aspect-[10/3] skeleton-shimmer" />
      </div>
      {/* product grid skeleton */}
      <div className="max-w-[1320px] mx-auto px-3 pt-6 pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] skeleton-shimmer rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
