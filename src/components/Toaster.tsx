'use client'
import { useEffect, useRef, useState } from 'react'
import { toastPill } from '@/lib/ui'

export default function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, duration = 2500 } = (e as CustomEvent<{ message: string; duration?: number }>).detail
      clearTimeout(timer.current)
      setMsg(message)
      timer.current = setTimeout(() => setMsg(null), duration)
    }
    window.addEventListener('app-toast', handler)
    return () => window.removeEventListener('app-toast', handler)
  }, [])

  if (!msg) return null
  return (
    <div className={toastPill}>
      {msg}
    </div>
  )
}
