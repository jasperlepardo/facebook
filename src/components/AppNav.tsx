'use client'
import { Section } from '@/types'

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function MediaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
}

function HashtagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/>
      <line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/>
      <line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  )
}

interface AppNavProps {
  section: Section
  initials: string
  onSectionChange: (s: Section) => void
}

export default function AppNav({ section, initials, onSectionChange }: AppNavProps) {
  const navItems = [
    { key: 'chat'     as Section, label: 'Chat',     icon: <ChatIcon /> },
    { key: 'media'    as Section, label: 'Media',    icon: <MediaIcon /> },
    { key: 'hashtags' as Section, label: 'Hashtags', icon: <HashtagIcon /> },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 flex-shrink-0 flex flex-col md:static md:flex-col md:w-16 pb-[env(safe-area-inset-bottom)] md:pb-0">
      {/* Button row — fixed h-14 on mobile, fills height on desktop */}
      <div className="flex flex-row md:flex-col h-14 md:h-auto md:flex-1 md:pt-3 items-stretch md:items-center gap-0.5 md:gap-1 px-1 md:px-0">
        {navItems.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onSectionChange(key)}
            title={label}
            className={`flex-1 md:flex-none md:w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-2 md:py-2.5 px-1 transition-colors ${
              section === key
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {icon}
            <span className="text-[10px] font-semibold leading-none">{label}</span>
          </button>
        ))}
        {/* Spacer pushes avatar to bottom on desktop */}
        <div className="hidden md:flex flex-1" />
        {/* Avatar — opens settings */}
        <button
          onClick={() => onSectionChange(section === 'settings' ? 'chat' : 'settings')}
          title="Settings"
          className={`flex-1 md:flex-none md:w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-2 md:py-2.5 px-1 transition-colors md:mb-1 ${
            section === 'settings'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold select-none ${
            section === 'settings'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
          }`}>
            {initials || '?'}
          </div>
          <span className="text-[10px] font-semibold leading-none">You</span>
        </button>
      </div>
    </nav>
  )
}
