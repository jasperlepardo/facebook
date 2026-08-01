'use client'
import { useRef, type ReactNode } from 'react'
import { useStickyStuck } from '@/hooks/useFrostedBar'

/** Sticky strip that frosts only while stuck to the scrollport top. */
export default function StickyFrostedBar({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const stuck = useStickyStuck(ref)
  return (
    <div
      ref={ref}
      className={`sticky top-0 z-10 liquid-glass-bar ${stuck ? 'liquid-glass-bar-frosted' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
