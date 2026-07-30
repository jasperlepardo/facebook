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

  if (!items.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white dark:bg-mist-900 pb-12">
      <div className="w-14 h-14 rounded-2xl bg-mist-100 dark:bg-mist-800 flex items-center justify-center text-mist-400 dark:text-mist-500">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.71a16 16 0 0 0 5.38 5.38l1.81-1.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </div>
      <p className="text-sm text-mist-400 dark:text-mist-500">No calls yet</p>
    </div>
  )

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
