"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"

interface BannerData {
  id: string
  title: string
  imageUrl: string
  affiliateUrl: string | null
  destinationUrl: string
}

interface BannerSliderProps {
  /** Auto-slide interval in ms. Default: 4000. Pass 0 to disable. */
  interval?: number
  className?: string
}

const AUTO_SLIDE_INTERVAL = 4000

export default function BannerSlider({ interval = AUTO_SLIDE_INTERVAL, className = "" }: BannerSliderProps) {
  const { data, isSuccess } = useQuery<BannerData[]>({
    queryKey: ["banners"],
    queryFn: () => fetch("/api/banners").then((r) => r.json()).then((d) => d.data ?? []),
    staleTime: 5 * 60 * 1000,
  })

  const banners = data ?? []
  const [active, setActive] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pausedRef = useRef(false)

  const startTimer = useCallback(() => {
    if (!interval || banners.length <= 1) return
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setActive((a) => (a + 1) % banners.length)
      }
    }, interval)
  }, [interval, banners.length])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    stopTimer()
    startTimer()
    return stopTimer
  }, [startTimer, stopTimer])

  function goTo(idx: number) {
    stopTimer()
    setActive(idx)
    startTimer()
  }

  function handleClick(b: BannerData) {
    const url = b.affiliateUrl || b.destinationUrl
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  if (!isSuccess || banners.length === 0) return null

  return (
    <div className={`w-full ${className}`}>
      <div
        className="relative w-full overflow-hidden bg-white aspect-[2/1] md:aspect-[10/3] lg:aspect-[10/3]"
        onMouseEnter={() => { pausedRef.current = true }}
        onMouseLeave={() => { pausedRef.current = false }}
      >
        {banners.map((b, i) => (
          <button
            key={b.id}
            onClick={() => handleClick(b)}
            aria-label={b.title}
            className={`absolute inset-0 w-full h-full cursor-pointer transition-opacity duration-500 ${i === active ? "opacity-100 z-10" : "opacity-0 z-0"}`}
          >
            <Image
              src={b.imageUrl}
              alt={b.title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 1320px"
              priority={i === 0}
            />
          </button>
        ))}

        {/* Dot indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${i === active ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
