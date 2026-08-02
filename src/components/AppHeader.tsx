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
  /** Always show an X dismiss control (lightbox / modal). */
  dismiss?: boolean
}

export default function AppHeader({
  title, onBack, actions, search, embedded, searchMode, dismiss,
}: AppHeaderProps) {
  const topPad = embedded
    ? 'pt-2.5'
    : 'pt-[calc(0.625rem+env(safe-area-inset-top))]'

  // Center detail header: always opaque so content never shows through.
  const barCls = 'sticky top-0 z-20 liquid-glass-bar liquid-glass-bar-frosted text-gray-900 dark:text-white shrink-0'
  const btnCls = headerBtn
  const chipCls = headerChip

  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      aria-label={dismiss ? 'Close' : 'Back'}
      className={btnCls}
    >
      {dismiss ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      ) : embedded ? (
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
      <div className={barCls}>
        <div className={`px-4 ${topPad} pb-2.5 flex items-center gap-3`}>
          <div className="flex-1 min-w-0">{search}</div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={chipCls}
            >
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={barCls}>
      <div className={`px-4 ${topPad} pb-2.5`}>
        <div className="grid grid-cols-[minmax(72px,auto)_minmax(0,1fr)_minmax(72px,auto)] items-center gap-3 min-h-8">
          <div className="flex items-center justify-start">
            {backButton}
          </div>
          <div className="min-w-0 truncate text-center">
            {title}
          </div>
          <div className="flex items-center justify-end gap-1.5">
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
