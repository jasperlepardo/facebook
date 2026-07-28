'use client'
import React, { useRef, useState, useEffect } from 'react'
import { Section } from '@/types'

interface AppHeaderProps {
  section: Section
  sectionTitle: string
  onBack?: () => void
  thread?: { name: string; initials: string; color: string }
  activeHashtagName: string | null
  editingHashtagTitle: boolean
  setEditingHashtagTitle: (v: boolean) => void
  hashtagTitleInput: string
  setHashtagTitleInput: (v: string) => void
  hashtagTitleInputRef: React.RefObject<HTMLInputElement | null>
  hashtagActionsRef: React.RefObject<{ back: () => void; delete: () => void; rename: (name: string) => Promise<void> } | null>
  setActiveHashtagName: (name: string | null) => void
  searchInput: string
  onSearchChange: (v: string) => void
  hashtagFilter: string
  onHashtagFilterChange: (v: string) => void
  onHashtagCreatingChange: (v: boolean) => void
  showHashtagMenu: boolean
  setShowHashtagMenu: (v: boolean | ((prev: boolean) => boolean)) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  hideImages?: boolean
  onToggleHideImages?: () => void
}

export default function AppHeader({
  section,
  thread,
  sectionTitle,
  onBack,
  activeHashtagName,
  editingHashtagTitle,
  setEditingHashtagTitle,
  hashtagTitleInput,
  setHashtagTitleInput,
  hashtagTitleInputRef,
  hashtagActionsRef,
  setActiveHashtagName,
  searchInput,
  onSearchChange,
  hashtagFilter,
  onHashtagFilterChange,
  onHashtagCreatingChange,
  showHashtagMenu,
  setShowHashtagMenu,
  scrollContainerRef,
  hideImages,
  onToggleHideImages,
}: AppHeaderProps) {
  const lastScrollY = useRef(0)
  const [searchVisible, setSearchVisible] = useState(true)

  // Reset search visibility when section changes
  useEffect(() => {
    setSearchVisible(true)
    lastScrollY.current = 0
  }, [section])

  // Scroll direction detection for mobile search hide/show
  useEffect(() => {
    const el = scrollContainerRef?.current
    if (!el) return
    const handler = () => {
      const current = el.scrollTop
      if (current === 0) {
        setSearchVisible(true)
        lastScrollY.current = 0
        return
      }
      const delta = current - lastScrollY.current
      if (Math.abs(delta) > 8) {
        setSearchVisible(delta < 0) // show on scroll up, hide on scroll down
        lastScrollY.current = current
      }
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [scrollContainerRef]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasSearch = section === 'chat' || (section === 'hashtags' && !activeHashtagName)

  const chatSearchInput = (extraClass = '') => (
    <input
      type="search"
      value={searchInput}
      onChange={e => onSearchChange(e.target.value)}
      placeholder="Search messages…"
      className={`px-3.5 py-1.5 rounded-full bg-white/20 text-white text-[13px] outline-none placeholder:text-white/65 focus:bg-white/30 w-full ${extraClass}`}
    />
  )

  const hashtagFilterInput = (extraClass = '') => (
    <input
      value={hashtagFilter}
      onChange={e => onHashtagFilterChange(e.target.value)}
      placeholder="Filter…"
      className={`px-3 py-1.5 rounded-full bg-white/20 text-white text-[13px] outline-none placeholder:text-white/65 focus:bg-white/30 w-full ${extraClass}`}
    />
  )

  return (
    <div className="sticky top-0 z-20 bg-blue-600 text-white flex-shrink-0">
      {/* Main row: Title | Search (desktop) | Actions */}
      <div className="px-4 pt-[calc(0.625rem_+_env(safe-area-inset-top))] pb-2.5 flex items-center gap-2.5 md:grid md:grid-cols-3 md:gap-4">

        {/* Left: back button + title */}
        <div className="flex items-center gap-1.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="text-white/80 hover:text-white -ml-1.5 p-1 flex items-center flex-shrink-0 md:hidden"
              title="Back to chats"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          )}
          {section === 'hashtags' && activeHashtagName && (
            <button
              onClick={() => hashtagActionsRef.current?.back()}
              className="text-white/80 hover:text-white -ml-1.5 p-1 flex items-center flex-shrink-0"
              title="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
          )}
          {section === 'hashtags' && activeHashtagName ? (
            editingHashtagTitle ? (
              <input
                ref={hashtagTitleInputRef}
                value={hashtagTitleInput}
                onChange={e => setHashtagTitleInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    const name = hashtagTitleInput.trim()
                    if (name) { await hashtagActionsRef.current?.rename?.(name); setActiveHashtagName(name) }
                    setEditingHashtagTitle(false)
                  }
                  if (e.key === 'Escape') { setEditingHashtagTitle(false) }
                }}
                onBlur={async () => {
                  const name = hashtagTitleInput.trim()
                  if (name) { await hashtagActionsRef.current?.rename?.(name); setActiveHashtagName(name) }
                  setEditingHashtagTitle(false)
                }}
                className="text-sm font-bold bg-transparent border-b border-white/60 outline-none text-white w-40"
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setHashtagTitleInput(activeHashtagName); setEditingHashtagTitle(true) }}
                className="text-sm font-bold hover:underline decoration-white/60 flex items-center gap-1 group"
                title="Click to rename"
              >
                {sectionTitle}
                <svg className="opacity-0 group-hover:opacity-60 transition-opacity" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )
          ) : section === 'chat' && thread ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none ${thread.color}`}>
                {thread.initials}
              </div>
              <span className="text-sm font-bold truncate">{thread.name}</span>
            </div>
          ) : (
            <span className="text-sm font-bold">{sectionTitle}</span>
          )}
        </div>

        {/* Center: search input (desktop only, always rendered to hold grid column) */}
        <div className="hidden md:flex items-center justify-center">
          {hasSearch && (section === 'chat' ? chatSearchInput() : hashtagFilterInput())}
        </div>

        {/* Right: action area — ml-auto pushes to right on mobile (center col is hidden); md:ml-0 lets grid handle it */}
        <div className="flex items-center gap-1 ml-auto md:ml-0 justify-end">
          {/* Thread action icons — chat section only */}
          {section === 'chat' && thread && (<>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white" title="Call">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.49 5.49l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white" title="Video call">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white" title="Info">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </button>
          </>)}
          {/* Hide images toggle */}
          {section === 'chat' && onToggleHideImages && (
            <button
              onClick={onToggleHideImages}
              title={hideImages ? 'Show images' : 'Hide images'}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${hideImages ? 'bg-white/30 text-white' : 'hover:bg-white/20 text-white/70 hover:text-white'}`}
            >
              {hideImages ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="2" y1="2" x2="22" y2="22"/>
                  <path d="M10.94 6.08A6.93 6.93 0 0 1 12 6c3.18 0 6 2.5 7.73 5A13.16 13.16 0 0 1 18 13.7"/>
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 4.27 11C6 13.5 8.82 16 12 16a9.77 9.77 0 0 0 2.94-.5"/>
                  <path d="M7.51 7.51A7 7 0 0 0 12 18c1.93 0 3.68-.79 4.95-2.05"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              )}
            </button>
          )}
          {/* + New button for hashtag list */}
          {section === 'hashtags' && !activeHashtagName && (
            <button
              onClick={() => onHashtagCreatingChange(true)}
              className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full font-semibold transition-colors"
            >+ New</button>
          )}
          {/* ⋯ menu for hashtag detail */}
          {section === 'hashtags' && activeHashtagName && (
            <div className="relative">
              <button
                onClick={() => setShowHashtagMenu(v => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white"
                title="More options"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                </svg>
              </button>
              {showHashtagMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHashtagMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900 py-1 z-50 min-w-[120px] border border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => { hashtagActionsRef.current?.delete(); setShowHashtagMenu(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >Delete</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search row: mobile only, slides in/out on scroll */}
      {hasSearch && (
        <div className={`md:hidden grid transition-[grid-template-rows] duration-200 ease-in-out ${searchVisible ? '[grid-template-rows:1fr]' : '[grid-template-rows:0fr]'}`}>
          <div className="overflow-hidden">
            <div className="px-4 pb-2.5">
              {section === 'chat' ? chatSearchInput() : hashtagFilterInput()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
