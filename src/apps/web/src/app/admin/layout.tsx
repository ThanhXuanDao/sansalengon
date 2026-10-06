// All /admin routes are auth-gated and never statically generated.
export const dynamic = "force-dynamic"

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
