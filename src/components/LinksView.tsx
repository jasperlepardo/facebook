'use client'
import { useEffect, useState } from 'react'

interface LinkItem { uri: string; text?: string; ts: number; sender: string; msgId: string }

export default function LinksView() {
  const [items, setItems] = useState<LinkItem[]>([])

  useEffect(() => {
    fetch('/api/attachments?type=links&offset=0&limit=500')
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
  }, [])

  if (!items.length) return <div className="p-5 text-gray-500 dark:text-mist-400 text-sm">No links found.</div>

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
