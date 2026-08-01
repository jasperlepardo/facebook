'use client'
import type { ReactNode } from 'react'
import { headerBtn, headerChip } from '@/lib/ui'

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
  const topPad = embedded
    ? 'pt-2.5'
    : 'pt-[calc(0.625rem+env(safe-area-inset-top))]'

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
      <div className="sticky top-0 z-20 liquid-glass-bar text-gray-900 dark:text-white shrink-0">
        <div className={`px-4 ${topPad} pb-2.5 flex items-center gap-2`}>
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
    <div className="sticky top-0 z-20 liquid-glass-bar text-gray-900 dark:text-white shrink-0">
      <div className={`px-4 ${topPad} pb-2.5`}>
        <div className="relative flex items-center min-h-8">
          <div className="relative z-10 flex items-center min-w-8 shrink-0">
            {backButton}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto min-w-0 max-w-[calc(100%-7.5rem)] truncate text-center">
              {title}
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-1.5 ml-auto min-w-8 justify-end shrink-0">
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
