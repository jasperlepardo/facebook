'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Section, Thread, LightboxState, ContextMenuState, GalleryItem, DateIndex } from '@/types'
import { toast } from '@/lib/toast'
import { ContentTypeKey, ALL_CONTENT_TYPE_KEYS, DEFAULT_ENABLED } from '@/lib/contentTypes'
import { useHashtagPaneState } from '@/hooks/useHashtagPaneState'
import { useHiddenState } from '@/hooks/useHiddenState'
import { useViewerUrlSync, initialSection, initialActiveThread, initialChatDetailOpen } from '@/hooks/useViewerUrlSync'
import { useViewerInit } from '@/hooks/useViewerInit'
import ChatViewSettingsModal from './ChatViewSettingsModal'
import ContextMenu from './ContextMenu'
import ActionSheet from './ActionSheet'
import AppHeader from './AppHeader'
import AppLayout, { AppLayoutControls } from './AppLayout'
import ListPane, { ListPaneItem } from './ListPane'
import ChatDetailPane, { JumpFn } from './ChatDetailPane'
import InAppBrowserBanner from './InAppBrowserBanner'
import ThreadAvatar from './ThreadAvatar'
import Toaster from './Toaster'
import { menu, menuItem } from '@/lib/ui'
import { LockIcon, GlobeIcon } from '@/components/icons'
import { ListPaneSkeleton, ChatDetailSkeleton } from '@/components/skeletons'

const HashtagsPane = dynamic(() => import('./HashtagsPane'), { ssr: false })
const StoryPane    = dynamic(() => import('./story/StoryPane'),    { ssr: false })
const SettingsPane = dynamic(() => import('./settings/SettingsPane'), { ssr: false })
const MediaPane    = dynamic(() => import('./MediaPane'), { ssr: false })
const Lightbox     = dynamic(() => import('./Lightbox'), { ssr: false })

