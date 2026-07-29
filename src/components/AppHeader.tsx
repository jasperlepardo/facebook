'use client'
import { useRef, useState, useEffect, type ReactNode } from 'react'

interface AppHeaderProps {
  title: ReactNode
  onBack?: () => void
  actions?: ReactNode
  search?: ReactNode
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export default function AppHeader({ title, onBack, actions, search, scrollContainerRef }: AppHeaderProps) {
  const lastScrollY = useRef(0)
  const [searchVisible, setSearchVisible] = useState(true)

  useEffect(() => {
    setSearchVisible(true)
    lastScrollY.current = 0
  }, [search])

  useEffect(() => {
    const el = scrollContainerRef?.current
    if (!el) return
    const handler = () => {
      const cur = el.scrollTop
      if (cur === 0) { setSearchVisible(true); lastScrollY.current = 0; return }
      const delta = cur - lastScrollY.current
      if (Math.abs(delta) > 8) { setSearchVisible(delta < 0); lastScrollY.current = cur }
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [scrollContainerRef]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-mist-900 text-gray-900 dark:text-white shrink-0">
      <div className="px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 flex items-center gap-2.5 md:grid md:grid-cols-3 md:gap-4">

        {/* Left: back + title */}
        <div className="flex items-center gap-1.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-500 dark:text-mist-400 hover:text-gray-900 dark:hover:text-white -ml-1.5 p-1 flex items-center shrink-0"
            >
              {/* Arrow on mobile, X on desktop */}
              <svg className="md:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              <svg className="hidden md:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <div className="min-w-0 flex-1">{title}</div>
        </div>

        {/* Center: search (desktop) */}
        <div className="hidden md:flex items-center justify-center">
          {search}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 ml-auto md:ml-0 justify-end">
          {actions}
        </div>
      </div>

      {/* Search: mobile collapsible */}
      {search && (
        <div className={`md:hidden grid transition-[grid-template-rows] duration-200 ease-in-out ${searchVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="px-4 pb-2.5">{search}</div>
          </div>
        </div>
      )}
    </div>
  )
}
