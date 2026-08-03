/* eslint-disable @next/next/no-img-element */
'use client'
import { useEffect, useRef, useState } from 'react'
import { GalleryItem, LightboxState } from '@/types'
import { fmtDate, r2 } from '@/lib/format'
import { lightboxMediaCaption } from '@/lib/lightboxCaption'
import { GALLERY_LIMIT } from '@/lib/constants'
import { GallerySkeleton } from '@/components/skeletons'
import { pbSafe } from '@/lib/ui'
import { appendGalleryFilterParams, galleryFilterKey } from '@/lib/galleryFilters'
import DaySectionHeader from '@/components/DaySectionHeader'

interface GalleryProps {
  type: 'photos' | 'videos' | 'gifs' | 'stickers'
  thread?: string
  onLightbox: (s: LightboxState) => void
  onContextMenu: (e: React.MouseEvent, item: GalleryItem) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  /** When set, load through this attachment and scroll it into view. */
  focusUri?: string
  focusTs?: number
  senderIds?: string[]
  tsFrom?: number
  tsTo?: number
  /** Clear active filters when focus target is missing under the current filter set. */
  onClearFilters?: () => void
}

function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayIso(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Gallery({
  type, thread = 'messages', onLightbox, onContextMenu, hideImages, hiddenUris, isSuperAdmin,
  focusUri, focusTs,
  senderIds = [], tsFrom, tsTo, onClearFilters,
}: GalleryProps) {
  const [items, setItems]     = useState<GalleryItem[]>([])
  const itemsRef    = useRef<GalleryItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const hasMoreRef  = useRef(true)
  const [loading, setLoading] = useState(true)
  const loadingRef  = useRef(false)
  const offset      = useRef(0)
  const galleryRef  = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const deviceId    = useRef('')
  const userNameRef = useRef('')
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const touchPos = useRef({ x: 0, y: 0 })
  const filterKey = galleryFilterKey(senderIds, tsFrom, tsTo)
  const senderIdsKey = senderIds.slice().sort().join(',')

  function buildUrl(extra: Record<string, string | number> = {}, withFilters = true) {
    const params = new URLSearchParams({
      type,
      thread,
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
    })
    if (withFilters) appendGalleryFilterParams(params, senderIds, tsFrom, tsTo)
    return `/api/attachments?${params}`
  }

  function bookmarkNs() {
    const base = `${userNameRef.current ? userNameRef.current + '-' : ''}gallery-${thread}-${type}`
    return filterKey ? `${base}-${filterKey}` : base
  }

  async function load() {
    if (!hasMoreRef.current || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const res = await fetch(buildUrl({ offset: offset.current, limit: GALLERY_LIMIT }))
    const data = await res.json()
    setItems(prev => { const next = [...prev, ...(data.items ?? [])]; itemsRef.current = next; return next })
    hasMoreRef.current = data.has_more
    setHasMore(data.has_more)
    offset.current += GALLERY_LIMIT
    loadingRef.current = false
    setLoading(false)
  }

  function saveBookmark(scrollTop: number) {
    const id = deviceId.current
    if (!id) return
    clearTimeout(saveTimer.current)
    const ns = bookmarkNs()
    saveTimer.current = setTimeout(() => {
      fetch('/api/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgId: String(offset.current), offset: scrollTop, deviceId: id, ns }),
      }).catch(() => {})
    }, 1500)
  }

  useEffect(() => {
    let id = localStorage.getItem('deviceId')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id) }
    deviceId.current = id
    let cancelled = false

    async function loadThrough(endExclusive: number, withFilters = true) {
      const CHUNK = 200
      const chunks: { offset: number; limit: number }[] = []
      for (let o = 0; o < endExclusive; o += CHUNK) {
        chunks.push({ offset: o, limit: Math.min(CHUNK, endExclusive - o) })
      }
      if (!chunks.length) {
        chunks.push({ offset: 0, limit: GALLERY_LIMIT })
      }
      const results = await Promise.all(
        chunks.map(c => fetch(buildUrl({ offset: c.offset, limit: c.limit }, withFilters)).then(r => r.json()))
      )
      if (cancelled) return null
      const loaded: GalleryItem[] = results.flatMap((r: { items?: GalleryItem[] }) => r.items ?? [])
      const last = results[results.length - 1] as { has_more?: boolean } | undefined
      return { loaded, hasMore: !!last?.has_more, nextOffset: endExclusive }
    }

    function scrollToFocus() {
      const root = galleryRef.current
      if (!root) return
      const byUri = focusUri
        ? root.querySelector(`[data-uri="${CSS.escape(focusUri)}"]`) as HTMLElement | null
        : null
      const byTs = !byUri && focusTs != null
        ? root.querySelector(`[data-ts="${focusTs}"]`) as HTMLElement | null
        : null
      const el = byUri ?? byTs
      if (!el) return
      el.scrollIntoView({ block: 'start', inline: 'nearest' })
      el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1', 'ring-offset-mist-50', 'dark:ring-offset-mist-950')
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1', 'ring-offset-mist-50', 'dark:ring-offset-mist-950')
      }, 1600)
    }

    function hasFocusTarget(list: GalleryItem[]) {
      if (focusUri) return list.some(it => it.uri === focusUri)
      if (focusTs != null) return list.some(it => it.ts === focusTs)
      return false
    }

    async function focusLoad(withFilters: boolean) {
      const extra: Record<string, string | number> = { offsetOf: focusTs ?? 0 }
      if (focusUri) extra.uri = focusUri
      const { offset: focusOff } = await fetch(
        buildUrl(extra, withFilters)
      ).then(r => r.json()) as { offset: number }
      if (cancelled) return false
      const end = Math.max(focusOff + 1, GALLERY_LIMIT)
      const page = await loadThrough(end, withFilters)
      if (!page || cancelled) return false
      if (!hasFocusTarget(page.loaded)) return false
      itemsRef.current = page.loaded
      setItems(page.loaded)
      hasMoreRef.current = page.hasMore
      setHasMore(page.hasMore)
      offset.current = page.nextOffset
      setLoading(false)
      requestAnimationFrame(() => requestAnimationFrame(scrollToFocus))
      return true
    }

    async function init() {
      setItems([]); setHasMore(true); hasMoreRef.current = true; offset.current = 0
      loadingRef.current = false; setLoading(true)
      try { const d = await fetch('/api/auth/me').then(r => r.json()); if (d?.name) userNameRef.current = d.name } catch {}
      const ns = bookmarkNs()

      // Prefer jumping to the lightbox target over restoring the scroll bookmark.
      if ((focusUri || focusTs != null) && type !== 'stickers') {
        try {
          if (await focusLoad(true)) return
          // Target missing under filters — clear them so init re-runs unfiltered.
          if (filterKey) {
            onClearFilters?.()
            return
          }
        } catch {
          /* fall through to bookmark / first page */
        }
      }

      let startOffset = 0, scrollTop = 0
      try {
        const bk = await fetch(`/api/bookmark?deviceId=${id}&ns=${encodeURIComponent(ns)}`).then(r => r.json())
        if (bk.msgId) { startOffset = parseInt(bk.msgId) || 0; scrollTop = bk.offset ?? 0 }
      } catch {}

      if (startOffset > 0) {
        const page = await loadThrough(startOffset)
        if (!page || cancelled) return
        itemsRef.current = page.loaded
        setItems(page.loaded)
        hasMoreRef.current = page.hasMore
        setHasMore(page.hasMore)
        offset.current = startOffset
        setLoading(false)
        requestAnimationFrame(() => { if (galleryRef.current) galleryRef.current.scrollTop = scrollTop })
      } else {
        void load()
      }
    }
    void init()
    return () => { cancelled = true }
  }, [type, thread, focusUri, focusTs, senderIdsKey, tsFrom, tsTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Attach after the grid mounts — skeleton render has no galleryRef/sentinelRef.
  useEffect(() => {
    if (!hasMore || items.length === 0) return
    const root = galleryRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) void load()
    }, { root, rootMargin: '300px' })
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMore, items.length, type, thread, senderIdsKey, tsFrom, tsTo]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDayJump(target: string) {
    const root = galleryRef.current
    if (!root) return
    if (target === 'beginning') {
      root.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (target === 'recent') {
      root.scrollTo({ top: root.scrollHeight, behavior: 'smooth' })
      return
    }
    if (target.startsWith('ts:')) {
      const ts = parseInt(target.slice(3), 10)
      const el = root.querySelector(`[data-day-ts="${ts}"]`) as HTMLElement | null
        ?? root.querySelector(`[data-ts="${ts}"]`) as HTMLElement | null
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      return
    }
    // ISO date from dateIndex (YYYY-MM-DD or month/week) — match local day headers.
    const el = root.querySelector(`[data-day-iso="${CSS.escape(target)}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  if (hideImages) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-transparent pb-12">
      <div className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center text-mist-400 dark:text-mist-500">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      </div>
      <p className="text-sm text-mist-400 dark:text-mist-500">Images are hidden</p>
    </div>
  )

  if (items.length === 0 && (loading || hasMore)) {
    return <GallerySkeleton />
  }

  if (!loading && !hasMore && items.length === 0) {
    const meta: Record<string, { icon: React.ReactNode; label: string }> = {
      photos: {
        icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
        label: filterKey ? 'No photos match these filters' : 'No photos shared yet',
      },
      videos: {
        icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="15" height="10" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/></svg>,
        label: filterKey ? 'No videos match these filters' : 'No videos shared yet',
      },
      gifs: {
        icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8 12h4"/></svg>,
        label: filterKey ? 'No GIFs match these filters' : 'No GIFs shared yet',
      },
      stickers: {
        icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.46 0 2.67-1.33 2.67-2.97V18c0-.55.45-1 1-1h1.38C19.73 17 22 14.66 22 12 22 6.48 17.52 2 12 2z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 14s1 2 3 2 3-2 3-2"/></svg>,
        label: filterKey ? 'No stickers match these filters' : 'No stickers shared yet',
      },
    }
    const { icon, label } = meta[type] ?? meta.photos
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-transparent pb-12">
        <div className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center text-mist-400 dark:text-mist-500">
          {icon}
        </div>
        <p className="text-sm text-mist-400 dark:text-mist-500">{label}</p>
      </div>
    )
  }

  // Group into day sections for chat-style headers.
  type DaySection = { key: string; date: string; ts: number; iso: string; items: { item: GalleryItem; index: number }[] }
  const days: DaySection[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const key = dayKey(item.ts)
    const last = days[days.length - 1]
    if (!last || last.key !== key) {
      days.push({ key, date: fmtDate(item.ts), ts: item.ts, iso: dayIso(item.ts), items: [{ item, index: i }] })
    } else {
      last.items.push({ item, index: i })
    }
  }

  function renderTile(item: GalleryItem, i: number) {
    const isHidden = hiddenUris?.has(item.uri)

    if (isHidden && !isSuperAdmin) return null

    if (isHidden && isSuperAdmin) return (
      <div
        key={i}
        className="aspect-square rounded-xs bg-gray-200 dark:bg-mist-700 relative flex flex-col items-center justify-center gap-1 cursor-pointer"
        style={{ WebkitTouchCallout: 'none' }}
        onClick={() => {
          const kind = type === 'videos' ? 'video' as const : type === 'gifs' ? 'gif' as const : 'photo' as const
          onLightbox({
            src: r2(item.uri),
            uri: item.uri,
            type: type === 'stickers' ? 'photo' : kind,
            mediaType: type === 'stickers' ? undefined : type,
            caption: lightboxMediaCaption(item.ts, item.sender),
            msgId: item.msgId,
            ts: item.ts,
            source: 'gallery',
          })
        }}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, item) }}
        onTouchStart={e => {
          if (e.touches.length !== 1) return
          const t = e.touches[0]
          touchPos.current = { x: t.clientX, y: t.clientY }
          longPressTimer.current = setTimeout(() => {
            onContextMenu(
              { clientX: touchPos.current.x, clientY: touchPos.current.y, preventDefault: () => {}, _fromTouch: true } as unknown as React.MouseEvent,
              item,
            )
          }, 500)
        }}
        onTouchEnd={() => clearTimeout(longPressTimer.current)}
        onTouchMove={() => clearTimeout(longPressTimer.current)}
        data-ts={item.ts}
        data-msg-id={item.msgId}
        data-uri={item.uri}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Hidden</span>
      </div>
    )

    return (
      <div key={i}
        className="aspect-square overflow-hidden cursor-pointer rounded-xs bg-gray-200 dark:bg-mist-700 relative hover:opacity-85"
        style={{ WebkitTouchCallout: 'none' }}
        onClick={() => {
          // Stickers: loaded-list carousel only (attachments offsetOf is array-types).
          if (type === 'stickers') {
            const loadStrip = async (offset: number, limit: number) => {
              const items = itemsRef.current
              return items.slice(offset, offset + limit).map(it => ({ uri: it.uri }))
            }
            const mkState = (idx: number): LightboxState => {
              const items = itemsRef.current
              const prev = idx > 0 ? items[idx - 1] : undefined
              const next = idx < items.length - 1 ? items[idx + 1] : undefined
              return {
                src: r2(items[idx].uri),
                uri: items[idx].uri,
                type: 'photo',
                caption: lightboxMediaCaption(items[idx].ts, items[idx].sender),
                msgId: items[idx].msgId,
                ts: items[idx].ts,
                source: 'gallery',
                index: idx + 1,
                total: items.length,
                prevSrc: prev ? r2(prev.uri) : undefined,
                nextSrc: next ? r2(next.uri) : undefined,
                onPrev: idx > 0 ? () => onLightbox(mkState(idx - 1)) : undefined,
                onNext: idx < items.length - 1 ? () => onLightbox(mkState(idx + 1)) : undefined,
                onGoToIndex: (absOff) => {
                  if (absOff >= 0 && absOff < itemsRef.current.length) onLightbox(mkState(absOff))
                },
                loadStrip,
              }
            }
            onLightbox(mkState(i))
            return
          }

          // Photos / videos / gifs: seed only — parent enriches to full-archive carousel.
          const kind = type === 'videos' ? 'video' as const : type === 'gifs' ? 'gif' as const : 'photo' as const
          onLightbox({
            src: r2(item.uri),
            uri: item.uri,
            type: kind,
            mediaType: type,
            caption: lightboxMediaCaption(item.ts, item.sender),
            msgId: item.msgId,
            ts: item.ts,
            source: 'gallery',
          })
        }}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, item) }}
        onTouchStart={e => {
          if (e.touches.length !== 1) return
          const t = e.touches[0]
          touchPos.current = { x: t.clientX, y: t.clientY }
          longPressTimer.current = setTimeout(() => {
            onContextMenu(
              { clientX: touchPos.current.x, clientY: touchPos.current.y, preventDefault: () => {}, _fromTouch: true } as unknown as React.MouseEvent,
              item,
            )
          }, 500)
        }}
        onTouchEnd={() => clearTimeout(longPressTimer.current)}
        onTouchMove={() => clearTimeout(longPressTimer.current)}
        data-ts={item.ts}
        data-msg-id={item.msgId}
        data-uri={item.uri}
      >
        {type === 'videos'
          ? <video src={r2(item.uri)} preload="none" className="absolute inset-0 w-full h-full object-cover" />
          : <img src={r2(item.uri, { w: 480 })} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        }
      </div>
    )
  }

  const gridStyle = { gridTemplateColumns: 'repeat(auto-fill,minmax(min(150px,100%),1fr))' }

  return (
    // Padding stays off the scrollport so sticky day headers sit flush under the filter bar.
    <div ref={galleryRef} className={`flex-1 overflow-y-auto bg-transparent ${pbSafe} md:pb-3`} onScroll={e => saveBookmark((e.currentTarget).scrollTop)}>
      {/* One section per day (header + tiles) so sticky can pin within the day — same as MessageList. */}
      <div className="flex flex-col gap-[3px] pt-3">
        {days.map((day, dayIdx) => (
          <div key={`day-${day.key}-${day.ts}`} data-day-iso={day.iso} data-day-ts={day.ts}>
            <DaySectionHeader
              date={day.date}
              ts={day.ts}
              prevDayTs={dayIdx > 0 ? days[dayIdx - 1].ts : undefined}
              nextDayTs={dayIdx < days.length - 1 ? days[dayIdx + 1].ts : undefined}
              onJumpTo={handleDayJump}
            />
            <div className="grid gap-[3px] px-3" style={gridStyle}>
              {day.items.map(({ item, index }) => renderTile(item, index))}
            </div>
          </div>
        ))}
      </div>
      <div ref={sentinelRef} />
    </div>
  )
}
