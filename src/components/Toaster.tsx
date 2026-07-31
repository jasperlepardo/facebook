'use client'
import { useEffect, useRef, useState } from 'react'

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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-mist-900 dark:bg-mist-700 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none z-[400]">
      {msg}
    </div>
  )
}
