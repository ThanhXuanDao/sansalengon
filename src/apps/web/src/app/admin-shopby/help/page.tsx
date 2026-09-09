import type { Metadata } from "next"
import Link from "next/link"
import { LifeBuoy, FileText, BookOpen, ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Panduan dan sumber daya untuk membantu Anda mengelola portal affiliate Shopby.",
}

export default function AdminHelpPage() {
  const resources = [
    {
      icon: BookOpen,
      title: "Getting Started Guide",
      desc: "Learn the basics of managing your affiliate links and dashboard.",
    },
    {
      icon: FileText,
      title: "Product Management",
      desc: "How to add, edit, and organize your affiliate products.",
    },
    {
      icon: LifeBuoy,
      title: "Analytics Overview",
      desc: "Understand your clicks, conversions, and commission data.",
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-[#1a1c1b]">
          Help Center
        </h2>
        <p className="font-sans text-[16px] leading-[24px] text-[#5c403a] mt-2">
          Resources and guides to help you manage your Shopby affiliate portal.
        </p>
      </div>

      <div className="grid gap-6">
        {resources.map((r) => {
          const Icon = r.icon
          return (
            <div key={r.title} className="bg-white border border-[#e5e1d8] p-6 hover:bg-[#f4f4f1] transition-colors cursor-pointer" style={{ clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)" }}>
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-[#FFC93C] flex items-center justify-center shrink-0">
                  <Icon className="size-5 text-[#6f5400]" />
                </div>
                <div>
                  <h3 className="font-sans text-[18px] font-bold text-[#1a1c1b]">{r.title}</h3>
                  <p className="font-sans text-[14px] text-[#5c403a] mt-1">{r.desc}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white border border-[#e5e1d8] p-6 text-center" style={{ clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)" }}>
        <h3 className="font-sans text-[18px] font-bold text-[#1a1c1b]">Still need help?</h3>
        <p className="font-sans text-[14px] text-[#5c403a] mt-1">Contact us for personalized support.</p>
        <a href="mailto:support@shopby.com" className="inline-flex items-center gap-2 mt-4 font-mono text-[13px] tracking-[0.05em] text-[#b51c00] hover:underline">
          support@shopby.com
          <ExternalLink className="size-4" />
        </a>
      </div>

      <div className="text-center pt-4">
        <Link href="/admin-shopby" className="font-mono text-[13px] tracking-[0.05em] text-[#5c403a] hover:text-[#1a1c1b] underline decoration-dashed underline-offset-4 transition-colors">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
