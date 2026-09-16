import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import { NicheProvider } from "@/lib/niche-context"
import { getActiveNiches } from "@/lib/niches"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const niches = await getActiveNiches()
  return (
    <NicheProvider niches={niches}>
      <Navbar />
      {children}
      <Footer />
    </NicheProvider>
  )
}
