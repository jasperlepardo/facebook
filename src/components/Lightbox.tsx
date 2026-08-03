'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LightboxState } from '@/types'
import { headerBtn, headerChip, menu, menuItem, menuItemDanger } from '@/lib/ui'
import ActionSheet, { ActionSheetAction } from '@/components/ActionSheet'
import { GoToMessageIcon, GoToGalleryIcon, HideIcon, UnhideIcon } from '@/components/icons'
import { r2 } from '@/lib/format'
import LightboxShell, {
  LightboxStageSpinner,
  lightboxCounterFromState,
  lightboxTitleFromState,
} from '@/components/LightboxShell'

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
const PINCH_MIN = 1
const PINCH_MAX = 4
const STRIP_PAGE = 24
const STRIP_RADIUS = 12
/** Match AppLayout sheet dismiss — whole page slides down. */
const DISMISS_RATIO = 0.22
const DISMISS_VELOCITY = 0.55 // px/ms
const DISMISS_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DISMISS_MS = 340
/** Horizontal pager — follow finger, then slide off-screen. */
const SLIDE_RATIO = 0.25
const SLIDE_VELOCITY = 0.4 // px/ms
const SLIDE_MS = 280
const SLIDE_EASE = DISMISS_EASE
const SLIDE_RUBBER = 0.35

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
              className={`absolute top-0 w-14 h-14 rounded-sm overflow-hidden bg-black/10 dark:bg-white/10 transition-opacity ${
                i === currentIndex
                  ? 'ring-2 ring-gray-900 dark:ring-white opacity-100'
                  : 'opacity-55 hover:opacity-90'
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
                <span className="absolute inset-0 animate-pulse bg-black/10 dark:bg-white/10" />
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
  onGoToGallery,
  isSuperAdmin,
  isHidden,
  onHide,
  onUnhide,
}: {
  state: LightboxState
  onClose: () => void
  onJumpToMessage?: (ts: number, msgId: string | null) => void
  onGoToGallery?: (target: {
    tab: NonNullable<LightboxState['mediaType']> | 'files' | 'photos'
    uri?: string
    ts?: number
  }) => void
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const slideViewportRef = useRef<HTMLDivElement>(null)
  const slideTrackRef = useRef<HTMLDivElement>(null)
  const currentImgRef = useRef<HTMLImageElement | null>(null)
  const scaleRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const dismissYRef = useRef(0)
  const slideXRef = useRef(0)
  const slideBusyRef = useRef(false)
  const closingRef = useRef(false)
  /** Neighbor URL we slid to — keep status ready across the state handoff. */
  const pendingNavSrcRef = useRef<string | null>(null)
  const srcRef = useRef(state.src)
  srcRef.current = state.src
  const touchRef = useRef<{
    mode: TouchMode
    startX: number
    startY: number
    startPan: { x: number; y: number }
    startDist: number
    startScale: number
    lastTap: number
    lastX: number
    lastY: number
    startT: number
    lastT: number
  }>({
    mode: 'none', startX: 0, startY: 0, startPan: { x: 0, y: 0 },
    startDist: 0, startScale: 1, lastTap: 0, lastX: 0, lastY: 0, startT: 0, lastT: 0,
  })

  const canPrev = !!state.onPrev
  const canNext = !!state.onNext
  const onPrev = state.onPrev
  const onNext = state.onNext
  const isImage = state.type === 'photo' || state.type === 'gif'
  const useSlidePager = isImage
  const zoomed = scale > 1.05
  const slidePagerActive = useSlidePager && !zoomed

  const getStageWidth = useCallback(() => {
    return slideViewportRef.current?.clientWidth || window.innerWidth
  }, [])

  const applySlideTransform = useCallback((offsetPx: number, animate: boolean) => {
    const track = slideTrackRef.current
    if (!track) return
    const w = getStageWidth()
    slideXRef.current = offsetPx
    const base = -w
    const ms = animate ? SLIDE_MS : 0
    track.style.transition = ms > 0 ? `transform ${ms}ms ${SLIDE_EASE}` : 'none'
    track.style.transform = `translate3d(${base + offsetPx}px,0,0)`
  }, [getStageWidth])

  const resetSlideTrack = useCallback((animate = false) => {
    applySlideTransform(0, animate)
  }, [applySlideTransform])

  const layoutSlideTrack = useCallback(() => {
    const viewport = slideViewportRef.current
    const track = slideTrackRef.current
    if (!viewport || !track) return
    const w = viewport.clientWidth || window.innerWidth
    for (const child of track.children) {
      const el = child as HTMLElement
      el.style.flex = `0 0 ${w}px`
      el.style.width = `${w}px`
      el.style.minWidth = `${w}px`
    }
    track.style.width = `${w * 3}px`
    applySlideTransform(slideXRef.current, false)
  }, [applySlideTransform])

  const rubberBandSlide = useCallback((dx: number) => {
    if (dx > 0 && !canPrev) return Math.pow(dx, 0.72) * SLIDE_RUBBER
    if (dx < 0 && !canNext) return -Math.pow(-dx, 0.72) * SLIDE_RUBBER
    return dx
  }, [canPrev, canNext])

  const commitSlide = useCallback((dir: 'prev' | 'next') => {
    if (slideBusyRef.current) return
    if (dir === 'prev' && !canPrev) return
    if (dir === 'next' && !canNext) return
    slideBusyRef.current = true
    const srcAtCommit = state.src
    const targetSrc = dir === 'prev' ? state.prevSrc : state.nextSrc
    pendingNavSrcRef.current = targetSrc ?? null
    const w = getStageWidth()
    applySlideTransform(dir === 'prev' ? w : -w, true)
    window.setTimeout(() => {
      void (async () => {
        try {
          if (dir === 'prev') await Promise.resolve(onPrev?.())
          else await Promise.resolve(onNext?.())
        } finally {
          // If navigation never landed a new src, spring back.
          queueMicrotask(() => {
            requestAnimationFrame(() => {
              if (srcRef.current === srcAtCommit) {
                pendingNavSrcRef.current = null
                slideBusyRef.current = false
                resetSlideTrack(true)
              }
            })
          })
        }
      })()
    }, SLIDE_MS)
  }, [
    applySlideTransform, canNext, canPrev, getStageWidth, onNext, onPrev,
    resetSlideTrack, state.nextSrc, state.prevSrc, state.src,
  ])

  const navigatePrev = useCallback(() => {
    if (!canPrev || slideBusyRef.current) return
    if (slidePagerActive) commitSlide('prev')
    else {
      pendingNavSrcRef.current = state.prevSrc ?? null
      void Promise.resolve(onPrev?.())
    }
  }, [canPrev, commitSlide, onPrev, slidePagerActive, state.prevSrc])

  const navigateNext = useCallback(() => {
    if (!canNext || slideBusyRef.current) return
    if (slidePagerActive) commitSlide('next')
    else {
      pendingNavSrcRef.current = state.nextSrc ?? null
      void Promise.resolve(onNext?.())
    }
  }, [canNext, commitSlide, onNext, slidePagerActive, state.nextSrc])
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

  const setPanelPull = useCallback((y: number, animate: boolean) => {
    const panel = panelRef.current
    const scrim = scrimRef.current
    if (!panel) return
    const h = panel.offsetHeight || window.innerHeight
    const pull = Math.max(0, y)
    dismissYRef.current = pull
    const ms = animate ? DISMISS_MS : 0
    panel.style.transition = ms > 0 ? `transform ${ms}ms ${DISMISS_EASE}` : 'none'
    panel.style.transform = pull ? `translate3d(0,${pull}px,0)` : 'translate3d(0,0,0)'
    if (scrim) {
      scrim.style.transition = ms > 0 ? `opacity ${ms}ms ${DISMISS_EASE}` : 'none'
      scrim.style.opacity = String(Math.max(0, 1 - Math.min(1, pull / h)))
    }
  }, [])

  const resetDismiss = useCallback(() => {
    setPanelPull(0, true)
  }, [setPanelPull])

  const finishClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    const panel = panelRef.current
    const scrim = scrimRef.current
    const h = panel?.offsetHeight || window.innerHeight
    if (panel) {
      panel.style.transition = `transform ${DISMISS_MS}ms ${DISMISS_EASE}`
      panel.style.transform = `translate3d(0,${h}px,0)`
    }
    if (scrim) {
      scrim.style.transition = `opacity ${DISMISS_MS}ms ${DISMISS_EASE}`
      scrim.style.opacity = '0'
    }
    window.setTimeout(() => onClose(), DISMISS_MS)
  }, [onClose])

  const requestClose = useCallback(() => {
    resetZoom()
    finishClose()
  }, [resetZoom, finishClose])

  const markImageReady = useCallback((el: HTMLImageElement | null) => {
    currentImgRef.current = el
    if (el && el.complete && el.naturalWidth > 0) setStatus('ready')
  }, [])

  const onCurrentImageLoad = useCallback(async (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget
    currentImgRef.current = el
    try { await el.decode() } catch { /* decode optional */ }
    setStatus('ready')
  }, [])

  useLayoutEffect(() => {
    // Snap the 3-slide track to the new current in the same frame as the src swap
    // so we never flash the previous center slide after a commit animation.
    resetSlideTrack(false)
    slideBusyRef.current = false
  }, [state.src, resetSlideTrack])

  useEffect(() => {
    resetZoom()
    dismissYRef.current = 0
    const panel = panelRef.current
    const scrim = scrimRef.current
    if (panel) {
      panel.style.transition = 'none'
      panel.style.transform = 'translate3d(0,0,0)'
    }
    if (scrim) {
      scrim.style.transition = 'none'
      scrim.style.opacity = '1'
    }

    if (state.type === 'file') {
      const ext = (state.caption ?? '').split('.').pop()?.toLowerCase() ?? ''
      const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
      if (ext !== 'pdf' && !officeExts.includes(ext)) {
        setStatus('ready')
        return
      }
    }

    // Neighbor we already painted in the slide track — keep status ready (no spinner gap).
    if (pendingNavSrcRef.current && pendingNavSrcRef.current === state.src) {
      pendingNavSrcRef.current = null
      return
    }
    pendingNavSrcRef.current = null

    const img = currentImgRef.current
    if (img && img.currentSrc === state.src && img.complete && img.naturalWidth > 0) {
      setStatus('ready')
      return
    }
    setStatus('loading')
  }, [state.src, state.type, state.caption, resetZoom, retry])

  useLayoutEffect(() => {
    if (!useSlidePager) return
    layoutSlideTrack()
    const onResize = () => layoutSlideTrack()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [layoutSlideTrack, useSlidePager, state.src, state.prevSrc, state.nextSrc])

  // Warm neighbors as soon as the current frame is ready; also warm while sliding.
  useEffect(() => {
    if (!isImage) return
    const urls = [state.prevSrc, state.nextSrc].filter((u): u is string => !!u && u !== state.src)
    if (!urls.length) return
    const priority = status === 'ready' ? 'high' : 'low'
    const idle = window.requestAnimationFrame(() => {
      urls.forEach(src => {
        const img = new Image()
        img.decoding = 'async'
        img.fetchPriority = priority
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
        requestClose()
        return
      }
      if (e.key === 'ArrowLeft') navigatePrev()
      if (e.key === 'ArrowRight') navigateNext()
      if (e.key === '0') resetZoom()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [requestClose, state, resetZoom, menuOpen, sheetOpen, navigatePrev, navigateNext])

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
    if (closingRef.current) return
    // Don't steal touches from native video/file controls or chrome buttons.
    if (!isImage) {
      const el = e.target as HTMLElement
      if (el.closest('video, a, button, iframe, input, textarea')) return
    }
    // Allow page-dismiss on any media; pinch/zoom only for images.
    setDragging(true)
    const t = touchRef.current
    const nowPerf = performance.now()
    if (isImage && e.touches.length === 2) {
      t.mode = 'pinch'
      t.startDist = dist(e.touches[0], e.touches[1])
      t.startScale = scaleRef.current
      return
    }
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    if (isImage) {
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
    }
    t.startX = touch.clientX
    t.startY = touch.clientY
    t.lastX = touch.clientX
    t.lastY = touch.clientY
    t.startT = nowPerf
    t.lastT = nowPerf
    t.startPan = { ...panRef.current }
    t.mode = zoomed ? 'pan' : 'swipe'
  }

  function onTouchMove(e: React.TouchEvent) {
    if (closingRef.current) return
    const t = touchRef.current
    if (isImage && t.mode === 'pinch' && e.touches.length === 2) {
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
      if (!isImage) return
      e.preventDefault()
      const next = { x: t.startPan.x + dx, y: t.startPan.y + dy }
      panRef.current = next
      setPan(next)
      return
    }
    if (t.mode === 'swipe' || t.mode === 'dismiss') {
      if (t.mode === 'swipe') {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15 && dy > 0) {
          t.mode = 'dismiss'
          if (slidePagerActive && slideXRef.current !== 0) resetSlideTrack(true)
          t.startY = touch.clientY
          t.startT = performance.now()
        } else if (isImage && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          if (slidePagerActive) {
            e.preventDefault()
            t.lastX = touch.clientX
            t.lastT = performance.now()
            applySlideTransform(rubberBandSlide(dx), false)
          }
        } else {
          return
        }
      }
      if (t.mode === 'dismiss') {
        e.preventDefault()
        const pull = Math.max(0, touch.clientY - t.startY)
        t.lastY = touch.clientY
        t.lastT = performance.now()
        setPanelPull(pull, false)
      }
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (closingRef.current) return
    const t = touchRef.current
    if (t.mode === 'pinch') {
      if (scaleRef.current < 1.05) resetZoom()
      t.mode = 'none'
      setDragging(false)
      return
    }
    if (t.mode === 'dismiss') {
      const h = panelRef.current?.offsetHeight || window.innerHeight
      const elapsed = Math.max(1, t.lastT - t.startT)
      const velocity = (t.lastY - t.startY) / elapsed
      if (dismissYRef.current > h * DISMISS_RATIO || velocity > DISMISS_VELOCITY) {
        finishClose()
      } else {
        resetDismiss()
      }
      t.mode = 'none'
      setDragging(false)
      return
    }
    if (isImage && t.mode === 'swipe' && e.changedTouches[0]) {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - t.startX
      if (slidePagerActive) {
        const w = getStageWidth()
        const elapsed = Math.max(1, t.lastT - t.startT)
        const velocity = (t.lastX - t.startX) / elapsed
        const commit = Math.abs(dx) > w * SLIDE_RATIO || Math.abs(velocity) > SLIDE_VELOCITY
        if (commit && dx > 0 && canPrev) commitSlide('prev')
        else if (commit && dx < 0 && canNext) commitSlide('next')
        else resetSlideTrack(true)
      } else {
        if (dx > SWIPE_THRESHOLD) onPrev?.()
        else if (dx < -SWIPE_THRESHOLD) onNext?.()
      }
    }
    t.mode = 'none'
    setDragging(false)
  }

  const counter = lightboxCounterFromState(state)
  // Prefer human caption (date · sender, or real document name). Avoid opaque photo hash filenames.
  const titleText = lightboxTitleFromState(state)

  const actions: LightboxAction[] = []
  const fromChat = state.source === 'chat'
  const fromGallery = state.source === 'gallery' || (!state.source && !!state.mediaType)
  if (fromChat && onGoToGallery) {
    const tab = state.mediaType
      ?? (state.type === 'file' ? 'files' as const
        : state.type === 'video' ? 'videos' as const
        : state.type === 'gif' ? 'gifs' as const
        : 'photos' as const)
    actions.push({
      id: 'goToGallery',
      label: 'Go to gallery',
      icon: <GoToGalleryIcon size={15} />,
      onPress: () => {
        onGoToGallery({ tab, uri: state.uri, ts: state.ts })
        onClose()
      },
    })
  } else if (onJumpToMessage && state.ts != null && (fromGallery || !fromChat)) {
    actions.push({
      id: 'viewInChat',
      label: 'Go to chat',
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
            className={`${headerBtn} ${a.destructive ? '!text-red-500 dark:!text-red-400' : ''}`}
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
              className={headerBtn}
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
        className={`md:hidden ${headerBtn}`}
      >
        <MoreIcon />
      </button>
    </>
  ) : null

  return (
    <>
    <LightboxShell
      title={titleText}
      counter={counter}
      onClose={requestClose}
      headerActions={headerActions}
      scrimRef={scrimRef}
      panelRef={panelRef}
      canPrev={canPrev}
      canNext={canNext}
      onPrev={navigatePrev}
      onNext={navigateNext}
      strip={showStrip ? (
        <LightboxFilmstrip
          currentIndex={(state.index ?? 1) - 1}
          total={state.total!}
          loadStrip={state.loadStrip!}
          onGoToIndex={state.onGoToIndex!}
        />
      ) : undefined}
      footer={zoomed && isImage ? (
        <button type="button" onClick={resetZoom} className="text-mist-500 dark:text-white/50 text-[11px] hover:text-mist-800 dark:hover:text-white/90 transition-colors">
          Reset zoom
        </button>
      ) : !showStrip ? (
        <div className="h-1" />
      ) : null}
      stageProps={{
        onClick: e => { if (e.target === e.currentTarget && !zoomed && dismissYRef.current < 8) requestClose() },
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel: () => {
          touchRef.current.mode = 'none'
          setDragging(false)
          resetDismiss()
          if (slidePagerActive) resetSlideTrack(true)
        },
      }}
    >
        {status === 'loading' && <LightboxStageSpinner />}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <p className="text-mist-700 dark:text-white/80 text-sm font-medium">Couldn&apos;t load media</p>
            <p className="text-mist-400 dark:text-white/40 text-xs max-w-xs truncate">{state.src}</p>
            <button
              type="button"
              onClick={() => { setRetry(r => r + 1); setStatus('loading') }}
              className={`mt-2 ${headerChip} !h-8`}
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
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-mist-400 dark:text-white/40 text-sm">
                      Preview not available
                    </div>
                  )}
              </div>
            )
          })()
        ) : status !== 'error' ? (
          // Track is left-aligned (not flex-centered): translate(-w) lands on the middle slot.
          // Transform/width are JS-owned — do not put them in React style or re-renders
          // (e.g. setDragging) will clobber an in-flight slide and cause settle jitter.
          <div ref={slideViewportRef} className="relative w-full h-full overflow-hidden">
            <div
              ref={slideTrackRef}
              className="absolute inset-y-0 left-0 flex h-full items-center will-change-transform"
            >
              <div className="h-full w-1/3 min-w-0 flex items-center justify-center shrink-0 grow-0">
                {state.prevSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.prevSrc}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="max-w-full max-h-full rounded-sm object-contain"
                  />
                ) : null}
              </div>
              <div className="h-full w-1/3 min-w-0 flex items-center justify-center shrink-0 grow-0">
                {/* Archive media is served via same-origin /api/media — next/image is intentionally unused. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={retry}
                  ref={markImageReady}
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
                  onLoad={onCurrentImageLoad}
                  onError={() => setStatus('error')}
                />
              </div>
              <div className="h-full w-1/3 min-w-0 flex items-center justify-center shrink-0 grow-0">
                {state.nextSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.nextSrc}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="max-w-full max-h-full rounded-sm object-contain"
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
    </LightboxShell>

      {sheetOpen && (
        <ActionSheet
          title={titleText}
          actions={sheetActions}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}
