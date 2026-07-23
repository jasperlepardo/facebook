'use client'
import { useEffect, useRef, useState } from 'react'
import { GalleryItem, LightboxState } from '../types'
import { r2 } from '../lib/format'
import { GLIMIT } from '../lib/constants'

interface Props {
  type: 'photos' | 'videos'
  onLightbox: (s: LightboxState) => void
  onContextMenu: (e: React.MouseEvent, item: GalleryItem) => void
}

export default function Gallery({ type, onLightbox, onContextMenu }: Props) {
  const [items, setItems]     = useState<GalleryItem[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const offset    = useRef(0)
  const galleryRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  async function load() {
    if (!hasMore || loading) return
    setLoading(true)
    const res = await fetch(`/api/attachments?type=${type}&offset=${offset.current}&limit=${GLIMIT}`)
    const data = await res.json()
    setItems(prev => [...prev, ...data.items])
    setHasMore(data.has_more)
    offset.current += GLIMIT
    setLoading(false)
  }

  useEffect(() => {
    setItems([]); setHasMore(true); offset.current = 0
    load()
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sentinelRef.current || !galleryRef.current) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) load() }, { root: galleryRef.current, rootMargin: '300px' })
    io.observe(sentinelRef.current)
    return () => io.disconnect()
  }, [hasMore, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={galleryRef} className="flex-1 overflow-y-auto p-3">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
        {items.map((item, i) => (
          <div key={i}
            className="aspect-square overflow-hidden cursor-pointer rounded-sm bg-gray-200 relative hover:opacity-85"
            onClick={() => onLightbox({ src: r2(item.uri), type: type === 'photos' ? 'photo' : 'video', caption: `${new Date(item.ts).toLocaleDateString()} · ${item.sender}` })}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, item) }}
            data-ts={item.ts}
            data-msg-id={item.msgId}
          >
            {type === 'photos'
              ? <img src={r2(item.uri)} loading="lazy" className="w-full h-full object-cover block" onError={e => e.currentTarget.closest('.gitem')?.remove()} />
              : <video src={r2(item.uri)} preload="none" className="w-full h-full object-cover block" />
            }
          </div>
        ))}
      </div>
      <div ref={sentinelRef} />
    </div>
  )
}
