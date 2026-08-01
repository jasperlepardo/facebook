'use client'
import type { ReactNode } from 'react'

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
      className="text-gray-500 dark:text-mist-400 hover:text-gray-900 dark:hover:text-white -ml-1.5 p-1 flex items-center shrink-0"
    >
      {embedded ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      ) : (
        <>
          <svg className="md:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          <svg className="hidden md:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </>
      )}
    </button>
  ) : null

  if (searchMode && search) {
    return (
      <div className="sticky top-0 z-20 bg-white dark:bg-mist-900 text-gray-900 dark:text-white shrink-0">
        <div className={`px-4 ${topPad} pb-2.5 flex items-center gap-2`}>
          <div className="flex-1 min-w-0">{search}</div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 text-sm font-medium text-mist-600 dark:text-mist-300 hover:text-gray-900 dark:hover:text-white px-1 py-1.5 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-mist-900 text-gray-900 dark:text-white shrink-0">
      <div className={`px-4 ${topPad} pb-2.5`}>
        <div className="relative flex items-center min-h-8">
          <div className="relative z-10 flex items-center min-w-[4.5rem] shrink-0">
            {backButton}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto min-w-0 max-w-[calc(100%-9rem)] truncate text-center">
              {title}
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-1 ml-auto min-w-[4.5rem] justify-end shrink-0">
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
