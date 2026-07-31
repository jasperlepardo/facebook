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
  listGrow?: number
  detailGrow?: number
  hideListPane?: boolean
  centeredDetail?: boolean
}

/** iOS-like push easing */
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const SHEET_MS = 380
const EDGE_PX = 28
const COMMIT_RATIO = 0.35
const COMMIT_VELOCITY = 0.45 // px/ms

type DragLock = 'none' | 'h' | 'v'

export default function AppLayout({ section, onSectionChange, initials, name, prevSection, listPane, detailPane, mediaPane, listGrow = 4, detailGrow = 7, hideListPane = false, centeredDetail = false }: AppLayoutProps) {
  const [mobileShowList, setMobileShowList] = useState(
    section === 'chat' || section === 'hashtags'
  )
  const [navExpanded, setNavExpanded] = useState(false)

  const listRef   = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const scrimRef  = useRef<HTMLDivElement>(null)
  /** 0 = detail open, 1 = detail off-screen (list). */
  const progressRef = useRef(section === 'chat' || section === 'hashtags' ? 1 : 0)
  const mobileShowListRef = useRef(mobileShowList)
  const mediaPaneRef = useRef(!!mediaPane)
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
  const reduceMotion = useRef(false)

  mobileShowListRef.current = mobileShowList
  mediaPaneRef.current = !!mediaPane

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

    const detail = detailRef.current
    if (detail) {
      detail.style.transition = transition
      detail.style.transform = `translate3d(${progress * 100}%,0,0)`
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
    }
    if (scrimRef.current) {
      scrimRef.current.style.transition = 'none'
      scrimRef.current.style.opacity = ''
    }
  }, [])

  useEffect(() => {
    if (localStorage.getItem('navExpanded') === '1') setNavExpanded(true)
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (new URLSearchParams(window.location.search).get('msg')) {
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
      else applyProgress(mobileShowListRef.current ? 1 : 0, false)
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
      if (mediaPaneRef.current || mobileShowListRef.current || hideListPane || centeredDetail) return
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
    <div className="md:gap-3 flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden md:pb-0">

      <AppNav
        section={section}
        prevSection={prevSection}
        initials={initials}
        name={name}
        hiddenOnMobile={!mobileShowList && section !== 'story'}
        onSectionChange={handleSectionChange}
        isExpanded={navExpanded}
        onToggleExpanded={toggleNav}
      />

      {centeredDetail ? (
        <>
          <div className="hidden md:block basis-0 min-w-0" style={{ flexGrow: listGrow }} />
          <div className="flex flex-col overflow-hidden bg-white dark:bg-mist-900 flex-1 md:basis-0 md:min-w-0 md:min-h-0 md:rounded-2xl" style={{ flexGrow: detailGrow }}>
            {detailPane(controls)}
          </div>
          <div className="hidden md:block basis-0 min-w-0" style={{ flexGrow: listGrow }} />
        </>
      ) : (
        <>
          {!hideListPane && (
            <div
              ref={listRef}
              className="flex flex-col shrink-0 overflow-hidden bg-white dark:bg-mist-950 md:dark:bg-mist-900 absolute inset-0 md:static md:basis-0 md:min-w-0 md:rounded-2xl will-change-transform md:!transform-none"
              style={{ flexGrow: listGrow }}
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
              'flex flex-col overflow-hidden bg-white dark:bg-mist-900 absolute inset-0 z-10',
              'md:static md:z-auto md:basis-0 md:min-w-0 md:min-h-0 md:rounded-2xl md:!transform-none md:!shadow-none',
              'will-change-transform',
              'shadow-[-12px_0_32px_rgba(0,0,0,0.18)] dark:shadow-[-12px_0_32px_rgba(0,0,0,0.45)]',
              mobileShowList ? 'pointer-events-none' : '',
            ].filter(Boolean).join(' ')}
            style={{ flexGrow: detailGrow }}
          >
            {detailPane(controls)}
          </div>

          {mediaPane && (
            <div className="flex flex-col overflow-hidden bg-white dark:bg-mist-900 absolute inset-0 z-20 md:static md:z-auto md:basis-0 md:min-w-0 md:rounded-2xl md:[flex-grow:5]">
              {mediaPane}
            </div>
          )}
        </>
      )}

    </div>
  )
}
