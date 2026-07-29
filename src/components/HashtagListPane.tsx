'use client'
import { Hashtag } from '@/types'

const AVATAR_COLORS = [
  'bg-mist-500', 'bg-rose-400', 'bg-violet-400', 'bg-amber-400',
  'bg-mist-400', 'bg-sky-400', 'bg-pink-400', 'bg-indigo-400',
]

function avatarColor(name: string) {
  let n = 0; for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xff
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

interface Props {
  hashtags: Hashtag[]
  activeHashtagId: string | null
  filter: string
  onFilterChange: (v: string) => void
  onCreatingChange: (v: boolean) => void
  onSelect: (h: Hashtag) => void
}

export default function HashtagListPane({ hashtags, activeHashtagId, filter, onFilterChange, onCreatingChange, onSelect }: Props) {

  const filtered = filter ? hashtags.filter(h => h.name.includes(filter.toLowerCase())) : hashtags

  return (
    <div className="flex flex-col h-full bg-white dark:bg-mist-950 md:dark:bg-mist-900">
      {/* Header */}
      <div className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[22px] font-bold text-gray-900 dark:text-white">Hashtags</h2>
          <button
            onClick={() => onCreatingChange(true)}
            className="w-8 h-8 rounded-full bg-mist-100 dark:bg-mist-800 flex items-center justify-center text-mist-600 dark:text-mist-300 hover:bg-mist-200 dark:hover:bg-mist-700 transition-colors"
            title="New hashtag"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={filter}
            onChange={e => onFilterChange(e.target.value)}
            placeholder="Filter hashtags"
            className="w-full pl-8 pr-3 py-2 bg-mist-100 dark:bg-mist-800 rounded-full text-[13px] text-gray-900 dark:text-mist-100 placeholder:text-mist-400 dark:placeholder:text-mist-500 outline-hidden"
          />
        </div>
      </div>


      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-mist-400 dark:text-mist-500 text-center py-8">{filter ? 'No matches.' : 'No hashtags yet.'}</p>
        )}
        {filtered.map(h => {
          const count = h.groupCount ?? 0
          const initial = h.name[0]?.toUpperCase() ?? '#'
          const active = h.id === activeHashtagId
          return (
            <button key={h.id} onClick={() => onSelect(h)}
              className={`w-full text-left px-2 py-1.5 flex items-center gap-3 transition-colors rounded-xl mx-1 my-0.5 ${active ? 'bg-mist-100 dark:bg-mist-800' : 'hover:bg-mist-50 dark:hover:bg-mist-800'}`}
              style={{ width: 'calc(100% - 8px)' }}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xl select-none ${avatarColor(h.name)}`}>
                {h.isPrivate ? '🔒' : initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">#{h.name}</span>
                  {count > 0 && <span className="text-[11px] text-mist-400 dark:text-mist-500 shrink-0">{count}b</span>}
                </div>
                <div className="text-[13px] text-mist-500 dark:text-mist-400 truncate mt-0.5">
                  {h.context ?? <span className="italic text-mist-300 dark:text-mist-600">No context</span>}
                </div>
              </div>
              {active && <div className="w-2.5 h-2.5 rounded-full bg-mist-600 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
