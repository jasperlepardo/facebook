'use client'
import { useState, useEffect } from 'react'

export interface Thread {
  id: string
  name: string
  initials: string
  color: string
  collection: string
}

interface ThreadWithMeta extends Thread {
  preview: string
  time: string
}

function relTime(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  threads: Thread[]
  activeThreadId: string
  onSelect: (id: string) => void
}

export default function ThreadListPane({ threads, activeThreadId, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [meta, setMeta] = useState<Record<string, { preview: string; time: string }>>({})

  useEffect(() => {
    threads.forEach(t => {
      fetch(`/api/messages?offset=0&limit=1`)
        .then(r => r.json())
        .then(d => {
          const msg = d.messages?.[0]
          if (!msg) return
          const preview = msg.content ?? (msg.photos?.length ? 'Sent a photo' : msg.videos?.length ? 'Sent a video' : 'Sent an attachment')
          setMeta(prev => ({ ...prev, [t.id]: { preview, time: relTime(msg.timestamp_ms) } }))
        })
        .catch(() => {})
    })
  }, [threads])

  const withMeta: ThreadWithMeta[] = threads.map(t => ({
    ...t,
    preview: meta[t.id]?.preview ?? '…',
    time:    meta[t.id]?.time    ?? '',
  }))

  const filtered = search
    ? withMeta.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : withMeta

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="px-4 pt-[calc(1rem_+_env(safe-area-inset-top))] pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[22px] font-bold text-gray-900 dark:text-white">Chats</h2>
          <button className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Messenger"
            className="w-full pl-8 pr-3 py-2 bg-gray-100 dark:bg-zinc-700 rounded-full text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 outline-none"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(t => {
          const active = t.id === activeThreadId
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`w-full px-2 py-1.5 flex items-center gap-3 transition-colors text-left rounded-xl mx-1 my-0.5 ${
                active
                  ? 'bg-blue-50 dark:bg-zinc-700'
                  : 'hover:bg-gray-100 dark:hover:bg-zinc-700'
              }`}
              style={{ width: 'calc(100% - 8px)' }}
            >
              {/* Avatar */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xl select-none ${t.color}`}>
                {t.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">{t.name}</span>
                  {t.time && <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">{t.time}</span>}
                </div>
                <div className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{t.preview}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
