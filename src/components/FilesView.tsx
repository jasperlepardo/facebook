'use client'
import { useEffect, useState } from 'react'
import { GalleryItem } from '@/types'
import { r2 } from '@/lib/format'
import { MediaListSkeleton } from '@/components/skeletons'
import { pbSafe } from '@/lib/ui'

export default function FilesView({ type = 'all', thread = 'messages' }: { type?: 'files' | 'audio' | 'all'; thread?: string }) {
  const [items, setItems] = useState<(GalleryItem & { kind: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = `&thread=${thread}`
    const fetches = type === 'files'
      ? [fetch(`/api/attachments?type=files&offset=0&limit=500${q}`).then(r => r.json()).then(d => d.items.map((i: GalleryItem) => ({ ...i, kind: 'file' })))]
      : type === 'audio'
      ? [fetch(`/api/attachments?type=audio&offset=0&limit=500${q}`).then(r => r.json()).then(d => d.items.map((i: GalleryItem) => ({ ...i, kind: 'audio' })))]
      : [
          fetch(`/api/attachments?type=files&offset=0&limit=500${q}`).then(r => r.json()).then(d => d.items.map((i: GalleryItem) => ({ ...i, kind: 'file' }))),
          fetch(`/api/attachments?type=audio&offset=0&limit=500${q}`).then(r => r.json()).then(d => d.items.map((i: GalleryItem) => ({ ...i, kind: 'audio' }))),
        ]
    Promise.all(fetches).then(results => {
      setItems(results.flat().sort((a, b) => a.ts - b.ts))
    }).finally(() => setLoading(false))
  }, [type, thread])

  const icon = (item: { uri: string; kind: string }) => {
    if (item.kind === 'audio') return '🎵'
    const n = item.uri.toLowerCase()
    if (n.endsWith('.pdf')) return '📄'
    if (/\.(jpe?g|png|gif|webp)$/.test(n)) return '🖼'
    return '📎'
  }

  if (loading) return <MediaListSkeleton />

  if (!items.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-transparent pb-12">
      <div className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center text-mist-400 dark:text-mist-500">
        {type === 'audio'
          ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        }
      </div>
      <p className="text-sm text-mist-400 dark:text-mist-500">{type === 'audio' ? 'No audio shared yet' : 'No files shared yet'}</p>
    </div>
  )

  return (
    <div className={`flex-1 overflow-y-auto p-3 bg-transparent ${pbSafe} md:pb-3`}>
      {items.map((item, i) => {
        const name = item.uri.split('/').pop() ?? ''
        return (
          <div key={i} className="liquid-glass rounded-lg px-3.5 py-3 mb-2 flex items-center gap-3">
            <div className="text-[22px]">{icon(item)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                <a href={r2(item.uri)} target="_blank" rel="noopener" className="text-mist-600 dark:text-mist-400 no-underline hover:underline">{name}</a>
              </div>
              <div className="text-xs text-gray-500 dark:text-mist-400 mt-0.5">{new Date(item.ts).toLocaleDateString()} · {item.sender}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
