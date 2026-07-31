'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LightboxState } from '@/types'

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
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

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

const SWIPE_THRESHOLD = 56
const PINCH_MIN = 1
const PINCH_MAX = 4

export default function Lightbox({ state, onClose, onJumpToMessage }: {
  state: LightboxState
  onClose: () => void
  onJumpToMessage?: (ts: number, msgId: string | null) => void
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const scaleRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const touchRef = useRef<{
    mode: 'none' | 'swipe' | 'pan' | 'pinch'
    startX: number
    startY: number
    startPan: { x: number; y: number }
    startDist: number
    startScale: number
    lastTap: number
  }>({ mode: 'none', startX: 0, startY: 0, startPan: { x: 0, y: 0 }, startDist: 0, startScale: 1, lastTap: 0 })

  const canPrev = !!state.onPrev
  const canNext = !!state.onNext
  const isImage = state.type === 'photo' || state.type === 'gif'
  const zoomed = scale > 1.05

  const resetZoom = useCallback(() => {
    scaleRef.current = 1
    panRef.current = { x: 0, y: 0 }
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    setStatus('loading')
    resetZoom()
    if (state.type === 'file') {
      const ext = (state.caption ?? '').split('.').pop()?.toLowerCase() ?? ''
      const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
      if (ext !== 'pdf' && !officeExts.includes(ext)) setStatus('ready')
    }
  }, [state.src, state.type, state.caption, resetZoom, retry])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { resetZoom(); onClose(); return }
      if (e.key === 'ArrowLeft') state.onPrev?.()
      if (e.key === 'ArrowRight') state.onNext?.()
      if (e.key === '0') resetZoom()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, state, resetZoom])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function dist(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.hypot(dx, dy)
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!isImage) return
    setDragging(true)
    const t = touchRef.current
    if (e.touches.length === 2) {
      t.mode = 'pinch'
      t.startDist = dist(e.touches[0], e.touches[1])
      t.startScale = scaleRef.current
      return
    }
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const now = Date.now()
    if (now - t.lastTap < 280) {
      if (scaleRef.current > 1.05) {
        resetZoom()
      } else {
        scaleRef.current = 2
        setScale(2)
      }
      t.lastTap = 0
      t.mode = 'none'
      setDragging(false)
      return
    }
    t.lastTap = now
    t.startX = touch.clientX
    t.startY = touch.clientY
    t.startPan = { ...panRef.current }
    t.mode = zoomed ? 'pan' : 'swipe'
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isImage) return
    const t = touchRef.current
    if (t.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault()
      const next = Math.min(PINCH_MAX, Math.max(PINCH_MIN, t.startScale * (dist(e.touches[0], e.touches[1]) / t.startDist)))
      scaleRef.current = next
      setScale(next)
      if (next <= 1.05) {
        panRef.current = { x: 0, y: 0 }
        setPan({ x: 0, y: 0 })
      }
      return
    }
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const dx = touch.clientX - t.startX
    const dy = touch.clientY - t.startY
    if (t.mode === 'pan') {
      e.preventDefault()
      const next = { x: t.startPan.x + dx, y: t.startPan.y + dy }
      panRef.current = next
      setPan(next)
    } else if (t.mode === 'swipe' && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      // commit to horizontal swipe — visual feedback via opacity could be added later
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!isImage) return
    const t = touchRef.current
    if (t.mode === 'pinch') {
      if (scaleRef.current < 1.05) resetZoom()
      t.mode = 'none'
      setDragging(false)
      return
    }
    if (t.mode === 'swipe' && e.changedTouches[0]) {
      const dx = e.changedTouches[0].clientX - t.startX
      if (dx > SWIPE_THRESHOLD) state.onPrev?.()
      else if (dx < -SWIPE_THRESHOLD) state.onNext?.()
    }
    t.mode = 'none'
    setDragging(false)
  }

  const typeLabel = state.type === 'video' ? 'Video' : state.type === 'gif' ? 'GIF' : state.type === 'file' ? 'File' : 'Photo'
  const counter = state.index != null && state.total != null && state.total > 1
    ? `${state.index} / ${state.total}`
    : null

  return (
    <div
      className="fixed inset-0 z-999 flex flex-col bg-black/95 [animation:fade-in_160ms_ease-out]"
      role="dialog"
      aria-modal
      aria-label="Media viewer"
    >
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/70 to-transparent relative z-20">
        <div className="min-w-0 flex-1">
          {counter && <p className="text-white/80 text-[13px] font-medium tabular-nums">{counter}</p>}
          <p className="text-white/45 text-[11px] truncate">{typeLabel}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Media stage */}
      <div
        className={`flex-1 min-h-0 relative flex items-center justify-center px-2 select-none ${isImage ? 'touch-none' : ''}`}
        onClick={e => { if (e.target === e.currentTarget && !zoomed) onClose() }}
        onTouchStart={isImage ? onTouchStart : undefined}
        onTouchMove={isImage ? onTouchMove : undefined}
        onTouchEnd={isImage ? onTouchEnd : undefined}
        onTouchCancel={isImage ? () => { touchRef.current.mode = 'none'; setDragging(false) } : undefined}
      >
        {/* Desktop prev/next — always rendered; dimmed when unavailable */}
        <button
          type="button"
          aria-label="Previous"
          disabled={!canPrev}
          onClick={() => state.onPrev?.()}
          className={`hidden md:flex absolute left-[max(0.25rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white/10 text-white transition-opacity ${canPrev ? 'opacity-70 hover:opacity-100 hover:bg-white/20' : 'opacity-20 cursor-default'}`}
        >
          <ChevronIcon dir="left" />
        </button>
        <button
          type="button"
          aria-label="Next"
          disabled={!canNext}
          onClick={() => state.onNext?.()}
          className={`hidden md:flex absolute right-[max(0.25rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white/10 text-white transition-opacity ${canNext ? 'opacity-70 hover:opacity-100 hover:bg-white/20' : 'opacity-20 cursor-default'}`}
        >
          <ChevronIcon dir="right" />
        </button>

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <p className="text-white/80 text-sm font-medium">Couldn&apos;t load media</p>
            <p className="text-white/40 text-xs max-w-xs truncate">{state.src}</p>
            <button
              type="button"
              onClick={() => { setRetry(r => r + 1); setStatus('loading') }}
              className="mt-2 text-[13px] text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {state.type === 'video' ? (
          <video
            key={`${state.src}-${retry}`}
            src={state.src}
            controls
            autoPlay
            playsInline
            className={`max-w-full max-h-full rounded-sm object-contain transition-opacity ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            onLoadedData={() => setStatus('ready')}
            onError={() => setStatus('error')}
          />
        ) : state.type === 'file' ? (
          (() => {
            const ext = (state.caption ?? '').split('.').pop()?.toLowerCase() ?? ''
            const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
            const viewerSrc = ext === 'pdf'
              ? state.src
              : officeExts.includes(ext)
              ? `https://docs.google.com/viewer?url=${encodeURIComponent(state.src)}&embedded=true`
              : null
            return (
              <div className="flex flex-col items-center gap-3 w-full h-full min-h-0 max-w-[90vw] py-2">
                {viewerSrc
                  ? <iframe
                      src={viewerSrc}
                      title={state.caption || 'Document'}
                      className="w-full flex-1 min-h-0 rounded-sm bg-white"
                      onLoad={() => setStatus('ready')}
                    />
                  : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/40 text-sm">
                      Preview not available
                    </div>
                  )}
              </div>
            )
          })()
        ) : status !== 'error' ? (
          <img
            key={`${state.src}-${retry}`}
            src={state.src}
            alt={state.caption || ''}
            draggable={false}
            className={`max-w-full max-h-full rounded-sm object-contain origin-center transition-opacity ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transition: dragging ? undefined : 'transform 180ms ease-out',
            }}
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('error')}
          />
        ) : null}
      </div>

      {/* Bottom chrome */}
      <div className="shrink-0 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 via-black/50 to-transparent relative z-20">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <div className="flex-1 min-w-0">
            {state.caption && (
              <p className="text-white/85 text-[13px] leading-snug truncate">{state.caption}</p>
            )}
            {zoomed && isImage && (
              <button type="button" onClick={resetZoom} className="text-white/45 text-[11px] mt-1 hover:text-white/80 transition-colors">
                Reset zoom
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {state.type === 'file' && (
              <a
                href={state.src}
                download
                target="_blank"
                rel="noopener"
                className="h-10 px-3.5 flex items-center rounded-full bg-white/10 hover:bg-white/20 text-white text-[13px] font-medium transition-colors"
              >
                Download
              </a>
            )}
            {onJumpToMessage && state.ts != null && (
              <button
                type="button"
                onClick={() => { onJumpToMessage(state.ts!, state.msgId ?? null); onClose() }}
                className="h-10 px-3.5 flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium transition-colors"
              >
                <ChatIcon />
                View in chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
