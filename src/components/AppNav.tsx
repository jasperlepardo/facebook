'use client'
import { Section } from '@/types'

function ChatIcon({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}

function HashtagIcon({ filled }: { filled?: boolean }) {
  const w = filled ? '2.2' : '1.8'
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
}

function PersonIcon({ filled }: { filled?: boolean }) {
  return filled
    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}

function StoryIcon({ filled }: { filled?: boolean }) {
  const w = filled ? '2.2' : '1.8'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}

interface AppNavProps {
  section: Section
  prevSection?: 'chat' | 'hashtags' | 'story'
  initials: string
  name?: string
  hiddenOnMobile?: boolean
  onSectionChange: (s: Section) => void
  isExpanded?: boolean
  onToggleExpanded?: () => void
}

export default function AppNav({ section, prevSection = 'chat', initials, name, hiddenOnMobile, onSectionChange, isExpanded = false, onToggleExpanded }: AppNavProps) {
  const navItems = [
    { key: 'chat'     as Section, label: 'Chat',     icon: (a: boolean) => <ChatIcon filled={a} /> },
    { key: 'hashtags' as Section, label: 'Hashtags', icon: (a: boolean) => <HashtagIcon filled={a} /> },
    { key: 'story'    as Section, label: 'Story',    icon: (a: boolean) => <StoryIcon filled={a} /> },
  ]

  const btnBase    = 'rounded-lg flex items-center transition-colors shrink-0'
  const btnActive  = 'bg-mist-200 dark:bg-mist-800 text-mist-700 dark:text-mist-200'
  const btnIdle    = 'text-mist-500 dark:text-mist-400 hover:bg-mist-100 dark:hover:bg-mist-800 hover:text-mist-700 dark:hover:text-mist-200'
  const avatarBg   = section === 'settings' ? 'bg-blue-600 text-white' : 'bg-mist-200 dark:bg-mist-700 text-mist-700 dark:text-mist-200'
  const settingsColor = section === 'settings' ? btnActive : 'text-mist-500 dark:text-mist-400 hover:bg-mist-100 dark:hover:bg-mist-800'

  return (
    <div className={hiddenOnMobile
      ? 'hidden md:contents'
      : 'flex fixed inset-x-0 bottom-0 z-20 justify-center pointer-events-none pb-[env(safe-area-inset-bottom)] md:contents'
    }>
    <nav className={`pointer-events-auto liquid-glass shrink-0 flex flex-col rounded-full my-2 md:static md:rounded-none md:my-0 md:pb-0 md:overflow-hidden md:transition-all md:duration-200 md:ease-in-out md:bg-mist-50 md:dark:bg-mist-950 md:backdrop-filter-none md:[border:none] md:shadow-none md:before:hidden ${isExpanded ? 'md:w-60' : 'md:w-fit'}`}>

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
                ${active ? 'bg-black/8 dark:bg-white/12 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {icon(active)}
            </button>
          )
        })}
      </div>

      {/* Desktop: vertical sidebar */}
      <div className={`hidden md:flex flex-col flex-1 gap-1 overflow-hidden ${isExpanded ? 'items-stretch' : 'items-center'}`}>

        {navItems.map(({ key, label, icon }) => {
          const active = section === key
          return (
            <button
              key={key}
              onClick={() => onSectionChange(key)}
              title={label}
              aria-label={label}
              className={`${btnBase} ${active ? btnActive : btnIdle} ${isExpanded ? 'w-full flex-row gap-3 p-3' : 'w-12 flex-col justify-center p-3'}`}
            >
              <span className="shrink-0">{icon(active)}</span>
              {isExpanded && <span className="text-sm font-semibold whitespace-nowrap">{label}</span>}
            </button>
          )
        })}

        <div className="flex-1" />

        {/* Avatar / Settings + Toggle */}
        <div className={`flex gap-1 ${isExpanded ? 'flex-row items-center' : 'flex-col items-center'}`}>
          <button
            onClick={() => onSectionChange(section === 'settings' ? prevSection : 'settings')}
            title="Settings"
            className={`${btnBase} ${settingsColor} ${isExpanded ? 'flex-1 flex-row gap-3 p-1' : 'w-12 flex-col justify-center p-1'}`}
          >
            <div className={`shrink-0 rounded-full flex items-center justify-center font-bold select-none w-10 h-10 text-sm ${avatarBg}`}>
              {initials || '?'}
            </div>
            {isExpanded && <span className="text-sm font-semibold whitespace-nowrap">{name || 'You'}</span>}
          </button>
          <button
            onClick={onToggleExpanded}
            title={isExpanded ? 'Collapse menu' : 'Expand menu'}
            className={`${btnBase} ${btnIdle} flex-col justify-center p-3`}
          >
            <svg
              className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-0' : 'rotate-180'}`}
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

      </div>

    </nav>
    </div>
  )
}
