'use client'
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Section } from '@/types'
import AppNav from './AppNav'

export interface AppLayoutControls {
  onShowDetail: () => void
  onShowList:   () => void
}

interface AppLayoutProps {
  section: Section
  onSectionChange: (s: Section) => void
  initials: string
  name?: string
  prevSection?: 'chat' | 'hashtags' | 'story'
  listPane:   (controls: AppLayoutControls) => ReactNode
  detailPane: (controls: AppLayoutControls) => ReactNode
  mediaPane?: ReactNode
  onCloseMediaPane?: () => void
  listGrow?: number
  detailGrow?: number
  hideListPane?: boolean
  centeredDetail?: boolean
}

/** iOS-like push easing */
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const SHEET_MS = 340
const EDGE_PX = 28
const COMMIT_RATIO = 0.35
const COMMIT_VELOCITY = 0.45 // px/ms
const SHEET_DISMISS_RATIO = 0.22
const SHEET_DISMISS_VELOCITY = 0.55 // px/ms
const SHEET_HANDLE_PX = 56

type DragLock = 'none' | 'h' | 'v'
type SheetPhase = 'closed' | 'open' | 'closing'

function isMobileSheetViewport() {
  return !window.matchMedia('(min-width: 768px)').matches
}

function sheetScrollAtTop(root: HTMLElement) {
  const nodes = root.querySelectorAll<HTMLElement>('*')
  for (const el of nodes) {
    const style = window.getComputedStyle(el)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1) {
      if (el.scrollTop > 1) return false
    }
  }
  return true
}

