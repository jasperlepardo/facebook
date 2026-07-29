'use client'
import { useEffect, useState } from 'react'

interface CallItem { duration: number; missed: boolean; content?: string; ts: number; sender: string; msgId: string }

export default function CallsView() {
  const [items, setItems] = useState<CallItem[]>([])

  useEffect(() => {
    fetch('/api/attachments?type=calls&offset=0&limit=500')
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
  }, [])

  if (!items.length) return <div className="p-5 text-gray-500 dark:text-mist-400 text-sm">No calls found.</div>

  return (
    <div className="flex-1 overflow-y-auto p-3 bg-gray-50 dark:bg-mist-900">
      {items.map((item, i) => {
        const isVideo = (item.content ?? '').toLowerCase().includes('video')
        const mins = Math.floor(item.duration / 60)
        const secs = item.duration % 60
        const dur  = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
        return (
          <div key={i} className="bg-white dark:bg-mist-800 rounded-lg px-3.5 py-3 mb-2 flex items-center gap-3 shadow-xs dark:shadow-gray-900 border border-transparent dark:border-mist-700">
            <div className="text-[20px]">{item.missed ? '📵' : isVideo ? '📹' : '📞'}</div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${item.missed ? 'text-red-400' : 'text-gray-800 dark:text-mist-100'}`}>
                {item.missed ? 'Missed ' : ''}{isVideo ? 'Video call' : 'Call'}{!item.missed && ` · ${dur}`}
              </div>
              <div className="text-xs text-gray-400 dark:text-mist-500 mt-0.5">{new Date(item.ts).toLocaleDateString()} · {item.sender}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
