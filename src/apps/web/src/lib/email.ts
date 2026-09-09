import { Resend } from "resend"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function sendOtpEmail(to: string, code: string) {
  const resend = getResend()
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping OTP email")
    return
  }
  await resend.emails.send({
    from: "Shopby Admin <onboarding@resend.dev>",
    to,
    subject: "Kode Verifikasi Login Shopby",
    html: `<p>Kode verifikasi login kamu: <strong style="font-size:24px">${code}</strong></p>
           <p>Kode ini berlaku 5 menit. Kalau bukan kamu yang coba login, abaikan email ini.</p>`,
  })
}