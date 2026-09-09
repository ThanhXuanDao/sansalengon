import { PackageOpen } from "lucide-react"

interface EmptyStateProps {
  categoryName?: string
  onReset?: () => void
}

export default function EmptyState({
  categoryName,
  onReset,
}: EmptyStateProps) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <PackageOpen className="size-12 text-muted-foreground mb-4" aria-hidden="true" />
      <h3 className="text-headline-md text-ink font-sans mb-2 text-pretty">
        Tidak Ada Produk
      </h3>
      <p className="text-body-md text-ink/60 max-w-sm mb-6">
        {categoryName
          ? `Belum ada produk di kategori "${categoryName}" saat ini.`
          : "Belum ada produk yang tersedia saat ini."}
      </p>
      {onReset && (
        <button
          onClick={onReset}
          className="bg-primary text-ink px-6 py-2 font-bold rounded-full brutalist-shadow text-sm uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-primary"
        >
          Lihat Semua Produk
        </button>
      )}
    </div>
  )
}
