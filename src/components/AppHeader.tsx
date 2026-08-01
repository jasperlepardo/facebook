'use client'
import { useRef, type ReactNode } from 'react'
import { headerBtn, headerChip } from '@/lib/ui'
import { useFrostedOnScroll } from '@/hooks/useFrostedBar'

interface AppHeaderProps {
  title: ReactNode
  onBack?: () => void
  actions?: ReactNode
  search?: ReactNode
  /** Side pane / sheet: no safe-area inset, always back chevron (not desktop X). */
  embedded?: boolean
  /** Replace title/actions with a full-width search field (plus Cancel). */
  searchMode?: boolean
}

export default function AppHeader({
  title, onBack, actions, search, embedded, searchMode,
}: AppHeaderProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const frosted = useFrostedOnScroll(barRef)

  const topPad = embedded
    ? 'pt-2.5'
    : 'pt-[calc(0.625rem+env(safe-area-inset-top))]'

  const barCls = `sticky top-0 z-20 liquid-glass-bar text-gray-900 dark:text-white shrink-0${frosted ? ' liquid-glass-bar-frosted' : ''}`

  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      className={headerBtn}
    >
      {embedded ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      ) : (
        <>
          <svg className="md:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          <svg className="hidden md:block" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </>
      )}
    </button>
  ) : null

  if (searchMode && search) {
    return (
      <div ref={barRef} className={barCls}>
        <div className={`px-4 ${topPad} pb-2.5 flex items-center gap-3`}>
          <div className="flex-1 min-w-0">{search}</div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={headerChip}
            >
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={barRef} className={barCls}>
      <div className={`px-4 ${topPad} pb-2.5`}>
        <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-3 min-h-8">
          <div className="flex items-center justify-start">
            {backButton}
          </div>
          <div className="min-w-0 truncate text-center">
            {title}
          </div>
          <div className="flex items-center justify-end gap-2">
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
