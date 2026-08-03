'use client'
import { useEffect, useRef, useState } from 'react'
import { ThreadParticipant } from '@/types'

interface GalleryFilterBarProps {
  participants: ThreadParticipant[]
  senderIds: string[]
  onSenderIdsChange: (ids: string[]) => void
  /** `YYYY-MM` or empty string for all months. */
  yearMonth: string
  onYearMonthChange: (ym: string) => void
}

export default function GalleryFilterBar({
  participants, senderIds, onSenderIdsChange, yearMonth, onYearMonthChange,
}: GalleryFilterBarProps) {
  const [senderMenuOpen, setSenderMenuOpen] = useState(false)
  const senderMenuRef = useRef<HTMLDivElement>(null)
  const members = participants.filter(p => !!p.id)
  const hasSenderFilter = senderIds.length > 0
  const hasDateFilter = !!yearMonth
  const hasAny = hasSenderFilter || hasDateFilter

  useEffect(() => {
    if (!senderMenuOpen) return
    const close = (e: MouseEvent) => {
      if (!senderMenuRef.current?.contains(e.target as Node)) setSenderMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [senderMenuOpen])

  const senderLabel = !hasSenderFilter
    ? 'All senders'
    : senderIds.length === 1
      ? (members.find(p => p.id === senderIds[0])?.name ?? '1 sender')
      : `${senderIds.length} senders`

  const monthLabel = yearMonth
    ? new Date(`${yearMonth}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : ''

  function toggleSender(id: string) {
    const next = senderIds.includes(id) ? senderIds.filter(x => x !== id) : [...senderIds, id]
    onSenderIdsChange(next)
  }

  function clearSenders() {
    onSenderIdsChange([])
  }

  function clearAll() {
    onSenderIdsChange([])
    onYearMonthChange('')
  }

  return (
    <div className="relative z-20 shrink-0 px-3 py-2 liquid-glass-bar liquid-glass-bar-frosted space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {members.length > 0 && (
          <div ref={senderMenuRef} className="relative min-w-0 flex-1 sm:flex-none sm:w-56">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={senderMenuOpen}
              onClick={() => setSenderMenuOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl liquid-glass text-left text-sm text-gray-800 dark:text-mist-100 transition-colors"
            >
              <span className="flex-1 min-w-0 truncate font-medium">{senderLabel}</span>
              {hasSenderFilter && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear senders"
                  className="shrink-0 text-xs text-mist-500 hover:text-gray-800 dark:hover:text-white px-1"
                  onClick={e => { e.stopPropagation(); clearSenders() }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      clearSenders()
                    }
                  }}
                >
                  Clear
                </span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-mist-400 transition-transform ${senderMenuOpen ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {senderMenuOpen && (
              <div
                role="listbox"
                aria-multiselectable
                className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-64 overflow-y-auto rounded-xl liquid-glass shadow-lg py-1"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={!hasSenderFilter}
                  onClick={() => { clearSenders(); setSenderMenuOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                    !hasSenderFilter
                      ? 'liquid-glass-selected text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-mist-200 liquid-glass-hover'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    !hasSenderFilter
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-mist-300 dark:border-mist-600'
                  }`}>
                    {!hasSenderFilter && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                  </span>
                  All senders
                </button>
                {members.map(p => {
                  const checked = senderIds.includes(p.id!)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleSender(p.id!)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-[background,box-shadow] ${
                        checked
                          ? 'liquid-glass-selected text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-mist-200 liquid-glass-hover'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        checked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-mist-300 dark:border-mist-600'
                      }`}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                        )}
                      </span>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white shrink-0 ${p.color || 'bg-violet-400'}`}>
                        {p.initials || '?'}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <label className="relative flex items-center gap-2 px-3 py-2 rounded-xl liquid-glass text-sm text-gray-800 dark:text-mist-100 cursor-pointer">
          <span className="text-mist-500 dark:text-mist-400 text-xs font-medium shrink-0">Month</span>
          <input
            type="month"
            value={yearMonth}
            onChange={e => onYearMonthChange(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-800 dark:text-mist-100 outline-none min-w-0"
          />
          {hasDateFilter && (
            <button
              type="button"
              aria-label="Clear month"
              className="shrink-0 text-xs text-mist-500 hover:text-gray-800 dark:hover:text-white px-1"
              onClick={() => onYearMonthChange('')}
            >
              Clear
            </button>
          )}
        </label>

        {hasAny && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-mist-500 hover:text-gray-800 dark:hover:text-white px-2 py-1"
          >
            Clear all
          </button>
        )}
      </div>

      {hasAny && (
        <div className="flex flex-wrap gap-1.5">
          {senderIds.map(id => {
            const p = members.find(m => m.id === id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleSender(id)}
                className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full liquid-glass text-xs font-medium text-gray-800 dark:text-mist-100"
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white ${p?.color || 'bg-violet-400'}`}>
                  {p?.initials || '?'}
                </span>
                <span className="truncate max-w-[8rem]">{p?.name ?? id}</span>
                <span className="text-mist-400" aria-hidden>×</span>
              </button>
            )
          })}
          {hasDateFilter && (
            <button
              type="button"
              onClick={() => onYearMonthChange('')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full liquid-glass text-xs font-medium text-gray-800 dark:text-mist-100"
            >
              {monthLabel}
              <span className="text-mist-400" aria-hidden>×</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
