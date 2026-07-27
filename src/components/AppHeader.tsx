'use client'
import React, { useRef, useState, useEffect } from 'react'
import { Section } from '@/types'

interface AppHeaderProps {
  section: Section
  sectionTitle: string
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
}

export default function AppHeader({
  section,
  sectionTitle,
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
          ) : (
            <span className="text-sm font-bold">{sectionTitle}</span>
          )}
        </div>

        {/* Center: search input (desktop only, always rendered to hold grid column) */}
        <div className="hidden md:flex items-center justify-center">
          {hasSearch && (section === 'chat' ? chatSearchInput() : hashtagFilterInput())}
        </div>

        {/* Right: action area — ml-auto pushes to right on mobile (center col is hidden); md:ml-0 lets grid handle it */}
        <div className="flex items-center gap-2 ml-auto md:ml-0 justify-end">
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
