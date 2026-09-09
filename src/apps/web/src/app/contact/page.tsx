"use client"

import { useActionState } from "react"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

interface FormState {
  success: boolean
  message: string
  errors: { name?: string; email?: string; message?: string }
}

async function submitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const message = formData.get("message") as string

  const errors: FormState["errors"] = {}
  if (!name || name.trim().length < 2) errors.name = "Nama minimal 2 karakter"
  if (!email || !email.includes("@")) errors.email = "Email tidak valid"
  if (!message || message.trim().length < 10) errors.message = "Pesan minimal 10 karakter"

  if (Object.keys(errors).length) {
    return { success: false, message: "", errors }
  }

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
    })
    const json = await res.json()
    if (res.ok) {
      return { success: true, message: json.message, errors: {} }
    }
    return { success: false, message: json.error || "Gagal mengirim pesan", errors: {} }
  } catch {
    return { success: false, message: "Terjadi kesalahan. Silakan coba lagi.", errors: {} }
  }
}

export default function ContactPage() {
  const [state, action, pending] = useActionState(submitAction, { success: false, message: "", errors: {} })

  return (
    <>
      <Navbar />
      <main className="flex-grow w-full max-w-[600px] mx-auto px-4 md:px-8 pt-28 pb-16">
        <div className="bg-white border border-[#e5e1d8] p-8 md:p-12" style={{ clipPath: "polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)" }}>
          <div className="text-center mb-10">
            <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-primary uppercase text-pretty">
              Hubungi Kami
            </h1>
            <p className="font-mono text-label-mono text-[#5c403a] mt-2">Ada pertanyaan? Kami siap membantu.</p>
            <div className="w-16 h-1 bg-primary mx-auto mt-4" />
          </div>

          {state.success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 font-mono text-[13px] rounded" role="status">
              {state.message}
            </div>
          )}

          <form className="space-y-6" action={action}>
            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="name">Nama</label>
              <input id="name" name="name" type="text" required aria-invalid={!!state.errors.name} aria-describedby={state.errors.name ? "name-error" : undefined} disabled={pending} className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] text-[#1a1c1b] focus:border-ink focus:ring-0 focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50" />
              {state.errors.name && <p id="name-error" className="font-mono text-[12px] text-red-600 mt-1" role="alert">{state.errors.name}</p>}
            </div>
            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" aria-invalid={!!state.errors.email} aria-describedby={state.errors.email ? "email-error" : undefined} disabled={pending} className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] text-[#1a1c1b] focus:border-ink focus:ring-0 focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50" />
              {state.errors.email && <p id="email-error" className="font-mono text-[12px] text-red-600 mt-1" role="alert">{state.errors.email}</p>}
            </div>
            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="message">Pesan</label>
              <textarea id="message" name="message" rows={4} required aria-invalid={!!state.errors.message} aria-describedby={state.errors.message ? "message-error" : undefined} disabled={pending} className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] text-[#1a1c1b] focus:border-ink focus:ring-0 focus-visible:ring-2 focus-visible:ring-ink resize-none disabled:opacity-50" />
              {state.errors.message && <p id="message-error" className="font-mono text-[12px] text-red-600 mt-1" role="alert">{state.errors.message}</p>}
            </div>
            {!state.success && state.message && !Object.keys(state.errors).length && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded font-mono text-[13px]" role="alert">{state.message}</div>
            )}
            <button type="submit" disabled={pending} aria-busy={pending} className="w-full bg-primary text-ink py-4 font-bold rounded-full brutalist-shadow text-sm uppercase tracking-wider mt-4 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {pending ? "Mengirim..." : "Kirim Pesan"}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-dashed border-[#e5e1d8] text-center space-y-1">
            <p className="font-sans text-[14px] text-[#5c403a]">Atau kirim email ke</p>
            <a href="mailto:hello@shopby.com" className="font-mono text-[14px] text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-primary">hello@shopby.com</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
