export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] p-4" aria-busy="true" role="status">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 border-2 border-[#e5e1d8] border-t-[#b51c00] rounded-full animate-spin" />
        <p className="font-mono text-[13px] text-[#5c403a]">Loading…</p>
      </div>
    </div>
  )
}
