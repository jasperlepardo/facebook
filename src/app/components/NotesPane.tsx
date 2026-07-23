'use client'
import { useState, useMemo } from 'react'
import { Note } from '../types'
import { TAG_COLORS, TAG_LABELS } from '../lib/constants'
import { fmtDateRange } from '../lib/format'

interface Props {
  notes: Note[]
  onEdit: (note: Note) => void
  onNew: () => void
  onJumpToDate: (date: string) => void
  onJumpToMessage: (msgId: string) => void
  onContextMenu: (e: React.MouseEvent, note: Note) => void
}

export default function NotesPane({ notes, onEdit, onNew, onJumpToDate, onJumpToMessage, onContextMenu }: Props) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.toLowerCase()
    return q ? notes.filter(n => n.tags.some(t => t.includes(q)) || n.title.toLowerCase().includes(q) || (n.body ?? '').toLowerCase().includes(q)) : notes
  }, [notes, filter])

  return (
    <div className="w-1/2 min-w-[220px] flex flex-col bg-white flex-shrink-0">
      <div className="px-3.5 py-2.5 border-b border-gray-200 text-[13px] font-bold text-gray-900 flex items-center gap-2 flex-shrink-0">
        <span className="flex-1">📝 Analysis Notes</span>
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter tags…"
          className="px-2 py-1 text-xs border border-gray-300 rounded-full outline-none w-[120px]"
        />
        <button onClick={onNew} className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-full cursor-pointer font-semibold flex-shrink-0">+ New</button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        {filtered.length === 0 && (
          <p className="px-4 py-4 text-gray-500 text-[13px]">No notes match.</p>
        )}
        {filtered.map(n => {
          const color = TAG_COLORS[n.tags[0]] ?? '#e4e6ea'
          const firstMsgId = (n.msgIds ?? '').split(',').filter(Boolean)[0]
          const editor = n.updatedBy?.name || n.createdBy?.name || ''
          return (
            <div
              key={n.id}
              style={{ borderLeftColor: color }}
              className="border-l-[3px] px-2.5 py-1.5 mb-3.5 cursor-pointer transition-colors hover:bg-gray-50 group"
              onClick={() => firstMsgId ? onJumpToMessage(firstMsgId) : onJumpToDate(n.start)}
              onContextMenu={e => onContextMenu(e, n)}
            >
              <div className="flex justify-between items-center mb-0.5 text-[11px] text-gray-500">
                <span>{fmtDateRange(n.start, n.end)}</span>
                <div className="flex items-center gap-1.5">
                  {editor && <span className="text-[10px] text-gray-400">{editor}</span>}
                  <button className="text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 px-0.5"
                    onClick={e => { e.stopPropagation(); onEdit(n) }}>✏</button>
                  <button className="text-[11px] text-blue-600 opacity-70 hover:opacity-100"
                    onClick={e => { e.stopPropagation(); firstMsgId ? onJumpToMessage(firstMsgId) : onJumpToDate(n.start) }}>
                    {firstMsgId ? '→ Message' : '→ Chat'}
                  </button>
                </div>
              </div>
              {n.tags.length > 0 && (
                <div className="text-[10px] text-gray-400 uppercase tracking-[.4px] mb-0.5">
                  {n.tags.map(t => TAG_LABELS[t] ?? t).join(' · ')}
                </div>
              )}
              <div className="text-[13px] font-bold text-gray-900 mb-1">{n.title}</div>
              {n.body && <div className="text-xs text-gray-500 leading-snug">{n.body}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
