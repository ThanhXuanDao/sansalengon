"use client"

import { useActionState } from "react"
import ContentPageShell from "@/components/layout/ContentPageShell"
import ObfuscatedEmail from "@/components/ui/ObfuscatedEmail"

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
  if (!name || name.trim().length < 2) errors.name = "Họ tên tối thiểu 2 ký tự"
  if (!email || !email.includes("@")) errors.email = "Email không hợp lệ"
  if (!message || message.trim().length < 10) errors.message = "Tin nhắn tối thiểu 10 ký tự"

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
    if (res.ok) return { success: true, message: json.message, errors: {} }
    return { success: false, message: json.error || "Gửi tin nhắn thất bại", errors: {} }
  } catch {
    return { success: false, message: "Có lỗi xảy ra. Vui lòng thử lại.", errors: {} }
  }
}

export default function ContactPage() {
  const [state, action, pending] = useActionState(submitAction, {
    success: false,
    message: "",
    errors: {},
  })

  return (
    <ContentPageShell
      title="Liên hệ"
      subtitle="Có câu hỏi? Chúng tôi sẵn sàng giúp đỡ."
      width="sm"
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Liên hệ" }]}
    >
      {state.success && (
        <div
          className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 font-mono text-[13px] rounded"
          role="status"
        >
          {state.message}
        </div>
      )}

      <form className="space-y-6" action={action}>
        <div>
          <label
            className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1"
            htmlFor="name"
          >
            Họ tên
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            aria-invalid={!!state.errors.name}
            aria-describedby={state.errors.name ? "name-error" : undefined}
            disabled={pending}
            className="w-full border-0 border-b-2 border-[site-sand] bg-transparent pb-2 font-sans text-[16px] text-[site-ink] focus:border-ink focus:ring-0 focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50"
          />
          {state.errors.name && (
            <p id="name-error" className="font-mono text-[12px] text-red-600 mt-1" role="alert">
              {state.errors.name}
            </p>
          )}
        </div>

        <div>
          <label
            className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1"
            htmlFor="email"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={!!state.errors.email}
            aria-describedby={state.errors.email ? "email-error" : undefined}
            disabled={pending}
            className="w-full border-0 border-b-2 border-[site-sand] bg-transparent pb-2 font-sans text-[16px] text-[site-ink] focus:border-ink focus:ring-0 focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50"
          />
          {state.errors.email && (
            <p id="email-error" className="font-mono text-[12px] text-red-600 mt-1" role="alert">
              {state.errors.email}
            </p>
          )}
        </div>

        <div>
          <label
            className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1"
            htmlFor="message"
          >
            Tin nhắn
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            aria-invalid={!!state.errors.message}
            aria-describedby={state.errors.message ? "message-error" : undefined}
            disabled={pending}
            className="w-full border-0 border-b-2 border-[site-sand] bg-transparent pb-2 font-sans text-[16px] text-[site-ink] focus:border-ink focus:ring-0 focus-visible:ring-2 focus-visible:ring-ink resize-none disabled:opacity-50"
          />
          {state.errors.message && (
            <p id="message-error" className="font-mono text-[12px] text-red-600 mt-1" role="alert">
              {state.errors.message}
            </p>
          )}
        </div>

        {!state.success && state.message && !Object.keys(state.errors).length && (
          <div
            className="bg-red-50 border border-red-200 text-red-800 p-3 rounded font-mono text-[13px]"
            role="alert"
          >
            {state.message}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="w-full bg-primary text-ink py-4 font-bold rounded-full brutalist-shadow text-sm uppercase tracking-wider mt-4 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Đang gửi..." : "Gửi tin nhắn"}
        </button>
      </form>

      <div className="mt-10 pt-6 border-t border-dashed border-[site-sand] text-center space-y-1">
        <p className="font-sans text-[14px] text-[site-brown]">Hoặc gửi email tới</p>
        <ObfuscatedEmail
          user="hello"
          domain="sansalengon.com"
          className="font-mono text-[14px] text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
    </ContentPageShell>
  )
}
