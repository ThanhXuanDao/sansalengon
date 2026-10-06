"use client"

import { useEffect, useRef } from "react"

interface ObfuscatedEmailProps {
  user: string
  domain: string
  className?: string
}

export default function ObfuscatedEmail({ user, domain, className }: ObfuscatedEmailProps) {
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const email = `${user}@${domain}`
    ref.current.href = `mailto:${email}`
    ref.current.textContent = email
  }, [user, domain])

  // SSR: không render email, chỉ render placeholder
  return (
    <a ref={ref} className={className} aria-label="Email liên hệ">
      {user.slice(0, 3)}***@{domain}
    </a>
  )
}
