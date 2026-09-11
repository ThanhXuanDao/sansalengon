"use client"

import { Mail, Lock, ArrowRight, ShieldCheck, Loader2, Home } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"

interface SiteInfo {
  siteName: string
  logo: string
}

function AppLogo({ logo, siteName }: { logo: string; siteName: string }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={siteName}
        className="h-14 w-auto max-w-[180px] object-contain mx-auto"
      />
    )
  }
  return (
    <div className="size-14 mx-auto bg-[#b51c00] flex items-center justify-center">
      <span className="font-mono font-black text-white text-[22px] leading-none select-none">
        {siteName.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"credentials" | "otp">("credentials")
  const [otp, setOtp] = useState("")
  const [siteInfo, setSiteInfo] = useState<SiteInfo>({ siteName: "Admin", logo: "" })
  const otpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSiteInfo({ siteName: d.siteName || "Admin", logo: d.logo || "" }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus()
  }, [step])

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.requiresOtp) {
        setStep("otp")
        setPassword("")
      } else if (res.ok) {
        router.push("/admin")
      } else {
        setError(data.error || "Email hoặc mật khẩu không đúng")
      }
    } catch {
      setError("Có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push("/admin")
      } else {
        setError(data.error || "Mã xác thực sai hoặc đã hết hạn")
        setOtp("")
      }
    } catch {
      setError("Có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  const fieldCls =
    "w-full pl-10 py-2.5 font-sans text-[15px] text-[#1a1c1b] placeholder:text-[#5c403a]/40 bg-transparent border-0 border-b-2 border-[#e5e1d8] focus:border-[#b51c00] focus:ring-0 outline-none transition-colors"
  const labelCls =
    "block font-mono text-[11px] tracking-[0.08em] uppercase text-[#5c403a] mb-2"

  return (
    <div className="min-h-screen bg-[#FAFAF7] bg-[radial-gradient(#e5e1e9_1px,transparent_1px)] bg-[length:8px_8px] flex items-center justify-center p-4">
      <main className="w-full max-w-[400px]">
        <div className="bg-white border border-[#e5beb6] shadow-sm">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-dashed border-[#e5beb6]">
            <AppLogo logo={siteInfo.logo} siteName={siteInfo.siteName} />
            <h1 className="mt-4 font-sans text-[22px] font-extrabold text-[#1a1c1b] tracking-tight">
              {siteInfo.siteName}
            </h1>
            <p className="mt-1 font-mono text-[11px] tracking-[0.06em] text-[#5c403a]/70 uppercase">
              {step === "otp" ? "Xác thực hai bước" : "Trang quản trị"}
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            {step === "credentials" ? (
              <form onSubmit={handleCredentials} className="space-y-6">
                <div>
                  <label htmlFor="email" className={labelCls}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-0 top-1/2 -translate-y-1/2 size-4 text-[#5c403a]/50" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@example.com"
                      autoComplete="email"
                      required
                      className={fieldCls}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className={labelCls}>Mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-0 top-1/2 -translate-y-1/2 size-4 text-[#5c403a]/50" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className={fieldCls}
                    />
                  </div>
                </div>

                {error && (
                  <p className="font-mono text-[12px] text-[#ba1a1a] bg-[#fff0ee] border border-[#ffc9c2] px-3 py-2.5" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-[#b51c00] text-white font-mono text-[13px] tracking-[0.05em] py-3.5 flex items-center justify-center gap-2 hover:bg-[#8b1500] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b51c00]"
                >
                  {loading
                    ? <Loader2 className="size-4 animate-spin" />
                    : <ArrowRight className="size-4" />
                  }
                  <span>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtp} className="space-y-6">
                <div className="text-center pb-2">
                  <div className="size-12 mx-auto bg-[#fff0ee] flex items-center justify-center mb-3">
                    <ShieldCheck className="size-6 text-[#b51c00]" />
                  </div>
                  <p className="font-sans text-[14px] text-[#1a1c1b]">
                    Mã xác thực đã được gửi đến
                  </p>
                  <p className="font-mono text-[13px] font-bold text-[#b51c00] mt-0.5">{email}</p>
                </div>

                <div>
                  <label htmlFor="otp-code" className={labelCls}>Mã xác thực (6 chữ số)</label>
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
                    className="w-full py-2.5 font-mono text-[28px] tracking-[0.3em] text-center text-[#1a1c1b] placeholder:text-[#5c403a]/20 bg-transparent border-0 border-b-2 border-[#e5e1d8] focus:border-[#b51c00] focus:ring-0 outline-none transition-colors"
                  />
                </div>

                {error && (
                  <p className="font-mono text-[12px] text-[#ba1a1a] bg-[#fff0ee] border border-[#ffc9c2] px-3 py-2.5" role="alert">
                    {error}
                  </p>
                )}

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full bg-[#b51c00] text-white font-mono text-[13px] tracking-[0.05em] py-3.5 flex items-center justify-center gap-2 hover:bg-[#8b1500] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b51c00]"
                  >
                    {loading
                      ? <Loader2 className="size-4 animate-spin" />
                      : <ShieldCheck className="size-4" />
                    }
                    <span>{loading ? "Đang xác thực..." : "Xác nhận"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setOtp(""); setError("") }}
                    className="w-full font-mono text-[12px] text-[#5c403a] hover:text-[#b51c00] transition-colors py-1"
                  >
                    ← Quay lại
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-[#fafaf7] border-t border-dashed border-[#e5beb6] flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#5c403a] hover:text-[#b51c00] transition-colors"
            >
              <Home className="size-3.5" />
              Về trang chủ
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