export default function ViewerApp() {
  // Navigation — default to 'chat' for SSR, then correct from URL after hydration
  const [section, setSection]         = useState<Section>(initialSection)
  const [prevSection, setPrevSection] = useState<'chat' | 'hashtags' | 'story'>('chat')
  // ─── Hidden state ────────────────────────────────────────────────────────────
  const {
    hiddenUris, setDbHiddenItems,
    dbHiddenMsgIds, allHiddenUris,
    hideUri, handleHideMessage, handleUnhideMessage,
    handleHideDbUri, handleUnhideDbUri, clearHiddenUris,
  } = useHiddenState()

  // ─── Hashtag pane state ───────────────────────────────────────────────────────
  const {
    hashtags, hashtagFilter, setHashtagFilter,
    hashtagCreating, setHashtagCreating,
    pendingHashtag, setPendingHashtag,
    activeHashtagName, setActiveHashtagName,
    hashtagActiveTab, setHashtagActiveTab,
    hashtagMsgFilter, setHashtagMsgFilter,
    showHashtagMenu, setShowHashtagMenu,
    editingHashtagTitle, setEditingHashtagTitle,
    hashtagTitleInput, setHashtagTitleInput,
    hashtagActionsRef, hashtagTitleInputRef,
    reloadHashtags, selectActiveHashtag,
    setHashtags,
  } = useHashtagPaneState()

  // ─── Chat / thread state ──────────────────────────────────────────────────────
  const [searchInput, setSearchInput]   = useState('')
  const [activeThread, setActiveThread] = useState<string>(initialActiveThread)
  const [chatDetailOpen, setChatDetailOpen] = useState(initialChatDetailOpen)
  const [threadFilter, setThreadFilter] = useState('')
  const [threadMeta, setThreadMeta]     = useState<Record<string, { subtitle: string; badge: string }>>({})
  const [chatTotal, setChatTotal]       = useState(0)
  const [chatDateIndex, setChatDateIndex] = useState<DateIndex | null>(null)
  const [threads, setThreads]           = useState<Thread[]>([])
  const [initialized, setInitialized]   = useState(false)

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [hideImages, setHideImages]         = useState(false)
  const [showMediaPane, setShowMediaPane]   = useState(false)
  const [enabledTypes, setEnabledTypes]     = useState<Set<ContentTypeKey>>(DEFAULT_ENABLED)
  const [showViewSettings, setShowViewSettings] = useState(false)
  const [mediaCounts, setMediaCounts]       = useState<Record<string, number>>({})
  const [currentUser, setCurrentUser]       = useState('')
  const [isSuperAdmin, setIsSuperAdmin]     = useState(false)
  const [showHidden, setShowHidden]         = useState(false)
  const [lightbox, setLightbox]             = useState<LightboxState | null>(null)
  const [galleryCtxMenu, setGalleryCtxMenu] = useState<ContextMenuState | null>(null)

  // ─── Refs ─────────────────────────────────────────────────────────────────────
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const jumpFnRef     = useRef<JumpFn | null>(null)
  // Queued when jump is requested before ChatDetailPane has registered (section/thread remount)
  const pendingJumpRef = useRef<{ ts: number; msgId: string | null } | null>(null)

  // ─── Jump ─────────────────────────────────────────────────────────────────────

  const registerJump = useCallback((fn: JumpFn | null) => {
    jumpFnRef.current = fn
    if (fn && pendingJumpRef.current) {
      const { ts, msgId } = pendingJumpRef.current
      pendingJumpRef.current = null
      void fn(ts, msgId)
    }
  }, [])

  const jumpToMessage = useCallback(async (ts: number, msgId: string | null, thread?: string): Promise<void> => {
    const targetThread = thread && thread !== activeThread ? thread : null
    if (targetThread) setActiveThread(targetThread)

    // Put msg in the URL before switching section so a remounted ChatDetailPane can restore it
    if (msgId) {
      const params = new URLSearchParams(window.location.search)
      params.set('msg', msgId)
      params.delete('s')
      const t = targetThread ?? activeThread
      if (t) params.set('thread', t)
      window.history.replaceState(null, '', `?${params}`)
    }

    // Queue when chat isn't visible yet (CSS `hidden` breaks scrollIntoView) or pane will remount
    const mustQueue = section !== 'chat' || !!targetThread || !jumpFnRef.current
    if (mustQueue) pendingJumpRef.current = { ts, msgId }
    else pendingJumpRef.current = null

    setSection('chat')
    setChatDetailOpen(true)

    if (mustQueue) return
    await jumpFnRef.current!(ts, msgId)
  }, [activeThread, section])

  const jumpToDate = useCallback((ts: number) => {
    jumpToMessage(ts, null)
  }, [jumpToMessage])

  // Flush queued jump once chat is the active section (pane visible + jump fn registered)
  useEffect(() => {
    if (section !== 'chat' || !jumpFnRef.current || !pendingJumpRef.current) return
    const { ts, msgId } = pendingJumpRef.current
    pendingJumpRef.current = null
    void jumpFnRef.current(ts, msgId)
  }, [section, activeThread])

  // Sync hideImages from localStorage after hydration
  useEffect(() => {
    setHideImages(localStorage.getItem('hideImages') === '1')
  }, [])

  useViewerUrlSync({
    section, setSection,
    activeThread, setActiveThread,
    chatDetailOpen, setChatDetailOpen,
  })

  useViewerInit({
    activeThread,
    showMediaPane,
    setCurrentUser,
    setIsSuperAdmin,
    setShowHidden,
    setThreadMeta,
    setDbHiddenItems,
    setHashtags,
    setEnabledTypes,
    setInitialized,
    setThreads,
    setActiveThread,
    setMediaCounts,
  })

  // ─── Context menu (gallery only) ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const { x, y, uri } = (e as CustomEvent).detail
      setGalleryCtxMenu({ x, y, kind: 'media', mediaUri: uri })
    }
    window.addEventListener('media-ctx', handler)
    return () => window.removeEventListener('media-ctx', handler)
  }, [])

  const handleGalleryContextMenu = useCallback((e: React.MouseEvent, item: GalleryItem) => {
    e.preventDefault()
    setGalleryCtxMenu({ x: e.clientX, y: e.clientY, kind: 'gallery', galTs: String(item.ts), galMsgId: item.msgId ?? null, mediaUri: item.uri })
  }, [])

  // ─── Content type settings ───────────────────────────────────────────────────

  const handleContentTypeChange = useCallback((key: ContentTypeKey, enabled: boolean) => {
    setEnabledTypes(prev => {
      const next = new Set(prev)
      if (enabled) next.add(key)
      else next.delete(key)
      fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatContentTypes: [...next] }),
      }).catch(() => toast('Failed to save view settings'))
      return next
    })
  }, [])

  const handleResetContentTypes = useCallback(() => {
    const next = new Set<ContentTypeKey>(ALL_CONTENT_TYPE_KEYS)
    setEnabledTypes(next)
    fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatContentTypes: [...next] }),
    }).catch(() => toast('Failed to save view settings'))
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────────

  const initials = currentUser
    ? currentUser.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
    : ''

  const sectionTitle = section === 'chat' ? 'Chat' : section === 'settings' ? 'Settings' : section === 'story' ? 'Story' : activeHashtagName ? `#${activeHashtagName}` : 'Hashtags'

  const threadItems = useMemo<ListPaneItem[]>(() => threads.map(t => ({
    id: t.id, label: t.name, initials: t.initials, color: t.color,
    subtitle: threadMeta[t.id]?.subtitle, badge: threadMeta[t.id]?.badge,
  })), [threads, threadMeta])

  const hashtagItems = useMemo<ListPaneItem[]>(() => hashtags.map(h => ({
    id: h.id,
    label: `#${h.name}`,
    isPrivate: h.isPrivate,
    author: h.createdBy ?? undefined,
  })), [hashtags])

  function renderDetailPane(controls: AppLayoutControls) {
    const thread = threads.find(t => t.id === activeThread)
    const backFn = section === 'settings'
      ? () => { setSection(prevSection); controls.onShowList() }
      : section === 'hashtags' && activeHashtagName
        ? () => { hashtagActionsRef.current?.back(); controls.onShowList() }
        : section === 'hashtags' && hashtagCreating
        ? () => { setHashtagCreating(false); controls.onShowList() }
        : () => { setChatDetailOpen(false); controls.onShowList() }

    // ── Title ──────────────────────────────────────────────────────────────────
    const activeHashtag = hashtags.find(h => h.name === activeHashtagName)

    const title =
      section === 'chat' && thread ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <ThreadAvatar color={thread.color} initials={thread.initials} />
          <span className="text-sm font-bold truncate">{thread.name}</span>
        </div>
      ) : section === 'hashtags' && activeHashtagName ? (
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
              if (e.key === 'Escape') setEditingHashtagTitle(false)
            }}
            onBlur={async () => {
              const name = hashtagTitleInput.trim()
              if (name) { await hashtagActionsRef.current?.rename?.(name); setActiveHashtagName(name) }
              setEditingHashtagTitle(false)
            }}
            className="text-sm font-bold bg-transparent border-b border-mist-300 dark:border-mist-600 outline-hidden text-gray-900 dark:text-white w-40"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => { setHashtagTitleInput(activeHashtagName); setEditingHashtagTitle(true) }}
              className="text-sm font-bold hover:underline decoration-mist-400 flex items-center gap-1 group truncate"
            >
              {sectionTitle}
              <svg className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            {activeHashtag?.isPrivate && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <LockIcon size={10} /> Private
              </span>
            )}
          </div>
        )
      ) : (
        <span className={`text-sm font-bold ${section === 'story' ? 'font-display text-base font-medium' : ''}`}>{section === 'hashtags' && hashtagCreating ? 'Create New Hashtag' : sectionTitle}</span>
      )

    // ── Actions ────────────────────────────────────────────────────────────────
    const actions =
      section === 'chat' && thread ? (
        <>
          <div className="relative">
            <button onClick={() => setShowHashtagMenu(v => !v)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-mist-100 dark:hover:bg-mist-800 text-gray-500 dark:text-mist-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            {showHashtagMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowHashtagMenu(false)} />
                <div className={`absolute right-0 top-full mt-1 ${menu}`}>
                  <button onClick={() => { setShowViewSettings(true); setShowHashtagMenu(false) }} className={menuItem}>View settings</button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowMediaPane(v => !v)}
            title="Media"
            aria-label="Media"
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showMediaPane ? 'bg-mist-100 dark:bg-mist-800 text-gray-900 dark:text-white' : 'hover:bg-mist-100 dark:hover:bg-mist-800 text-gray-500 dark:text-mist-300'}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </>
      ) : section === 'hashtags' && activeHashtagName ? (
        <div className="relative">
          <button onClick={() => setShowHashtagMenu(v => !v)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-mist-100 dark:hover:bg-mist-800 text-gray-500 dark:text-mist-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          {showHashtagMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowHashtagMenu(false)} />
              <div className={`absolute right-0 top-full mt-1 ${menu}`}>
                {isSuperAdmin && activeHashtag && (
                  <button
                    onClick={async () => {
                      await fetch(`/api/hashtags/${activeHashtag.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPrivate: !activeHashtag.isPrivate }) })
                      await reloadHashtags()
                      setShowHashtagMenu(false)
                    }}
                    className={`${menuItem} inline-flex items-center gap-2`}
                  >
                    {activeHashtag.isPrivate
                      ? <><GlobeIcon size={12} /> Make Public</>
                      : <><LockIcon size={12} /> Make Private</>}
                  </button>
                )}
                {activeHashtag && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?s=hashtags&h=${activeHashtag.id}&tab=${hashtagActiveTab}`
                      navigator.clipboard.writeText(url)
                      setShowHashtagMenu(false)
                    }}
                    className={menuItem}
                  >Copy link</button>
                )}
                <button onClick={() => { hashtagActionsRef.current?.delete(); setShowHashtagMenu(false) }} className={`${menuItem} text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}>Delete</button>
              </div>
            </>
          )}
        </div>
      ) : null

    // ── Search ─────────────────────────────────────────────────────────────────
    const search = section === 'chat' ? (
      <input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search messages…"
        className="px-3.5 py-1.5 rounded-full bg-mist-100 dark:bg-mist-800 text-gray-700 dark:text-mist-100 text-[13px] outline-hidden placeholder:text-mist-400 focus:bg-mist-200 dark:focus:bg-mist-700 w-full" />
    ) : section === 'hashtags' && activeHashtagName && hashtagActiveTab === 'messages' ? (
      <input type="search" value={hashtagMsgFilter} onChange={e => setHashtagMsgFilter(e.target.value)} placeholder="Search messages…"
        className="px-3.5 py-1.5 rounded-full bg-mist-100 dark:bg-mist-800 text-gray-700 dark:text-mist-100 text-[13px] outline-hidden placeholder:text-mist-400 focus:bg-mist-200 dark:focus:bg-mist-700 w-full" />
    ) : null

    return (
      <>
        {((section === 'chat' && chatDetailOpen) || (section === 'hashtags' && (!!activeHashtagName || hashtagCreating)) || section === 'settings') && (
          <AppHeader
            title={title}
            onBack={backFn}
            actions={actions}
            search={search}
            scrollContainerRef={chatScrollRef}
          />
        )}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden [animation:fade-up_220ms_ease-out]">

          {/* Chat — empty state on desktop until thread is opened */}
          {section === 'chat' && !chatDetailOpen && (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-mist-100 dark:bg-mist-800 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400 dark:text-mist-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p className="text-sm text-mist-400 dark:text-mist-500">Select a conversation</p>
            </div>
          )}

          {/* Chat section */}
          <div className={`flex-1 flex flex-col min-h-0 relative${section !== 'chat' ? ' hidden' : !chatDetailOpen ? ' md:hidden' : ''}`}>
            {activeThread && <ChatDetailPane
              key={activeThread}
              search={searchInput}
              onSearchChange={setSearchInput}
              scrollRef={chatScrollRef}
              hashtags={hashtags}
              onReloadHashtags={reloadHashtags}
              currentUser={currentUser}
              isSuperAdmin={isSuperAdmin}
              showHidden={showHidden}
              hideImages={hideImages}
              hiddenUris={allHiddenUris}
              hiddenMsgIds={dbHiddenMsgIds}
              onHideUri={hideUri}
              onHideDbUri={handleHideDbUri}
              onUnhideDbUri={handleUnhideDbUri}
              onHideMessage={handleHideMessage}
              onUnhideMessage={handleUnhideMessage}
              onLightbox={setLightbox}
              onRegisterJump={registerJump}
              onStatsChange={(total, dateIndex) => { setChatTotal(total); setChatDateIndex(dateIndex) }}
              enabledTypes={enabledTypes}
              senderColor={thread?.color}
              thread={thread?.collection ?? activeThread}
            />}
          </div>

          {/* Hashtags — empty state on desktop when none selected */}
          {section === 'hashtags' && !activeHashtagName && !hashtagCreating && (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-mist-100 dark:bg-mist-800 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400 dark:text-mist-500"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
              </div>
              <p className="text-sm text-mist-400 dark:text-mist-500">Select a hashtag</p>
            </div>
          )}

          {/* Hashtags section — always mounted, hidden when not active */}
          <div className={`flex-1 flex flex-col min-h-0${section !== 'hashtags' ? ' hidden' : (!activeHashtagName && !hashtagCreating) ? ' md:hidden' : ''}`}>
            <HashtagsPane
              hashtags={hashtags}
              thread={activeThread}
              onReload={reloadHashtags}
              onJumpToMessage={jumpToMessage}
              filter={hashtagFilter}
              onFilterChange={setHashtagFilter}
              creating={hashtagCreating}
              onCreatingChange={setHashtagCreating}
              onActiveHashtagChange={selectActiveHashtag}
              onActionsChange={a => { hashtagActionsRef.current = a }}
              activeTab={hashtagActiveTab}
              onActiveTabChange={setHashtagActiveTab}
              msgFilter={hashtagMsgFilter}
              onMsgFilterChange={setHashtagMsgFilter}
              onNavigateBack={controls.onShowList}
              pendingSelect={pendingHashtag}
              isSuperAdmin={isSuperAdmin}
              hideImages={hideImages}
              hiddenUris={allHiddenUris}
              hiddenMsgIds={dbHiddenMsgIds}
              onHideMessage={handleHideMessage}
              onUnhideMessage={handleUnhideMessage}
              onHideUri={handleHideDbUri}
              onUnhideUri={handleUnhideDbUri}
            />
          </div>

          {/* Story section */}
          {section === 'story' && (
            <StoryPane onJumpToMessages={jumpToDate} />
          )}

          {/* Settings section */}
          {section === 'settings' && (
            <SettingsPane
              total={chatTotal}
              dateIndex={chatDateIndex}
              currentUser={currentUser}
              isSuperAdmin={isSuperAdmin}
              showHidden={showHidden}
              onToggleShowHidden={() => setShowHidden(v => {
                const next = !v
                localStorage.setItem('showHidden', next ? '1' : '0')
                return next
              })}
              hiddenUriCount={hiddenUris.size}
              onClearHiddenUris={clearHiddenUris}
            />
          )}

          </div>{/* end section content */}
      </>
    )
  }

  if (!initialized) {
    return (
      <div className="md:p-3 font-sans bg-mist-50 dark:bg-mist-950 flex flex-col overflow-hidden" style={{ height: '100%' }}>
        <AppLayout
          section="chat"
          onSectionChange={() => {}}
          initials=""
          detailGrow={12}
          listGrow={4}
          listPane={() => <ListPaneSkeleton />}
          detailPane={() => <ChatDetailSkeleton />}
        />
      </div>
    )
  }

  return (
    <div className="md:p-3 font-sans bg-mist-50 dark:bg-mist-950 flex flex-col overflow-hidden" style={{ height: '100%' }}>
      <InAppBrowserBanner />
      <Toaster />
      <AppLayout
        section={section}
        onSectionChange={s => {
          if (s === 'settings') setPrevSection(section === 'settings' ? prevSection : section as 'chat' | 'hashtags' | 'story')
          setSection(s)
        }}
        initials={initials}
        name={currentUser ?? undefined}
        prevSection={prevSection}
        detailGrow={section === 'settings' ? 4 : section === 'story' || section === 'hashtags' || !showMediaPane ? 12 : 7}
        listGrow={section === 'settings' ? 4 : 4}
        hideListPane={section === 'story'}
        centeredDetail={section === 'settings'}
        listPane={controls => section === 'hashtags' ? (
          <ListPane
            title="Hashtags"
            items={hashtagItems}
            activeId={hashtags.find(h => h.name === activeHashtagName)?.id ?? null}
            filter={hashtagFilter}
            onFilterChange={setHashtagFilter}
            filterPlaceholder="Filter hashtags"
            onNew={() => { setHashtagCreating(true); controls.onShowDetail() }}
            onSelect={id => { const h = hashtags.find(h => h.id === id); if (h) { setPendingHashtag(h); controls.onShowDetail(); setTimeout(() => setPendingHashtag(null), 100) } }}
            emptyMessage="No hashtags yet."
          />
        ) : (
          <ListPane
            title="Chats"
            items={threadItems}
            activeId={chatDetailOpen ? activeThread : null}
            filter={threadFilter}
            onFilterChange={setThreadFilter}
            filterPlaceholder="Search Messenger"
            onSelect={id => { setActiveThread(id); setChatDetailOpen(true); controls.onShowDetail() }}
          />
        )}
        detailPane={renderDetailPane}
        mediaPane={section === 'chat' && showMediaPane ? (
          <MediaPane
            key={activeThread}
            thread={activeThread}
            threadName={threads.find(t => t.id === activeThread)?.name}
            threadCollection={activeThread}
            participants={threads.find(t => t.id === activeThread)?.participants}
            counts={mediaCounts}
            onLightbox={setLightbox}
            onContextMenu={handleGalleryContextMenu}
            hideImages={hideImages}
            hiddenUris={allHiddenUris}
            isSuperAdmin={isSuperAdmin}
            onHideUri={handleHideDbUri}
            onUnhideUri={handleUnhideDbUri}
            onThreadDeleted={collection => {
              setThreads(prev => prev.filter(t => t.collection !== collection))
              setActiveThread(prev => prev === collection ? (threads.find(t => t.collection !== collection)?.id ?? 'messages') : prev)
              setShowMediaPane(false)
            }}
            onClose={() => setShowMediaPane(false)}
          />
        ) : undefined}
      />

      {/* View settings modal */}
      {showViewSettings && (
        <ChatViewSettingsModal
          enabledTypes={enabledTypes}
          onChange={handleContentTypeChange}
          onReset={handleResetContentTypes}
          onClose={() => setShowViewSettings(false)}
        />
      )}

      {/* Overlays */}
      {lightbox && <Lightbox state={lightbox}
        onClose={() => {
          const { ts, msgId } = lightbox
          setLightbox(null)
          if (section === 'chat' && msgId && !document.getElementById('msg-' + msgId)) jumpToMessage(Number(ts), msgId)
        }}
        onJumpToMessage={(ts, msgId) => { setLightbox(null); jumpToMessage(ts, msgId) }}
      />}
      {galleryCtxMenu && galleryCtxMenu.fromTouch ? (
        <ActionSheet
          onClose={() => setGalleryCtxMenu(null)}
          actions={[
            ...(galleryCtxMenu.galMsgId ? [{ label: 'Go to message', onPress: () => { jumpToMessage(Number(galleryCtxMenu.galTs), galleryCtxMenu.galMsgId!); setGalleryCtxMenu(null) } }] : []),
            ...(galleryCtxMenu.mediaUri ? [
              allHiddenUris.has(galleryCtxMenu.mediaUri)
                ? { label: 'Unhide', onPress: () => { handleUnhideDbUri(galleryCtxMenu.mediaUri!); setGalleryCtxMenu(null) } }
                : { label: 'Hide', destructive: true, onPress: () => { handleHideDbUri(galleryCtxMenu.mediaUri!); setGalleryCtxMenu(null) } }
            ] : []),
          ]}
        />
      ) : galleryCtxMenu ? (
        <ContextMenu
          state={galleryCtxMenu}
          onClose={() => setGalleryCtxMenu(null)}
          onJumpToMessage={(ts, msgId) => { jumpToMessage(+ts, msgId); setGalleryCtxMenu(null) }}
          onHideUri={hideUri}
          onCopyLink={() => {}}
          onCopyText={() => {}}
        />
      ) : null}
    </div>
  )
}
