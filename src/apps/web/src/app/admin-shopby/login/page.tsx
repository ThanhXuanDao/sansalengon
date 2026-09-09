"use client"

import { Receipt, Mail, Lock, ArrowRight, Store, Loader2, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"credentials" | "otp">("credentials")
  const [otp, setOtp] = useState("")
  const otpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === "otp") {
      otpInputRef.current?.focus()
    }
  }, [step])

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/admin-shopby/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (data.requiresOtp) {
        setStep("otp")
        setPassword("")
      } else if (res.ok) {
        router.push("/admin-shopby")
      } else {
        setError(data.error || "Email atau password salah")
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/admin-shopby/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push("/admin-shopby")
      } else {
        setError(data.error || "Kode salah atau kadaluarsa")
        setOtp("")
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] bg-[radial-gradient(#e5e1e9_1px,transparent_1px)] bg-[length:8px_8px] flex items-center justify-center p-4">
      <main className="w-full max-w-[480px] mx-auto">
        <div className="bg-white border border-[#906f69] relative flex flex-col">
          <div className="p-6 border-b border-dashed border-[#e5beb6] text-center">
            <div className="flex justify-center mb-2">
              <Receipt className="size-12 text-[#b51c00]" aria-hidden="true" />
            </div>
            <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-[#b51c00] text-pretty">
              SHOPBY ADMIN
            </h1>
            <p className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] mt-2">
              SYS_AUTH_REQ // SECURE_PORTAL
            </p>
          </div>

          <div className="p-6 pb-8">
            {step === "credentials" ? (
              <form onSubmit={handleCredentials} className="space-y-8">
                <div className="relative">
                  <label className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#1a1c1b] mb-1" htmlFor="email">
                    Email Address
                  </label>
                  <div className="flex items-center mt-1">
                    <Mail className="size-5 text-[#5c403a] mr-3 absolute" aria-hidden="true" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@shopby.com"
                      autoComplete="email"
                      required
                      className="w-full pl-10 py-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] placeholder:text-[#5c403a]/50 bg-transparent border-0 border-b-2 border-dashed border-[#e5beb6] focus:border-[#b51c00] focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#b51c00]"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#1a1c1b] mb-1" htmlFor="password">
                    Passcode
                  </label>
                  <div className="flex items-center mt-1">
                    <Lock className="size-5 text-[#5c403a] mr-3 absolute" aria-hidden="true" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="w-full pl-10 py-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] placeholder:text-[#5c403a]/50 bg-transparent border-0 border-b-2 border-dashed border-[#e5beb6] focus:border-[#b51c00] focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#b51c00]"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-[#ffdad6] border border-[#ba1a1a] rounded px-4 py-3 font-mono text-[13px] leading-[16px] text-[#ba1a1a]" role="alert">
                    {error}
                  </div>
                )}

                <div className="pt-6 border-t border-dashed border-[#e5beb6] mt-8">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#b51c00] text-white font-mono text-[13px] leading-[16px] tracking-[0.05em] py-4 rounded-full transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#b51c00]"
                  >
                    {loading ? (
                      <Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="size-[18px]" aria-hidden="true" />
                    )}
                    <span aria-live="polite">{loading ? "AUTHORIZING…" : "AUTHORIZE_LOGIN"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleOtp} className="space-y-8">
                <div className="text-center">
                  <div className="flex justify-center mb-3">
                    <ShieldCheck className="size-10 text-[#b51c00]" aria-hidden="true" />
                  </div>
                  <p className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a]">
                    OTP_2FA_REQ // EMAIL_SENT
                  </p>
                  <p className="font-sans text-[14px] leading-[22px] text-[#1a1c1b] mt-2">
                    Kode verifikasi 6 digit telah dikirim ke{" "}
                    <span className="font-bold font-mono text-[13px]">{email}</span>
                  </p>
                </div>

                <div className="relative">
                  <label className="block font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#1a1c1b] mb-1" htmlFor="otp-code">
                    Kode Verifikasi
                  </label>
                  <input
                    ref={otpInputRef}
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    required
                    className="w-full py-2 font-mono text-[24px] leading-[32px] tracking-[0.2em] text-center text-[#1a1c1b] placeholder:text-[#5c403a]/30 bg-transparent border-0 border-b-2 border-dashed border-[#e5beb6] focus:border-[#b51c00] focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#b51c00]"
                  />
                </div>

                {error && (
                  <div className="bg-[#ffdad6] border border-[#ba1a1a] rounded px-4 py-3 font-mono text-[13px] leading-[16px] text-[#ba1a1a]" role="alert">
                    {error}
                  </div>
                )}

                <div className="pt-6 border-t border-dashed border-[#e5beb6] mt-8 space-y-3">
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full bg-[#b51c00] text-white font-mono text-[13px] leading-[16px] tracking-[0.05em] py-4 rounded-full transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#b51c00]"
                  >
                    {loading ? (
                      <Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="size-[18px]" aria-hidden="true" />
                    )}
                    <span aria-live="polite">{loading ? "VERIFYING…" : "VERIFY_CODE"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setOtp(""); setError("") }}
                    className="w-full font-mono text-[12px] text-[#5c403a] hover:text-[#b51c00] transition-colors border-b border-transparent hover:border-[#b51c00] focus-visible:ring-2 focus-visible:ring-[#b51c00]"
                  >
                    ← Kembali ke login
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="p-4 bg-[#f4f4f1] border-t border-[#906f69] flex flex-col items-center gap-3">
            <button type="button" className="font-sans text-[12px] leading-[16px] font-medium text-[#1a1c1b] hover:text-[#b51c00] transition-colors border-b border-transparent hover:border-[#b51c00] focus-visible:ring-2 focus-visible:ring-[#b51c00]" onClick={() => alert("Please contact your administrator to reset your passcode.")}>
              Forgot Passcode?
            </button>
            <div className="w-full border-t border-dashed border-[#e5beb6] my-1" />
            <Link href="/" className="font-sans text-[12px] leading-[16px] font-medium text-[#5c403a] hover:text-[#1a1c1b] transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[#b51c00]">
              <Store className="size-4" aria-hidden="true" />
              Return to Storefront
            </Link>
          </div>

          <div className="absolute -bottom-3 left-0 w-full h-3 overflow-hidden flex justify-around opacity-50">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#FAFAF7] mt-1" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
