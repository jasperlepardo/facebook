'use client'
import { Section } from '@/types'

function ChatIcon({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}

function HashtagIcon({ filled }: { filled?: boolean }) {
  const w = filled ? '2.2' : '1.8'
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
}

function PersonIcon({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}

interface AppNavProps {
  section: Section
  prevSection?: 'chat' | 'hashtags'
  initials: string
  hiddenOnMobile?: boolean
  onSectionChange: (s: Section) => void
  isExpanded?: boolean
  onToggleExpanded?: () => void
}

export default function AppNav({ section, prevSection = 'chat', initials, hiddenOnMobile, onSectionChange, isExpanded = false, onToggleExpanded }: AppNavProps) {
  const navItems = [
    { key: 'chat'     as Section, label: 'Chat',     icon: (a: boolean) => <ChatIcon filled={a} /> },
    { key: 'hashtags' as Section, label: 'Hashtags', icon: (a: boolean) => <HashtagIcon filled={a} /> },
  ]

  const btnBase = 'rounded-xl flex items-center transition-colors shrink-0'
  const btnActive = 'bg-mist-200 dark:bg-mist-800 text-mist-700 dark:text-mist-200'
  const btnIdle   = 'text-mist-500 dark:text-mist-400 hover:bg-mist-100 dark:hover:bg-mist-800 hover:text-mist-700 dark:hover:text-mist-200'
  const btnCollapsed = 'w-12 flex-col justify-center py-2.5 px-1'
  const btnExpanded  = 'w-full flex-row gap-3 px-3 py-2.5'

  return (
    <div className={`floating-nav-wrap ${hiddenOnMobile ? 'hidden md:contents' : ''}`}>
    <nav className={`liquid-glass shrink-0 flex flex-col rounded-full my-2 md:static md:rounded-2xl md:my-0 md:pb-0 md:overflow-hidden md:transition-all md:duration-200 md:ease-in-out ${isExpanded ? 'md:w-48' : 'md:w-16'}`}>

      {/* Mobile: horizontal capsule row */}
      <div className="flex md:hidden flex-row items-center px-2 py-2 gap-1">
        {[...navItems, { key: 'settings' as Section, label: 'You', icon: (a: boolean) => <PersonIcon filled={a} /> }].map(({ key, label, icon }) => {
          const active = section === key
          return (
            <button
              key={key}
              onClick={() => onSectionChange(key)}
              title={label}
              className={`flex items-center justify-center w-12 h-10 rounded-full transition-colors
                ${active
                  ? 'bg-black/8 dark:bg-white/12 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
                }`}
            >
              {icon(active)}
            </button>
          )
        })}
      </div>

      {/* Desktop: vertical sidebar */}
      <div className={`hidden md:flex flex-col flex-1 pt-2 gap-1 overflow-hidden ${isExpanded ? 'px-2 items-stretch' : 'px-0 items-center'}`}>

        {/* Collapse / expand toggle */}
        <button
          onClick={onToggleExpanded}
          title={isExpanded ? 'Collapse menu' : 'Expand menu'}
          className={`${btnBase} ${btnIdle} mb-1 ${isExpanded ? 'gap-3 px-3 py-2 w-full' : 'w-12 justify-center py-2'}`}
        >
          <svg
            className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-0' : 'rotate-180'}`}
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {isExpanded && (
            <span className="text-sm font-semibold whitespace-nowrap">Menu</span>
          )}
        </button>

        {/* Nav items */}
        {navItems.map(({ key, label, icon }) => {
          const active = section === key
          return (
            <button
              key={key}
              onClick={() => onSectionChange(key)}
              title={label}
              className={`${btnBase} ${active ? btnActive : btnIdle} ${isExpanded ? btnExpanded : btnCollapsed}`}
            >
              <span className="shrink-0">{icon(active)}</span>
              {isExpanded && (
                <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
              )}
            </button>
          )
        })}

        <div className="flex-1" />

        {/* Avatar / Settings */}
        <button
          onClick={() => onSectionChange(section === 'settings' ? prevSection : 'settings')}
          title="Settings"
          className={`${btnBase} mb-1
            ${section === 'settings' ? btnActive : 'text-mist-500 dark:text-mist-400 hover:bg-mist-100 dark:hover:bg-mist-800'}
            ${isExpanded ? btnExpanded : btnCollapsed}`}
        >
          <div className={`shrink-0 rounded-full flex items-center justify-center font-bold select-none
            ${isExpanded ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[10px]'}
            ${section === 'settings' ? 'bg-mist-600 text-white' : 'bg-mist-200 dark:bg-mist-700 text-mist-700 dark:text-mist-200'}`}>
            {initials || '?'}
          </div>
          {isExpanded && (
            <span className="text-sm font-semibold whitespace-nowrap">You</span>
          )}
        </button>

      </div>

    </nav>
    </div>
  )
}
