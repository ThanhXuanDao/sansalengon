"use client"

import { useState, type FormEvent } from "react"
import { Send, CheckCircle, AlertCircle } from "lucide-react"

export default function FeedbackSection() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorText, setErrorText] = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus("error")
      setErrorText("Vui lòng điền đầy đủ thông tin")
      return
    }

    setStatus("loading")
    setErrorText("")

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      })
      const json = await res.json()

      if (!res.ok) {
        setStatus("error")
        setErrorText(json.error || "Có lỗi xảy ra")
        return
      }

      setStatus("success")
      setName("")
      setEmail("")
      setMessage("")
    } catch {
      setStatus("error")
      setErrorText("Gửi thất bại. Vui lòng thử lại.")
    }
  }

  return (
    <section className="w-full bg-white border-t border-dashed border-[site-peach]">
      <div className="max-w-[1320px] mx-auto px-3 py-16 md:py-20">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-sans text-[28px] md:text-[36px] leading-[1.1] tracking-[-0.02em] font-extrabold text-[site-ink] uppercase">
              Góp ý & Phản hồi
            </h2>
            <p className="font-sans text-[14px] leading-[22px] text-[site-brown] mt-3 max-w-sm mx-auto">
              Chúng tôi rất vui được nghe ý kiến của bạn. Hãy gửi góp ý để chúng tôi cải thiện.
            </p>
          </div>

          {status === "success" ? (
            <div className="bg-white border border-[#4caf50] p-6 text-center" role="alert">
              <CheckCircle className="size-10 mx-auto text-[#4caf50] mb-3" aria-hidden="true" />
              <p className="font-sans text-[16px] font-bold text-[site-ink]">Cảm ơn bạn!</p>
              <p className="font-sans text-[13px] text-[site-brown] mt-1">
                Chúng tôi đã nhận được góp ý của bạn.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-4 font-mono text-[13px] text-[site-red] underline hover:no-underline focus-visible:ring-2 focus-visible:ring-[site-red] focus-visible:outline-none"
              >
                Gửi thêm
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="feedback-name" className="block font-mono text-[11px] uppercase tracking-[0.05em] text-[site-brown] mb-1.5 font-bold">
                  Họ tên
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên của bạn"
                  required
                  className="w-full border border-[site-sand] bg-white px-4 py-3 font-sans text-[14px] text-[site-ink] placeholder:text-[site-mocha]/50 focus:border-[site-ink] focus:ring-0 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="feedback-email" className="block font-mono text-[11px] uppercase tracking-[0.05em] text-[site-brown] mb-1.5 font-bold">
                  Email
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  className="w-full border border-[site-sand] bg-white px-4 py-3 font-sans text-[14px] text-[site-ink] placeholder:text-[site-mocha]/50 focus:border-[site-ink] focus:ring-0 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="feedback-message" className="block font-mono text-[11px] uppercase tracking-[0.05em] text-[site-brown] mb-1.5 font-bold">
                  Tin nhắn
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Viết góp ý của bạn tại đây..."
                  required
                  rows={4}
                  className="w-full border border-[site-sand] bg-white px-4 py-3 font-sans text-[14px] text-[site-ink] placeholder:text-[site-mocha]/50 focus:border-[site-ink] focus:ring-0 focus:outline-none transition-colors resize-y"
                />
              </div>

              {status === "error" && errorText && (
                <div className="flex items-center gap-2 text-[site-crimson]" role="alert">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  <p className="font-sans text-[13px]">{errorText}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full flex items-center justify-center gap-2 bg-[site-ink] text-white font-mono text-[14px] tracking-[0.05em] py-3.5 px-6 hover:bg-[#2a2c2b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[site-red] focus-visible:outline-none"
              >
                {status === "loading" ? (
                  <>
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="size-4" aria-hidden="true" />
                    Gửi
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
