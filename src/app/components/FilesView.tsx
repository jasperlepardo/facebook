'use client'
import { useEffect, useState } from 'react'
import { GalleryItem } from '../types'
import { r2 } from '../lib/format'

export default function FilesView() {
  const [items, setItems] = useState<(GalleryItem & { kind: string })[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/attachments?type=files&offset=0&limit=500').then(r => r.json()),
      fetch('/api/attachments?type=audio&offset=0&limit=500').then(r => r.json()),
    ]).then(([fd, ad]) => {
      const all = [
        ...fd.items.map((i: GalleryItem) => ({ ...i, kind: 'file' })),
        ...ad.items.map((i: GalleryItem) => ({ ...i, kind: 'audio' })),
      ].sort((a, b) => b.ts - a.ts)
      setItems(all)
    })
  }, [])

  const icon = (item: { uri: string; kind: string }) => {
    if (item.kind === 'audio') return '🎵'
    const n = item.uri.toLowerCase()
    if (n.endsWith('.pdf')) return '📄'
    if (/\.(jpe?g|png|gif|webp)$/.test(n)) return '🖼'
    return '📎'
  }

  if (!items.length) return <div className="p-5 text-gray-500 text-sm">No files found.</div>

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {items.map((item, i) => {
        const name = item.uri.split('/').pop() ?? ''
        return (
          <div key={i} className="bg-white rounded-lg px-3.5 py-3 mb-2 flex items-center gap-3 shadow-sm">
            <div className="text-[22px]">{icon(item)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                <a href={r2(item.uri)} target="_blank" rel="noopener" className="text-blue-600 no-underline hover:underline">{name}</a>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{new Date(item.ts).toLocaleDateString()} · {item.sender}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
