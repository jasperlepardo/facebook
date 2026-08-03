'use client'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import AppHeader from '@/components/AppHeader'
import { headerBtn } from '@/lib/ui'
import type { LightboxState } from '@/types'

export function lightboxTypeLabel(type: LightboxState['type']) {
  return type === 'video' ? 'Video' : type === 'gif' ? 'GIF' : type === 'file' ? 'File' : 'Photo'
}

export function lightboxTitleFromState(state: Pick<LightboxState, 'caption' | 'type'>) {
  return state.caption?.trim() || lightboxTypeLabel(state.type)
}

export function lightboxCounterFromState(state: Pick<LightboxState, 'index' | 'total'>) {
  if (state.index != null && state.total != null && state.total > 1) {
    return `${state.index} / ${state.total}`
  }
  return null
}

export function LightboxStageSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
      <div className="w-9 h-9 rounded-full border-2 border-mist-300 border-t-mist-600 dark:border-white/20 dark:border-t-white/80 animate-spin" />
    </div>
  )
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={dir === 'right' ? 'rotate-180' : undefined}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

/** Filmstrip-shaped placeholder so the loading shell matches the real lightbox chrome. */
export function LightboxStripPlaceholder({ cells = 7 }: { cells?: number }) {
  return (
    <div className="overflow-x-hidden py-2" aria-hidden>
      <div className="flex gap-1.5 px-3">
        {Array.from({ length: cells }, (_, i) => (
          <span
            key={i}
            className="w-14 h-14 shrink-0 rounded-sm animate-pulse bg-black/10 dark:bg-white/10"
          />
        ))}
      </div>
    </div>
  )
}

export default function LightboxShell({
  title,
  counter,
  onClose,
  headerActions,
  showStripPlaceholder,
  strip,
  footer,
  scrimRef,
  panelRef,
  stageProps,
  canPrev,
  canNext,
  onPrev,
  onNext,
  showNav = true,
  children,
}: {
  title: ReactNode
  counter?: string | null
  onClose: () => void
  headerActions?: ReactNode
  showStripPlaceholder?: boolean
  strip?: ReactNode
  footer?: ReactNode
  scrimRef?: Ref<HTMLDivElement>
  panelRef?: Ref<HTMLDivElement>
  stageProps?: HTMLAttributes<HTMLDivElement>
  canPrev?: boolean
  canNext?: boolean
  onPrev?: () => void
  onNext?: () => void
  showNav?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-999"
      role="dialog"
      aria-modal
      aria-label="Media viewer"
    >
      <div
        ref={scrimRef}
        className="absolute inset-0 bg-mist-50/95 dark:bg-black/95 [animation:fade-in_160ms_ease-out]"
      />

      <div
        ref={panelRef}
        className="absolute inset-0 flex flex-col bg-mist-50 dark:bg-mist-950 text-gray-900 dark:text-white [animation:fade-in_160ms_ease-out] will-change-transform"
        style={{ transform: 'translate3d(0,0,0)' }}
      >
        <AppHeader
          dismiss
          onBack={onClose}
          title={(
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{title}</p>
              {counter && (
                <p className="text-[11px] text-mist-500 dark:text-white/55 tabular-nums truncate">{counter}</p>
              )}
            </div>
          )}
          actions={headerActions}
        />

        <div
          className="flex-1 min-h-0 relative flex items-center justify-center px-2 select-none touch-none bg-mist-100/80 dark:bg-black/40"
          {...stageProps}
        >
          {showNav && (
            <>
              <button
                type="button"
                aria-label="Previous"
                disabled={!canPrev}
                onClick={onPrev}
                className={`hidden md:flex absolute left-[max(0.25rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2 z-10 ${headerBtn} ${canPrev ? 'opacity-80 hover:opacity-100' : 'opacity-25 cursor-default'}`}
              >
                <ChevronIcon dir="left" />
              </button>
              <button
                type="button"
                aria-label="Next"
                disabled={!canNext}
                onClick={onNext}
                className={`hidden md:flex absolute right-[max(0.25rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2 z-10 ${headerBtn} ${canNext ? 'opacity-80 hover:opacity-100' : 'opacity-25 cursor-default'}`}
              >
                <ChevronIcon dir="right" />
              </button>
            </>
          )}
          {children}
        </div>

        <div className="sticky bottom-0 z-20 liquid-glass-bar liquid-glass-bar-frosted text-gray-900 dark:text-white shrink-0 border-b-0 border-t border-black/10 dark:border-white/10">
          {strip}
          {showStripPlaceholder && !strip && <LightboxStripPlaceholder />}
          <div className="px-4 pt-1 pb-[calc(0.5rem+var(--resibo-safe-bottom))]">
            {footer ?? (!strip && !showStripPlaceholder ? <div className="h-1" /> : null)}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Sync-friendly placeholder while the lightbox chunk or media is not ready. */
export function LightboxLoadingShell({
  state,
  onClose,
}: {
  state: Pick<LightboxState, 'caption' | 'type' | 'index' | 'total'>
  onClose: () => void
}) {
  const showStrip = !!(state.total && state.total > 1)
  return (
    <LightboxShell
      title={lightboxTitleFromState(state)}
      counter={lightboxCounterFromState(state)}
      onClose={onClose}
      showStripPlaceholder={showStrip}
      canPrev={false}
      canNext={false}
    >
      <LightboxStageSpinner />
    </LightboxShell>
  )
}
