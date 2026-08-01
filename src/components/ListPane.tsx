'use client'

import { useRef } from 'react'
import { LockIcon } from '@/components/icons'
import AvatarGroup from '@/components/AvatarGroup'
import { pbNav, headerBtn, headerField } from '@/lib/ui'
import { useFrostedOnScroll } from '@/hooks/useFrostedBar'

export interface ListPaneItem {
  id: string
  label: string
  initials?: string
  color?: string
  /** Group / member avatars — preferred over single initials when present. */
  avatars?: { initials: string; color: string }[]
  subtitle?: string
  badge?: string
  isPrivate?: boolean
  author?: string
}

interface Props {
  title: string
  items: ListPaneItem[]
  activeId: string | null
  filter: string
  onFilterChange: (v: string) => void
  filterPlaceholder?: string
  onNew?: () => void
  onSelect: (id: string) => void
  emptyMessage?: string
}

export default function ListPane({ title, items, activeId, filter, onFilterChange, filterPlaceholder, onNew, onSelect, emptyMessage }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const frosted = useFrostedOnScroll(barRef)
  const filtered = filter
    ? items.filter(i => i.label.toLowerCase().includes(filter.toLowerCase()))
    : items

  return (
    <div className="flex flex-col h-full liquid-glass-atmosphere md:shadow-xl">
      {/* Header */}
      <div ref={barRef} className={`liquid-glass-bar px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 shrink-0${frosted ? ' liquid-glass-bar-frosted' : ''}`}>
        <div className="flex items-center justify-between mb-3 min-h-8">
          <h2 className="text-[22px] font-bold text-gray-900 dark:text-white">{title}</h2>
          {onNew && (
            <button
              type="button"
              onClick={onNew}
              aria-label="New"
              className={headerBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Search / filter */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-400 pointer-events-none z-[1]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={filter}
            onChange={e => onFilterChange(e.target.value)}
            placeholder={filterPlaceholder ?? 'Search'}
            className={`${headerField} !pl-8`}
          />
        </div>
      </div>

      {/* List — clear floating mobile nav */}
      <div className={`flex-1 overflow-y-auto ${pbNav} md:pb-0`}>
        {filtered.length === 0 && (
          <p className="text-xs text-mist-400 dark:text-mist-500 text-center py-8">
            {emptyMessage ?? (filter ? 'No matches.' : 'Nothing here yet.')}
          </p>
        )}
        {filtered.map(item => {
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`list-item-${item.id}`}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left px-2 py-1.5 flex items-center gap-3 transition-[background,box-shadow] rounded-xl mx-1 my-0.5 liquid-glass-hover ${
                active ? 'liquid-glass-selected' : ''
              }`}
              style={{ width: 'calc(100% - 8px)' }}
            >
              {/* Avatar */}
              {(item.avatars && item.avatars.length > 0) ? (
                <AvatarGroup people={item.avatars} size="md" />
              ) : item.initials ? (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xl select-none ${item.color ?? ''}`}>
                  {item.initials}
                </div>
              ) : null}

              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">{item.label}</span>
                  {item.isPrivate && (
                    <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title="Private">
                      <LockIcon size={10} />
                    </span>
                  )}
                </div>
                {/* Author */}
                {item.author && (
                  <div className="text-[12px] text-mist-400 dark:text-mist-500 truncate">By: {item.author}</div>
                )}
                {/* Subtitle */}
                {item.subtitle && (
                  <div className="text-[13px] text-mist-500 dark:text-mist-400 truncate mt-0.5">{item.subtitle}</div>
                )}
              </div>
              {active && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