export default function AppLayout({ section, onSectionChange, initials, name, prevSection, listPane, detailPane, mediaPane, onCloseMediaPane, listGrow = 4, detailGrow = 7, hideListPane = false, centeredDetail = false }: AppLayoutProps) {
  // SSR-safe defaults — deep links open the detail pane in useEffect after hydrate
  const [mobileShowList, setMobileShowList] = useState(
    section === 'chat' || section === 'hashtags'
  )
  const [navExpanded, setNavExpanded] = useState(false)

  const listRef   = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const scrimRef  = useRef<HTMLDivElement>(null)
  const sheetPanelRef = useRef<HTMLDivElement>(null)
  const sheetScrimRef = useRef<HTMLButtonElement>(null)
  const onCloseMediaPaneRef = useRef(onCloseMediaPane)
  const sheetContentRef = useRef<ReactNode>(null)
  const sheetPhaseRef = useRef<SheetPhase>(mediaPane ? 'open' : 'closed')
  const sheetCloseTimerRef = useRef<number | null>(null)
  const sheetMountedRef = useRef(!!mediaPane)
  /** 0 = detail open, 1 = detail off-screen (list). */
  const progressRef = useRef(section === 'chat' || section === 'hashtags' ? 1 : 0)
  const mobileShowListRef = useRef(mobileShowList)
  const mediaPaneRef = useRef(!!mediaPane)
  const [sheetMounted, setSheetMounted] = useState(!!mediaPane)
  const drag = useRef({
    tracking: false,
    lock: 'none' as DragLock,
    startX: 0,
    startY: 0,
    startT: 0,
    width: 0,
    lastX: 0,
    lastT: 0,
  })
  const sheetDrag = useRef({
    tracking: false,
    active: false,
    startX: 0,
    startY: 0,
    startT: 0,
    lastY: 0,
    lastT: 0,
    dy: 0,
  })
  const reduceMotion = useRef(false)

  if (mediaPane) sheetContentRef.current = mediaPane

  onCloseMediaPaneRef.current = onCloseMediaPane
  mobileShowListRef.current = mobileShowList
  mediaPaneRef.current = !!mediaPane
  sheetMountedRef.current = sheetMounted
  const mediaPaneOpen = !!mediaPane

  const setBehindProgress = useCallback((progress: number, animate: boolean) => {
    const detail = detailRef.current
    if (!detail || !isMobileSheetViewport()) return
    const p = Math.min(1, Math.max(0, progress))
    const ms = reduceMotion.current || !animate ? 0 : SHEET_MS
    const scale = 0.92 + 0.08 * p
    const peek = 1 - p
    detail.style.transition = ms > 0
      ? `transform ${ms}ms ${SHEET_EASE}, border-radius ${ms}ms ${SHEET_EASE}`
      : 'none'
    detail.style.transformOrigin = 'top center'
    // Same transform shape at every progress so drag + dismiss stay continuous.
    detail.style.transform =
      `scale(${scale}) translateY(calc((8px + env(safe-area-inset-top, 0px)) * ${peek}))`
    detail.style.borderRadius = `${peek}rem`
  }, [])

  const clearBehindCard = useCallback(() => {
    const detail = detailRef.current
    if (!detail) return
    detail.style.transition = 'none'
    detail.style.transform = ''
    detail.style.transformOrigin = ''
    detail.style.borderRadius = ''
  }, [])

  const finishSheetClose = useCallback(() => {
    sheetCloseTimerRef.current = null
    sheetPhaseRef.current = 'closed'
    setSheetMounted(false)
    sheetContentRef.current = null
    clearBehindCard()
    if (!isMobileSheetViewport() || centeredDetail || hideListPane) return
    // Restore list/detail push transforms without animating from the stacked pose.
    const p = mobileShowListRef.current ? 1 : 0
    progressRef.current = p
    const detail = detailRef.current
    if (detail) {
      detail.style.transition = 'none'
      detail.style.transform = `translate3d(${p * 100}%,0,0)`
    }
    const list = listRef.current
    if (list) {
      list.style.transition = 'none'
      list.style.transform = `translate3d(${-28 * (1 - p)}%,0,0)`
    }
  }, [centeredDetail, clearBehindCard, hideListPane])

  const animateSheetClosed = useCallback((then?: () => void) => {
    if (sheetPhaseRef.current === 'closing') return
    sheetPhaseRef.current = 'closing'

    const panel = sheetPanelRef.current
    const scrim = sheetScrimRef.current
    const mobile = isMobileSheetViewport()
    const ms = reduceMotion.current || !mobile ? 0 : SHEET_MS

    if (scrim) {
      // Stop blocking the UI as soon as dismiss starts (opacity anim is cosmetic).
      scrim.style.pointerEvents = 'none'
      scrim.style.transition = ms > 0 ? `opacity ${ms}ms ${SHEET_EASE}` : 'none'
      scrim.style.opacity = '0'
    }
    if (panel) {
      panel.style.pointerEvents = 'none'
      // Drop enter keyframes so they can't fight the exit transition.
      panel.style.animation = 'none'
      const computed = getComputedStyle(panel).transform
      panel.style.transform = computed === 'none' ? 'translate3d(0,0,0)' : computed
      void panel.offsetHeight
      panel.style.transition = ms > 0 ? `transform ${ms}ms ${SHEET_EASE}` : 'none'
      panel.style.transform = 'translate3d(0,100%,0)'
    }
    // Expand the behind card in lockstep with the sheet slide (same duration/easing).
    setBehindProgress(1, ms > 0)

    if (sheetCloseTimerRef.current) window.clearTimeout(sheetCloseTimerRef.current)
    sheetCloseTimerRef.current = window.setTimeout(() => {
      then?.()
      finishSheetClose()
    }, ms)
  }, [finishSheetClose, setBehindProgress])

  const requestCloseSheet = useCallback(() => {
    if (!isMobileSheetViewport()) {
      onCloseMediaPaneRef.current?.()
      return
    }
    if (sheetPhaseRef.current !== 'open') return
    // Clear parent state immediately so chat/nav aren't inert for the whole exit anim.
    onCloseMediaPaneRef.current?.()
    animateSheetClosed()
  }, [animateSheetClosed])

  // Keep the sheet mounted through the exit animation when the parent clears mediaPane.
  useEffect(() => {
    if (mediaPaneOpen) {
      if (sheetCloseTimerRef.current) {
        window.clearTimeout(sheetCloseTimerRef.current)
        sheetCloseTimerRef.current = null
      }
      sheetPhaseRef.current = 'open'
      setSheetMounted(true)
      // Clear any leftover dismiss transform from a previous close.
      requestAnimationFrame(() => {
        const panel = sheetPanelRef.current
        const scrim = sheetScrimRef.current
        if (panel) {
          panel.style.transition = 'none'
          panel.style.transform = ''
          panel.style.pointerEvents = ''
          if (!isMobileSheetViewport()) panel.style.animation = 'none'
        }
        if (scrim) {
          scrim.style.transition = 'none'
          scrim.style.opacity = ''
          scrim.style.pointerEvents = ''
        }
      })
      return
    }
    if (sheetPhaseRef.current === 'closing') {
      // Timer may have been cleared — ensure we still unmount.
      if (!sheetCloseTimerRef.current && sheetMountedRef.current) {
        finishSheetClose()
      }
      return
    }
    if (!sheetMountedRef.current) {
      sheetPhaseRef.current = 'closed'
      return
    }
    if (!isMobileSheetViewport()) {
      finishSheetClose()
      return
    }
    animateSheetClosed()
  }, [mediaPaneOpen, animateSheetClosed, finishSheetClose])

  // Show immediately when open (don't wait for effect), keep mounted while exit anim runs.
  const sheetVisible = mediaPaneOpen || sheetMounted

  useEffect(() => () => {
    if (sheetCloseTimerRef.current) window.clearTimeout(sheetCloseTimerRef.current)
  }, [])

  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    if (!sheetVisible || !isMobileSheetViewport()) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sheetVisible])

  // Swipe down to dismiss the mobile page sheet
  useEffect(() => {
    if (!sheetVisible || sheetPhaseRef.current === 'closing') return
    const panel = sheetPanelRef.current
    const scrim = sheetScrimRef.current
    if (!panel) return
    if (!isMobileSheetViewport()) return

    const setScrimOpacity = (dy: number, h: number) => {
      if (!scrim) return
      scrim.style.opacity = String(Math.max(0, 1 - Math.min(1, Math.max(0, dy / h))))
    }

    const resetSheet = (animate: boolean) => {
      const ms = reduceMotion.current ? 0 : SHEET_MS
      panel.style.transition = animate && ms > 0 ? `transform ${ms}ms ${SHEET_EASE}` : 'none'
      panel.style.transform = 'translate3d(0,0,0)'
      if (scrim) {
        scrim.style.transition = animate && ms > 0 ? `opacity ${ms}ms ${SHEET_EASE}` : 'none'
        scrim.style.opacity = '1'
      }
      setBehindProgress(0, animate && ms > 0)
    }

    const onStart = (e: TouchEvent) => {
      if (sheetPhaseRef.current !== 'open') return
      if (reduceMotion.current || e.touches.length !== 1) return
      const t = e.touches[0]
      const inHandle = t.clientY - panel.getBoundingClientRect().top <= SHEET_HANDLE_PX
      sheetDrag.current = {
        tracking: true,
        active: inHandle,
        startX: t.clientX,
        startY: t.clientY,
        startT: performance.now(),
        lastY: t.clientY,
        lastT: performance.now(),
        dy: 0,
      }
    }

    const onMove = (e: TouchEvent) => {
      const d = sheetDrag.current
      if (!d.tracking) return
      const t = e.touches[0]
      const dy = t.clientY - d.startY
      const dx = t.clientX - d.startX

      if (!d.active) {
        if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return
        if (Math.abs(dx) > Math.abs(dy)) {
          d.tracking = false
          return
        }
        if (dy < 0 || !sheetScrollAtTop(panel)) {
          d.tracking = false
          return
        }
        d.active = true
        d.startY = t.clientY
        d.startT = performance.now()
        d.dy = 0
        panel.style.animation = 'none'
        return
      }

      const h = panel.offsetHeight || window.innerHeight
      const pull = t.clientY - d.startY
      if (pull < 0) {
        d.dy = 0
        panel.style.transition = 'none'
        panel.style.transform = 'translate3d(0,0,0)'
        setScrimOpacity(0, h)
        setBehindProgress(0, false)
        return
      }

      e.preventDefault()
      d.dy = pull
      d.lastY = t.clientY
      d.lastT = performance.now()
      panel.style.transition = 'none'
      panel.style.transform = `translate3d(0,${pull}px,0)`
      if (scrim) scrim.style.transition = 'none'
      setScrimOpacity(pull, h)
      setBehindProgress(pull / h, false)
    }

    const onEnd = () => {
      const d = sheetDrag.current
      if (!d.tracking) return
      const wasActive = d.active
      d.tracking = false
      d.active = false
      if (!wasActive) return

      const elapsed = Math.max(1, performance.now() - d.startT)
      const velocity = (d.lastY - d.startY) / elapsed
      const h = panel.offsetHeight || window.innerHeight
      if (d.dy > h * SHEET_DISMISS_RATIO || velocity > SHEET_DISMISS_VELOCITY) {
        requestCloseSheet()
      } else {
        resetSheet(true)
      }
    }

    const onAnimEnd = (e: AnimationEvent) => {
      if (e.target !== panel || e.animationName !== 'sheet-up') return
      panel.style.animation = 'none'
      panel.style.transform = 'translate3d(0,0,0)'
    }

    panel.addEventListener('touchstart', onStart, { passive: true })
    panel.addEventListener('touchmove', onMove, { passive: false })
    panel.addEventListener('touchend', onEnd)
    panel.addEventListener('touchcancel', onEnd)
    panel.addEventListener('animationend', onAnimEnd)
    return () => {
      panel.removeEventListener('touchstart', onStart)
      panel.removeEventListener('touchmove', onMove)
      panel.removeEventListener('touchend', onEnd)
      panel.removeEventListener('touchcancel', onEnd)
      panel.removeEventListener('animationend', onAnimEnd)
    }
  }, [sheetVisible, requestCloseSheet, setBehindProgress])

  const applyProgress = useCallback((p: number, animate: boolean) => {
    const progress = Math.min(1, Math.max(0, p))
    progressRef.current = progress
    const ms = reduceMotion.current ? 0 : SHEET_MS
    const transition = animate && ms > 0
      ? `transform ${ms}ms ${SHEET_EASE}`
      : 'none'
    const opacityTransition = animate && ms > 0
      ? `opacity ${ms}ms ${SHEET_EASE}`
      : 'none'

    // Sheet owns the behind-card pose while mounted (including exit).
    if ((sheetMountedRef.current || mediaPaneRef.current) && isMobileSheetViewport()) return

    const detail = detailRef.current
    if (detail) {
      detail.style.transition = transition
      detail.style.transformOrigin = ''
      detail.style.transform = `translate3d(${progress * 100}%,0,0)`
      detail.style.borderRadius = ''
    }
    const list = listRef.current
    if (list) {
      list.style.transition = transition
      list.style.transform = `translate3d(${-28 * (1 - progress)}%,0,0)`
    }
    const scrim = scrimRef.current
    if (scrim) {
      scrim.style.transition = opacityTransition
      scrim.style.opacity = String(0.4 * (1 - progress))
    }
  }, [])

  const clearMobileTransforms = useCallback(() => {
    for (const el of [detailRef.current, listRef.current]) {
      if (!el) continue
      el.style.transition = 'none'
      el.style.transform = ''
      el.style.transformOrigin = ''
      el.style.borderRadius = ''
    }
    if (scrimRef.current) {
      scrimRef.current.style.transition = 'none'
      scrimRef.current.style.opacity = ''
    }
  }, [])

  // Enter stacked-card pose when the sheet opens — same timing as sheet-up.
  useEffect(() => {
    if (!sheetVisible || !mediaPane) return
    if (!isMobileSheetViewport() || centeredDetail || hideListPane) return
    const detail = detailRef.current
    if (detail) {
      detail.style.transition = 'none'
      detail.style.transformOrigin = 'top center'
      setBehindProgress(1, false)
      void detail.offsetHeight
    }
    // Next frame so it runs with the sheet's enter animation, not after it.
    requestAnimationFrame(() => setBehindProgress(0, true))
  }, [sheetVisible, mediaPane, setBehindProgress, centeredDetail, hideListPane])

  useEffect(() => {
    if (localStorage.getItem('navExpanded') === '1') setNavExpanded(true)
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const p = new URLSearchParams(window.location.search)
    if (p.get('msg') || p.get('thread') || p.get('h')) {
      progressRef.current = 0
      setMobileShowList(false)
      requestAnimationFrame(() => applyProgress(0, false))
    } else {
      applyProgress(progressRef.current, false)
    }
  }, [applyProgress])

  // Desktop / alternate layouts: don't leave mobile transforms hanging
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => {
      if (mq.matches || centeredDetail || hideListPane) clearMobileTransforms()
      else if (!sheetMountedRef.current) applyProgress(mobileShowListRef.current ? 1 : 0, false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [centeredDetail, hideListPane, applyProgress, clearMobileTransforms])

  function toggleNav() {
    setNavExpanded(v => {
      const next = !v
      localStorage.setItem('navExpanded', next ? '1' : '0')
      return next
    })
  }

  const settle = useCallback((showList: boolean, animate: boolean) => {
    applyProgress(showList ? 1 : 0, animate)
    setMobileShowList(showList)
  }, [applyProgress])

  const slideTo = useCallback((showList: boolean) => {
    // Paint from-state, then animate to destination
    applyProgress(showList ? 0 : 1, false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => settle(showList, true))
    })
  }, [applyProgress, settle])

  const controls: AppLayoutControls = {
    onShowDetail: () => slideTo(false),
    onShowList:   () => slideTo(true),
  }

  function handleSectionChange(s: Section) {
    const showList = s === 'chat' || s === 'hashtags'
    applyProgress(showList ? 1 : 0, false)
    setMobileShowList(showList)
    onSectionChange(s)
  }

  // Non-passive touchmove so we can prevent scroll while peeling the sheet
  useEffect(() => {
    const el = detailRef.current
    if (!el) return

    const onStart = (e: TouchEvent) => {
      if (sheetMountedRef.current || mediaPaneRef.current || mobileShowListRef.current || hideListPane || centeredDetail) return
      if (reduceMotion.current) return
      if (window.matchMedia('(min-width: 768px)').matches) return
      const t = e.touches[0]
      if (t.clientX > EDGE_PX) return
      drag.current = {
        tracking: true,
        lock: 'none',
        startX: t.clientX,
        startY: t.clientY,
        startT: performance.now(),
        width: el.offsetWidth || window.innerWidth,
        lastX: t.clientX,
        lastT: performance.now(),
      }
    }

    const onMove = (e: TouchEvent) => {
      const d = drag.current
      if (!d.tracking) return
      const t = e.touches[0]
      const dx = t.clientX - d.startX
      const dy = t.clientY - d.startY

      if (d.lock === 'none') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        d.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        if (d.lock === 'v') {
          d.tracking = false
          return
        }
      }
      if (d.lock !== 'h') return

      e.preventDefault()
      d.lastX = t.clientX
      d.lastT = performance.now()
      applyProgress(Math.min(1, Math.max(0, dx / d.width)), false)
    }

    const onEnd = () => {
      const d = drag.current
      if (!d.tracking && d.lock !== 'h') {
        d.lock = 'none'
        return
      }
      const wasH = d.lock === 'h'
      d.tracking = false
      d.lock = 'none'
      if (!wasH) return

      const p = progressRef.current
      const elapsed = Math.max(1, performance.now() - d.startT)
      const velocity = (d.lastX - d.startX) / elapsed
      settle(p > COMMIT_RATIO || velocity > COMMIT_VELOCITY, true)
    }

    const onCancel = () => {
      const d = drag.current
      if (!d.tracking && d.lock !== 'h') return
      d.tracking = false
      d.lock = 'none'
      settle(false, true)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onCancel)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [applyProgress, settle, hideListPane, centeredDetail])

  return (
    <div className={`md:gap-3 flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden md:pb-0 ${sheetVisible ? 'max-md:bg-black' : ''}`}>

      <AppNav
        section={section}
        prevSection={prevSection}
        initials={initials}
        name={name}
        hiddenOnMobile={
          sheetVisible
          || (!mobileShowList && (section === 'chat' || section === 'hashtags'))
        }
        onSectionChange={handleSectionChange}
        isExpanded={navExpanded}
        onToggleExpanded={toggleNav}
      />

      {centeredDetail ? (
        <>
          <div className="hidden md:block basis-0 min-w-0" style={{ flexGrow: listGrow }} />
          <div className="flex flex-col overflow-hidden liquid-glass-atmosphere flex-1 md:basis-0 md:min-w-0 md:min-h-0 md:rounded-2xl" style={{ flexGrow: detailGrow }}>
            {detailPane(controls)}
          </div>
          <div className="hidden md:block basis-0 min-w-0" style={{ flexGrow: listGrow }} />
        </>
      ) : (
        <>
          {!hideListPane && (
            <div
              ref={listRef}
              className={[
                'flex flex-col shrink-0 overflow-hidden liquid-glass-atmosphere absolute inset-0 md:static md:basis-0 md:min-w-0 md:rounded-2xl will-change-transform md:!transform-none',
                // Hide list while sheet is open so only the chat card peeks (not a 3rd layer).
                sheetVisible ? 'max-md:invisible' : '',
              ].filter(Boolean).join(' ')}
              style={{ flexGrow: listGrow }}
              aria-hidden={sheetVisible || undefined}
            >
              {listPane(controls)}
            </div>
          )}

          <div
            ref={scrimRef}
            className="absolute inset-0 z-[9] bg-black md:hidden pointer-events-none"
            style={{ opacity: 0 }}
          />

          <div
            ref={detailRef}
            className={[
              'flex flex-col overflow-hidden liquid-glass-atmosphere absolute inset-0 z-10',
              'md:static md:z-auto md:basis-0 md:min-w-0 md:min-h-0 md:rounded-2xl md:!transform-none md:!shadow-none',
              'will-change-transform',
              'shadow-[-12px_0_32px_rgba(0,0,0,0.18)] dark:shadow-[-12px_0_32px_rgba(0,0,0,0.45)]',
              mobileShowList ? 'pointer-events-none' : '',
              mediaPaneOpen ? 'max-md:pointer-events-none' : '',
            ].filter(Boolean).join(' ')}
            style={{ flexGrow: detailGrow }}
          >
            {detailPane(controls)}
          </div>

          {sheetVisible && (mediaPane || sheetContentRef.current) && (
            <div className="fixed inset-0 z-40 flex flex-col justify-end pt-[calc(env(safe-area-inset-top,0px)+2.75rem)] pointer-events-none md:pointer-events-auto md:static md:z-auto md:flex md:flex-col md:basis-0 md:min-w-0 md:min-h-0 md:justify-start md:pt-0 md:rounded-2xl md:overflow-hidden md:[flex-grow:5]">
              <button
                ref={sheetScrimRef}
                type="button"
                aria-label="Dismiss"
                className="absolute inset-0 bg-black/25 pointer-events-auto md:hidden"
                onClick={requestCloseSheet}
              />
              <div
                ref={sheetPanelRef}
                role="dialog"
                aria-modal
                className="relative z-10 flex flex-col flex-1 min-h-0 w-full rounded-t-[1.25rem] overflow-hidden liquid-glass-atmosphere shadow-[0_-8px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.55)] pointer-events-auto [animation:sheet-up_340ms_cubic-bezier(0.32,0.72,0,1)] md:h-full md:rounded-2xl md:shadow-none md:animate-none will-change-transform"
              >
                <div className="sticky top-0 z-20 liquid-glass-bar liquid-glass-bar-frosted shrink-0 md:hidden" aria-hidden>
                  <div className="flex justify-center pt-2.5 pb-1">
                    <div className="w-9 h-1 rounded-full bg-black/20 dark:bg-white/25" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {mediaPane ?? sheetContentRef.current}
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
