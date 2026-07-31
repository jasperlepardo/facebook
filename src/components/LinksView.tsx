'use client'
import { useEffect, useState } from 'react'
import { MediaListSkeleton } from '@/components/skeletons'

interface LinkItem { uri: string; text?: string; ts: number; sender: string; msgId: string }

export default function LinksView({ thread = 'messages' }: { thread?: string }) {
  const [items, setItems] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/attachments?type=links&offset=0&limit=500&thread=${thread}`)
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .finally(() => setLoading(false))
  }, [thread])

  if (loading) return <MediaListSkeleton />

  if (!items.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white dark:bg-mist-900 pb-12">
      <div className="w-14 h-14 rounded-2xl bg-mist-100 dark:bg-mist-800 flex items-center justify-center text-mist-400 dark:text-mist-500">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </div>
      <p className="text-sm text-mist-400 dark:text-mist-500">No links shared yet</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-3 bg-gray-50 dark:bg-mist-900">
      {items.map((item, i) => {
        let host = ''
        try { host = new URL(item.uri).hostname.replace(/^www\./, '') } catch {}
        return (
          <div key={i} className="bg-white dark:bg-mist-800 rounded-lg px-3.5 py-3 mb-2 flex items-start gap-3 shadow-xs dark:shadow-gray-900 border border-transparent dark:border-mist-700">
            <div className="text-[20px] mt-0.5">🔗</div>
            <div className="flex-1 min-w-0">
              {item.text && <div className="text-sm font-medium text-gray-800 dark:text-mist-100 line-clamp-2 mb-0.5">{item.text}</div>}
              <a href={item.uri} target="_blank" rel="noopener" className="text-xs text-mist-600 dark:text-mist-400 hover:underline break-all line-clamp-1">{item.uri}</a>
              <div className="text-xs text-gray-400 dark:text-mist-500 mt-0.5">{host && `${host} · `}{new Date(item.ts).toLocaleDateString()} · {item.sender}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
