'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LightboxState } from '@/types'
import { headerBtn, headerChip, menu, menuItem, menuItemDanger } from '@/lib/ui'
import AppHeader from '@/components/AppHeader'
import ActionSheet, { ActionSheetAction } from '@/components/ActionSheet'
import { GoToMessageIcon, HideIcon, UnhideIcon } from '@/components/icons'
import { r2 } from '@/lib/format'

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={dir === 'right' ? 'rotate-180' : undefined}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

const SWIPE_THRESHOLD = 56
const DISMISS_THRESHOLD = 96
const PINCH_MIN = 1
const PINCH_MAX = 4
const STRIP_PAGE = 24
const STRIP_RADIUS = 12

type TouchMode = 'none' | 'swipe' | 'pan' | 'pinch' | 'dismiss'

interface LightboxAction {
  id: string
  label: string
  destructive?: boolean
  onPress: () => void
  icon?: React.ReactNode
}

const STRIP_CELL = 56
const STRIP_GAP = 6
const STRIP_STRIDE = STRIP_CELL + STRIP_GAP
const STRIP_PAD_X = 12

function LightboxFilmstrip({
  currentIndex,
  total,
  loadStrip,
  onGoToIndex,
}: {
  currentIndex: number
  total: number
  loadStrip: (offset: number, limit: number) => Promise<{ uri: string }[]>
  onGoToIndex: (index: number) => void
}) {
  const [thumbs, setThumbs] = useState<Map<number, string>>(() => new Map())
  const [range, setRange] = useState({ from: 0, to: Math.min(total - 1, STRIP_RADIUS * 2) })
  const scrollerRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<Set<number>>(new Set())
  const thumbsRef = useRef(thumbs)
  const suppressScrollSync = useRef(false)
  thumbsRef.current = thumbs

  const ensureRange = useCallback(async (from: number, to: number) => {
    const a0 = Math.max(0, from)
    const b0 = Math.min(total - 1, to)
    if (b0 < a0) return
    const missing: number[] = []
    for (let i = a0; i <= b0; i++) {
      if (!thumbsRef.current.has(i) && !loadingRef.current.has(i)) missing.push(i)
    }
    if (!missing.length) return

    let start = missing[0]!
    let end = start
    const runs: Array<[number, number]> = []
    for (let i = 1; i < missing.length; i++) {
      const n = missing[i]!
      if (n === end + 1 && end - start + 1 < STRIP_PAGE) {
        end = n
      } else {
        runs.push([start, end])
        start = n
        end = n
      }
    }
    runs.push([start, end])

    await Promise.all(runs.map(async ([a, b]) => {
      for (let i = a; i <= b; i++) loadingRef.current.add(i)
      try {
        const items = await loadStrip(a, b - a + 1)
        setThumbs(prev => {
          const next = new Map(prev)
          items.forEach((item, i) => {
            if (item?.uri) next.set(a + i, item.uri)
          })
          return next
        })
      } finally {
        for (let i = a; i <= b; i++) loadingRef.current.delete(i)
      }
    }))
  }, [loadStrip, total])

  const updateVisible = useCallback((scrollLeft: number, clientWidth: number) => {
    const first = Math.floor(Math.max(0, scrollLeft - STRIP_PAD_X) / STRIP_STRIDE)
    const visible = Math.ceil(clientWidth / STRIP_STRIDE) + 2
    const from = Math.max(0, first - STRIP_RADIUS)
    const to = Math.min(total - 1, first + visible + STRIP_RADIUS)
    setRange(prev => (prev.from === from && prev.to === to ? prev : { from, to }))
    void ensureRange(from, to)
  }, [ensureRange, total])

  useEffect(() => {
    const from = Math.max(0, currentIndex - STRIP_RADIUS)
    const to = Math.min(total - 1, currentIndex + STRIP_RADIUS)
    setRange({ from, to })
    void ensureRange(from, to)
  }, [currentIndex, ensureRange, total])

  // Keep the active thumb roughly centered when the index changes.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const left = STRIP_PAD_X + currentIndex * STRIP_STRIDE - el.clientWidth / 2 + STRIP_CELL / 2
    suppressScrollSync.current = true
    el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    window.setTimeout(() => { suppressScrollSync.current = false }, 320)
  }, [currentIndex])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateVisible(el.scrollLeft, el.clientWidth)
    let ticking = false
    const onScroll = () => {
      if (suppressScrollSync.current || ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        updateVisible(el.scrollLeft, el.clientWidth)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [updateVisible])

  const trackWidth = STRIP_PAD_X * 2 + total * STRIP_CELL + Math.max(0, total - 1) * STRIP_GAP
  const indices: number[] = []
  for (let i = range.from; i <= range.to; i++) indices.push(i)

  return (
    <div
      ref={scrollerRef}
      className="overflow-x-auto py-2 scrollbar-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
      role="listbox"
      aria-label="Photos"
    >
      <div className="relative h-14" style={{ width: trackWidth }}>
        {indices.map(i => {
          const uri = thumbs.get(i)
          const left = STRIP_PAD_X + i * STRIP_STRIDE
          return (
            <button
              key={i}
              type="button"
              data-strip-idx={i}
              role="option"
              aria-selected={i === currentIndex}
              aria-label={`Photo ${i + 1}`}
              onClick={() => onGoToIndex(i)}
              className={`absolute top-0 w-14 h-14 rounded-sm overflow-hidden bg-white/10 transition-opacity ${
                i === currentIndex ? 'ring-2 ring-white opacity-100' : 'opacity-55 hover:opacity-90'
              }`}
              style={{ left }}
            >
              {uri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r2(uri, { w: 480 })}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 animate-pulse bg-white/10" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Lightbox({
  state,
  onClose,
  onJumpToMessage,
  isSuperAdmin,
  isHidden,
  onHide,
  onUnhide,
}: {
  state: LightboxState
  onClose: () => void
  onJumpToMessage?: (ts: number, msgId: string | null) => void
  isSuperAdmin?: boolean
  isHidden?: boolean
  onHide?: (uri: string) => void
  onUnhide?: (uri: string) => void
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dismissY, setDismissY] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const dismissYRef = useRef(0)
  const touchRef = useRef<{
    mode: TouchMode
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
  const showStrip = !!(
    state.total && state.total > 1
    && state.index != null
    && state.loadStrip
    && state.onGoToIndex
    && (state.type === 'photo' || state.type === 'gif' || state.type === 'video')
  )

  const resetZoom = useCallback(() => {
    scaleRef.current = 1
    panRef.current = { x: 0, y: 0 }
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const resetDismiss = useCallback(() => {
    dismissYRef.current = 0
    setDismissY(0)
  }, [])

  useEffect(() => {
    setStatus('loading')
    resetZoom()
    resetDismiss()
    if (state.type === 'file') {
      const ext = (state.caption ?? '').split('.').pop()?.toLowerCase() ?? ''
      const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
      if (ext !== 'pdf' && !officeExts.includes(ext)) setStatus('ready')
    }
  }, [state.src, state.type, state.caption, resetZoom, resetDismiss, retry])

  // Prefetch neighbors only once the clicked image is on screen — first paint keeps the bandwidth.
  useEffect(() => {
    if (!isImage || status !== 'ready') return
    const urls = [state.prevSrc, state.nextSrc].filter((u): u is string => !!u && u !== state.src)
    if (!urls.length) return
    const idle = window.requestAnimationFrame(() => {
      urls.forEach(src => {
        const img = new Image()
        img.decoding = 'async'
        img.fetchPriority = 'low'
        img.src = src
      })
    })
    return () => window.cancelAnimationFrame(idle)
  }, [isImage, status, state.prevSrc, state.nextSrc, state.src])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen) { setMenuOpen(false); return }
        if (sheetOpen) { setSheetOpen(false); return }
        resetZoom()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') state.onPrev?.()
      if (e.key === 'ArrowRight') state.onNext?.()
      if (e.key === '0') resetZoom()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, state, resetZoom, menuOpen, sheetOpen])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

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
      return
    }
    if (t.mode === 'swipe' || t.mode === 'dismiss') {
      // Lock axis once movement is decisive
      if (t.mode === 'swipe') {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15 && dy > 0) {
          t.mode = 'dismiss'
        } else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          // horizontal — keep swipe
        } else {
          return
        }
      }
      if (t.mode === 'dismiss') {
        e.preventDefault()
        const y = Math.max(0, dy)
        dismissYRef.current = y
        setDismissY(y)
      }
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
    if (t.mode === 'dismiss') {
      if (dismissYRef.current > DISMISS_THRESHOLD) {
        onClose()
      } else {
        resetDismiss()
      }
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
  // Prefer human caption (date · sender, or real document name). Avoid opaque photo hash filenames.
  const titleText = state.caption?.trim() || typeLabel

  const actions: LightboxAction[] = []
  if (onJumpToMessage && state.ts != null) {
    actions.push({
      id: 'viewInChat',
      label: 'View in chat',
      icon: <GoToMessageIcon size={15} />,
      onPress: () => { onJumpToMessage(state.ts!, state.msgId ?? null); onClose() },
    })
  }
  if (isSuperAdmin && state.uri && (onHide || onUnhide)) {
    if (isHidden && onUnhide) {
      actions.push({
        id: 'unhide',
        label: 'Unhide',
        icon: <UnhideIcon size={15} />,
        onPress: () => { onUnhide(state.uri!) },
      })
    } else if (!isHidden && onHide) {
      actions.push({
        id: 'hide',
        label: 'Hide image',
        destructive: true,
        icon: <HideIcon size={15} />,
        onPress: () => { onHide(state.uri!); onClose() },
      })
    }
  }
  if (state.type === 'file') {
    actions.push({
      id: 'download',
      label: 'Download',
      onPress: () => { window.open(state.src, '_blank', 'noopener') },
    })
  }

  const sheetActions: ActionSheetAction[] = actions.map(a => ({
    label: a.label,
    destructive: a.destructive,
    onPress: a.onPress,
  }))

  const dismissProgress = Math.min(1, dismissY / (DISMISS_THRESHOLD * 1.8))
  const stageOpacity = 1 - dismissProgress * 0.45

  const headerActions = actions.length > 0 ? (
    <>
      {/* Desktop: primary icons */}
      <div className="hidden md:flex items-center gap-1.5 relative" ref={menuRef}>
        {actions.slice(0, 2).map(a => (
          <button
            key={a.id}
            type="button"
            title={a.label}
            aria-label={a.label}
            onClick={a.onPress}
            className={`${headerBtn} !text-white ${a.destructive ? '!text-red-400' : ''}`}
          >
            {a.icon ?? <span className="text-[11px] font-semibold px-0.5">{a.label}</span>}
          </button>
        ))}
        {actions.length > 2 && (
          <>
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
              className={`${headerBtn} !text-white`}
            >
              <MoreIcon />
            </button>
            {menuOpen && (
              <div className={`${menu} absolute right-0 top-full mt-2 min-w-[160px]`}>
                {actions.slice(2).map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { a.onPress(); setMenuOpen(false) }}
                    className={a.destructive ? menuItemDanger : menuItem}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile: overflow → ActionSheet (same pattern as selection bar) */}
      <button
        type="button"
        aria-label="Actions"
        onClick={() => setSheetOpen(true)}
        className={`md:hidden ${headerBtn} !text-white`}
      >
        <MoreIcon />
      </button>
    </>
  ) : null

  return (
    <div
      className="fixed inset-0 z-999 flex flex-col bg-black/95 [animation:fade-in_160ms_ease-out]"
      style={{ backgroundColor: `rgba(0,0,0,${0.95 - dismissProgress * 0.35})` }}
      role="dialog"
      aria-modal
      aria-label="Media viewer"
    >
      <AppHeader
        tone="media"
        dismiss
        onBack={() => { resetZoom(); onClose() }}
        title={(
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{titleText}</p>
            {counter && (
              <p className="text-[11px] text-white/55 tabular-nums truncate">{counter}</p>
            )}
          </div>
        )}
        actions={headerActions}
      />

      {/* Media stage */}
      <div
        className={`flex-1 min-h-0 relative flex items-center justify-center px-2 select-none ${isImage ? 'touch-none' : ''}`}
        style={{
          transform: dismissY ? `translateY(${dismissY}px)` : undefined,
          opacity: stageOpacity,
          transition: dragging ? undefined : 'transform 180ms ease-out, opacity 180ms ease-out',
        }}
        onClick={e => { if (e.target === e.currentTarget && !zoomed && dismissY < 8) onClose() }}
        onTouchStart={isImage ? onTouchStart : undefined}
        onTouchMove={isImage ? onTouchMove : undefined}
        onTouchEnd={isImage ? onTouchEnd : undefined}
        onTouchCancel={isImage ? () => { touchRef.current.mode = 'none'; setDragging(false); resetDismiss() } : undefined}
      >
        <button
          type="button"
          aria-label="Previous"
          disabled={!canPrev}
          onClick={() => state.onPrev?.()}
          className={`hidden md:flex absolute left-[max(0.25rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2 z-10 ${headerBtn} !text-white ${canPrev ? 'opacity-80 hover:opacity-100' : 'opacity-25 cursor-default'}`}
        >
          <ChevronIcon dir="left" />
        </button>
        <button
          type="button"
          aria-label="Next"
          disabled={!canNext}
          onClick={() => state.onNext?.()}
          className={`hidden md:flex absolute right-[max(0.25rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2 z-10 ${headerBtn} !text-white ${canNext ? 'opacity-80 hover:opacity-100' : 'opacity-25 cursor-default'}`}
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
              className={`mt-2 ${headerChip} !h-8 !text-white`}
            >
              <span>Try again</span>
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
                      className="w-full flex-1 min-h-0 rounded-sm liquid-glass"
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
          // Archive media is served via same-origin /api/media — next/image is intentionally unused.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${state.src}-${retry}`}
            src={state.src}
            alt={state.caption || ''}
            draggable={false}
            fetchPriority="high"
            decoding="async"
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

      {/* Bottom chrome — filmstrip + optional reset zoom */}
      <div className="sticky bottom-0 z-20 liquid-glass-bar liquid-glass-bar-frosted text-white shrink-0 border-b-0 border-t border-black/10 dark:border-white/10">
        {showStrip && (
          <LightboxFilmstrip
            currentIndex={(state.index ?? 1) - 1}
            total={state.total!}
            loadStrip={state.loadStrip!}
            onGoToIndex={state.onGoToIndex!}
          />
        )}
        <div className="px-4 pt-1 pb-[calc(0.5rem+var(--resibo-safe-bottom))]">
          {zoomed && isImage ? (
            <button type="button" onClick={resetZoom} className="text-white/50 text-[11px] hover:text-white/90 transition-colors">
              Reset zoom
            </button>
          ) : !showStrip ? (
            <div className="h-1" />
          ) : null}
        </div>
      </div>

      {sheetOpen && (
        <ActionSheet
          title={titleText}
          actions={sheetActions}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}
