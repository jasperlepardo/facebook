/* eslint-disable @next/next/no-img-element */
'use client'
import { useEffect, useRef, useState } from 'react'
import { GalleryItem, LightboxState } from '@/types'
import { r2 } from '@/lib/format'
import { GALLERY_LIMIT } from '@/lib/constants'
import { GallerySkeleton } from '@/components/skeletons'
import { pbSafe } from '@/lib/ui'
import MessageRowActions from '@/components/message/MessageRowActions'
import { buildMessageActions } from '@/lib/messageActions'

interface GalleryProps {
  type: 'photos' | 'videos' | 'gifs' | 'stickers'
  thread?: string
  onLightbox: (s: LightboxState) => void
  onContextMenu: (e: React.MouseEvent, item: GalleryItem) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  onGoToMessage?: (ts: number, msgId: string) => void
}

function GalleryCellActions({
  item,
  isHidden,
  isSuperAdmin,
  onHideUri,
  onUnhideUri,
  onGoToMessage,
}: {
  item: GalleryItem
  isHidden?: boolean
  isSuperAdmin?: boolean
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  onGoToMessage?: (ts: number, msgId: string) => void
}) {
  const actions = buildMessageActions({
    surface: 'gallery',
    count: 1,
    isHidden,
    isSuperAdmin,
    omitSelect: true,
    callbacks: {
      onGoToMessage: item.msgId && onGoToMessage
        ? () => onGoToMessage(item.ts, item.msgId!)
        : undefined,
      onHide: onHideUri ? () => onHideUri(item.uri) : undefined,
      onUnhide: onUnhideUri ? () => onUnhideUri(item.uri) : undefined,
    },
  })
  if (!actions.length) return null
  return (
    <MessageRowActions
      actions={actions}
      className="absolute top-1.5 right-1.5 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10"
    />
  )
}

export default function Gallery({ type, thread = 'messages', onLightbox, onContextMenu, hideImages, hiddenUris, isSuperAdmin, onHideUri, onUnhideUri, onGoToMessage }: GalleryProps) {
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

  async function load() {
    if (!hasMoreRef.current || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const res = await fetch(`/api/attachments?type=${type}&offset=${offset.current}&limit=${GALLERY_LIMIT}&thread=${thread}`)
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
    const ns = `${userNameRef.current ? userNameRef.current + '-' : ''}gallery-${thread}-${type}`
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

    async function init() {
      setItems([]); setHasMore(true); hasMoreRef.current = true; offset.current = 0
      loadingRef.current = false; setLoading(true)
      try { const d = await fetch('/api/auth/me').then(r => r.json()); if (d?.name) userNameRef.current = d.name } catch {}
      const ns = `${userNameRef.current ? userNameRef.current + '-' : ''}gallery-${thread}-${type}`
      let startOffset = 0, scrollTop = 0
      try {
        const bk = await fetch(`/api/bookmark?deviceId=${id}&ns=${encodeURIComponent(ns)}`).then(r => r.json())
        if (bk.msgId) { startOffset = parseInt(bk.msgId) || 0; scrollTop = bk.offset ?? 0 }
      } catch {}

      // Load pages up to the saved offset in parallel chunks, then restore scroll
      if (startOffset > 0) {
        const CHUNK = 200
        const chunks: { offset: number; limit: number }[] = []
        for (let o = 0; o < startOffset; o += CHUNK) {
          chunks.push({ offset: o, limit: Math.min(CHUNK, startOffset - o) })
        }
        const results = await Promise.all(
          chunks.map(c => fetch(`/api/attachments?type=${type}&offset=${c.offset}&limit=${c.limit}&thread=${thread}`).then(r => r.json()))
        )
        const loaded: GalleryItem[] = results.flatMap((r: any) => r.items ?? [])
        const lastMore: boolean = results[results.length - 1]?.has_more ?? false
        itemsRef.current = loaded
        setItems(loaded)
        hasMoreRef.current = lastMore
        setHasMore(lastMore)
        offset.current = startOffset
        setLoading(false)
        requestAnimationFrame(() => { if (galleryRef.current) galleryRef.current.scrollTop = scrollTop })
      } else {
        load()
      }
    }
    init()
  }, [type, thread]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [hasMore, items.length, type, thread]) // eslint-disable-line react-hooks/exhaustive-deps

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
        label: 'No photos shared yet',
      },
      videos: {
        icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="15" height="10" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/></svg>,
        label: 'No videos shared yet',
      },
      gifs: {
        icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8 12h4"/></svg>,
        label: 'No GIFs shared yet',
      },
      stickers: {
        icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.46 0 2.67-1.33 2.67-2.97V18c0-.55.45-1 1-1h1.38C19.73 17 22 14.66 22 12 22 6.48 17.52 2 12 2z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 14s1 2 3 2 3-2 3-2"/></svg>,
        label: 'No stickers shared yet',
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

  return (
    <div ref={galleryRef} className={`flex-1 overflow-y-auto p-3 bg-transparent ${pbSafe} md:pb-3`} onScroll={e => saveBookmark((e.currentTarget).scrollTop)}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(150px,100%),1fr))' }}>
        {items.map((item, i) => {
          const isHidden = hiddenUris?.has(item.uri)

          if (isHidden && !isSuperAdmin) return null

          if (isHidden && isSuperAdmin) return (
            <div key={i} className="aspect-square rounded-xs bg-gray-200 dark:bg-mist-700 relative flex flex-col items-center justify-center gap-1 group/cell">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Hidden</span>
              <GalleryCellActions
                item={item}
                isHidden
                isSuperAdmin={isSuperAdmin}
                onUnhideUri={onUnhideUri}
                onGoToMessage={onGoToMessage}
              />
            </div>
          )

          return (
            <div key={i}
              className="aspect-square overflow-hidden cursor-pointer rounded-xs bg-gray-200 dark:bg-mist-700 relative hover:opacity-85 group/cell"
              style={{ WebkitTouchCallout: 'none' }}
              onClick={() => {
                const kind = type === 'videos' ? 'video' as const : type === 'gifs' ? 'gif' as const : 'photo' as const
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
                    type: kind,
                    mediaType: type === 'stickers' ? undefined : type,
                    caption: `${new Date(items[idx].ts).toLocaleDateString()} · ${items[idx].sender}`,
                    msgId: items[idx].msgId,
                    ts: items[idx].ts,
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
              }}
              onContextMenu={e => { e.preventDefault() }}
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
            >
              {type === 'videos'
                ? <video src={r2(item.uri)} preload="none" className="absolute inset-0 w-full h-full object-cover" />
                : <img src={r2(item.uri, { w: 480 })} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              }
              <GalleryCellActions
                item={item}
                isSuperAdmin={isSuperAdmin}
                onHideUri={onHideUri}
                onGoToMessage={onGoToMessage}
              />
            </div>
          )
        })}
      </div>
      <div ref={sentinelRef} />
    </div>
  )
}
