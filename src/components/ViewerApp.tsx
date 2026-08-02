'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Section, Thread, LightboxState, ContextMenuState, GalleryItem } from '@/types'
import { toast } from '@/lib/toast'
import { ContentTypeKey, ALL_CONTENT_TYPE_KEYS, DEFAULT_ENABLED } from '@/lib/contentTypes'
import { useHashtagPaneState } from '@/hooks/useHashtagPaneState'
import { useHiddenState } from '@/hooks/useHiddenState'
import { useHiddenSync } from '@/hooks/useHiddenSync'
import { useViewerUrlSync } from '@/hooks/useViewerUrlSync'
import { useViewerInit } from '@/hooks/useViewerInit'
import ContextMenu from './ContextMenu'
import ActionSheet from './ActionSheet'
import AppHeader from './AppHeader'
import AppLayout, { AppLayoutControls } from './AppLayout'
import ListPane, { ListPaneItem } from './ListPane'
import ChatDetailPane, { JumpFn } from './ChatDetailPane'
import InAppBrowserBanner from './InAppBrowserBanner'
import Toaster from './Toaster'
import TagMessagesPane from './TagMessagesPane'
import { LockIcon } from '@/components/icons'
import { ListPaneSkeleton, ChatDetailSkeleton } from '@/components/skeletons'
import AvatarGroup from '@/components/AvatarGroup'
import { defaultThreadName, participantAvatars } from '@/lib/threadDisplay'
import { headerBtn, headerBtnActive } from '@/lib/ui'
import { createArchiveLightboxOpener } from '@/lib/lightboxArchive'

type ThreadSideView = 'details' | 'media' | 'tag' | null

const HashtagsPane = dynamic(() => import('./HashtagsPane'), { ssr: false })
const StoryPane    = dynamic(() => import('./story/StoryPane'),    { ssr: false })
const SettingsPane = dynamic(() => import('./settings/SettingsPane'), { ssr: false })
const ThreadDetailsPane = dynamic(() => import('./ThreadDetailsPane'), { ssr: false })
const HashtagDetailsPane = dynamic(() => import('./HashtagDetailsPane'), { ssr: false })
const MediaPane = dynamic(() => import('./MediaPane'), { ssr: false })
const Lightbox     = dynamic(() => import('./Lightbox'), { ssr: false })

export default function ViewerApp() {
  // Navigation — SSR-safe defaults; URL restored in useViewerUrlSync after mount
  const [section, setSection]         = useState<Section>('chat')
  const [prevSection, setPrevSection] = useState<'chat' | 'hashtags' | 'story'>('chat')
  // ─── Hidden state ────────────────────────────────────────────────────────────
  const {
    hiddenUris, setDbHiddenItems,
    effectiveHiddenMsgIds, allHiddenUris,
    applyHiddenSnapshot,
    hideUri, handleHideMessage, handleUnhideMessage,
    handleHideDbUri, handleUnhideDbUri, clearHiddenUris,
  } = useHiddenState()

  useHiddenSync({ onSnapshot: applyHiddenSnapshot })

  // ─── Hashtag pane state ───────────────────────────────────────────────────────
  const {
    hashtags, hashtagFilter, setHashtagFilter,
    hashtagCreating, setHashtagCreating,
    pendingHashtag, setPendingHashtag,
    activeHashtagName, setActiveHashtagName,
    hashtagActiveTab, setHashtagActiveTab,
    hashtagMsgFilter, setHashtagMsgFilter,
    pendingUrlHashtagId,
    hashtagRestoreDone,
    resolveUrlHashtag,
    hashtagActionsRef,
    reloadHashtags, selectActiveHashtag,
    setHashtags,
  } = useHashtagPaneState()

  // ─── Chat / thread state ──────────────────────────────────────────────────────
  const [searchInput, setSearchInput]   = useState('')
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [hashtagSearchOpen, setHashtagSearchOpen] = useState(false)
  const [activeThread, setActiveThread] = useState('')
  const [chatDetailOpen, setChatDetailOpen] = useState(false)
  const [threadFilter, setThreadFilter] = useState('')
  const [threadMeta, setThreadMeta]     = useState<Record<string, { subtitle: string; badge: string }>>({})
  const [threads, setThreads]           = useState<Thread[]>([])
  const [initialized, setInitialized]   = useState(false)

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [hideImages, setHideImages]         = useState(false)
  const [threadSideView, setThreadSideView] = useState<ThreadSideView>(null)
  const [tagMsgIds, setTagMsgIds] = useState<string[] | null>(null)
  const clearChatSelectionRef = useRef<(() => void) | null>(null)
  const [hashtagSideView, setHashtagSideView] = useState(false)
  /** Large desktop (≥1280): inline 4/7/5 three-pane when side view is open. */
  const [largeDesktop, setLargeDesktop] = useState(false)
  const [enabledTypes, setEnabledTypes]     = useState<Set<ContentTypeKey>>(DEFAULT_ENABLED)
  const [mediaCounts, setMediaCounts]       = useState<Record<string, number>>({})
  const [currentUser, setCurrentUser]       = useState('')
  const [isSuperAdmin, setIsSuperAdmin]     = useState(false)
  const [showHidden, setShowHidden]         = useState(false)
  const [lightbox, setLightbox]             = useState<LightboxState | null>(null)
  const [galleryCtxMenu, setGalleryCtxMenu] = useState<ContextMenuState | null>(null)

  // ─── Refs ─────────────────────────────────────────────────────────────────────
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatSearchRef = useRef<HTMLInputElement>(null)
  const hashtagSearchRef = useRef<HTMLInputElement>(null)
  const jumpFnRef     = useRef<JumpFn | null>(null)
  // Queued when jump is requested before ChatDetailPane has registered (section/thread remount)
  const pendingJumpRef = useRef<{ ts: number; msgId: string | null } | null>(null)
  const layoutControlsRef = useRef<AppLayoutControls | null>(null)

  const closeThreadSideView = useCallback(() => {
    setThreadSideView(null)
    setTagMsgIds(null)
  }, [])

  const mediaThread = useMemo(() => {
    const t = threads.find(th => th.id === activeThread)
    return (t?.collection ?? activeThread) || 'messages'
  }, [threads, activeThread])

  const withMediaThread = useCallback((url: string) => (
    `${url}${url.includes('?') ? '&' : '?'}thread=${mediaThread}`
  ), [mediaThread])

  const openArchiveLightbox = useMemo(
    () => createArchiveLightboxOpener(withMediaThread, setLightbox),
    [withMediaThread],
  )

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
      params.set('s', 'chat')
      params.set('msg', msgId)
      params.delete('h')
      params.delete('tab')
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

  /**
   * Explicit "go to message". Unlike {@link jumpToMessage} — which also runs as a
   * background sync when the lightbox closes — this lands the user on the message
   * pane, so it dismisses the overlays and searches that would otherwise cover it.
   */
  const goToMessage = useCallback(async (ts: number, msgId: string | null, thread?: string): Promise<void> => {
    setLightbox(null)
    closeThreadSideView()
    setChatSearchOpen(false)
    setSearchInput('')
    setHashtagSearchOpen(false)
    setHashtagMsgFilter('')
    // Same as thread list select — detail must be interactive after landing on a message
    layoutControlsRef.current?.onShowDetail()
    await jumpToMessage(ts, msgId, thread)
  }, [jumpToMessage, closeThreadSideView, setHashtagSearchOpen, setHashtagMsgFilter])

  const jumpToDate = useCallback((ts: number) => {
    goToMessage(ts, null)
  }, [goToMessage])

  const exitChatSearch = useCallback(() => setChatSearchOpen(false), [])

  // Flush queued jump once chat is the active section (pane visible + jump fn registered)
  useEffect(() => {
    if (section !== 'chat' || !jumpFnRef.current || !pendingJumpRef.current) return
    const { ts, msgId } = pendingJumpRef.current
    pendingJumpRef.current = null
    void jumpFnRef.current(ts, msgId)
  }, [section, activeThread])

  useViewerUrlSync({
    section, setSection,
    activeThread, setActiveThread,
    chatDetailOpen, setChatDetailOpen,
    hashtagId: section === 'hashtags'
      ? (hashtags.find(h => h.name === activeHashtagName)?.id ?? pendingUrlHashtagId)
      : null,
    hashtagTab: hashtagActiveTab,
    hashtagRestoreDone,
  })

  useViewerInit({
    activeThread,
    mediaPaneOpen: threadSideView === 'media',
    setCurrentUser,
    setIsSuperAdmin,
    setShowHidden,
    setHideImages,
    setThreadMeta,
    setDbHiddenItems,
    setHashtags,
    setEnabledTypes,
    setInitialized,
    setThreads,
    setActiveThread,
    setMediaCounts,
  })

  // Close 3rd pane when leaving chat/hashtag detail or switching selection
  useEffect(() => {
    setThreadSideView(null)
    setTagMsgIds(null)
  }, [activeThread, section])

  const openTagPane = useCallback((msgIds: string[]) => {
    if (!msgIds.length) return
    setTagMsgIds(msgIds)
    setThreadSideView('tag')
  }, [])
  useEffect(() => {
    setHashtagSideView(false)
  }, [activeHashtagName, section])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const sync = () => setLargeDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Reset hashtag search when leaving the hashtag detail
  useEffect(() => {
    setHashtagSearchOpen(false)
    setHashtagMsgFilter('')
  }, [activeHashtagName, section, setHashtagMsgFilter])

  const patchUserSettings = useCallback((body: Record<string, unknown>) => {
    fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => toast('Failed to save view settings'))
  }, [])

  const handleHideImagesChange = useCallback((v: boolean) => {
    setHideImages(v)
    patchUserSettings({ hideImages: v })
  }, [patchUserSettings])

  const handleToggleShowHidden = useCallback(() => {
    setShowHidden(v => {
      const next = !v
      patchUserSettings({ showHidden: next })
      return next
    })
  }, [patchUserSettings])

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
    const fromTouch = !!(e as unknown as { _fromTouch?: boolean })._fromTouch
    if (!fromTouch) return
    setGalleryCtxMenu({ x: e.clientX, y: e.clientY, kind: 'gallery', galTs: String(item.ts), galMsgId: item.msgId ?? null, mediaUri: item.uri, fromTouch: true })
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

  const threadItems = useMemo<ListPaneItem[]>(() => threads.map(t => {
    const avatars = participantAvatars(t.participants)
    return {
      id: t.id,
      label: (t.name || '').trim() || defaultThreadName(t.participants ?? []),
      avatars,
      subtitle: threadMeta[t.id]?.subtitle,
      badge: threadMeta[t.id]?.badge,
    }
  }), [threads, threadMeta])

  const hashtagItems = useMemo<ListPaneItem[]>(() => hashtags.map(h => ({
    id: h.id,
    label: `#${h.name}`,
    isPrivate: h.isPrivate,
    author: h.createdBy ?? undefined,
  })), [hashtags])

  const activeHashtag = hashtags.find(h => h.name === activeHashtagName)

  function renderDetailPane(controls: AppLayoutControls) {
    layoutControlsRef.current = controls
    const thread = threads.find(t => t.id === activeThread)
    const senderStyles: Record<string, { initials: string; color: string }> = {}
    for (const p of thread?.participants ?? []) {
      senderStyles[p.name] = { initials: p.initials, color: p.color }
    }
    const backFn = section === 'settings'
      ? () => { setSection(prevSection); controls.onShowList() }
      : section === 'hashtags' && activeHashtagName
        ? () => { hashtagActionsRef.current?.back(); controls.onShowList() }
        : section === 'hashtags' && hashtagCreating
        ? () => { setHashtagCreating(false); controls.onShowList() }
        : () => { setChatDetailOpen(false); controls.onShowList() }

    // ── Title ──────────────────────────────────────────────────────────────────

    const title =
      section === 'chat' && thread ? (
        <span className="flex items-center justify-center gap-2 min-w-0 max-w-full">
          <AvatarGroup people={participantAvatars(thread.participants)} size="sm" layout="row" />
          <span className="text-sm font-bold truncate">
            {(thread.name || '').trim() || defaultThreadName(thread.participants ?? [])}
          </span>
        </span>
      ) : section === 'hashtags' && activeHashtagName ? (
        <span className="inline-flex items-center justify-center gap-1.5 min-w-0 max-w-full text-sm font-bold">
          {activeHashtag?.isPrivate && (
            <LockIcon size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <span className="truncate">{sectionTitle}</span>
        </span>
      ) : (
        <span className={`text-sm font-bold ${section === 'story' ? 'font-display text-base font-medium' : ''}`}>{section === 'hashtags' && hashtagCreating ? 'Create New Hashtag' : sectionTitle}</span>
      )

    // ── Actions ────────────────────────────────────────────────────────────────
    const openChatSearch = () => {
      closeThreadSideView()
      setChatSearchOpen(true)
      requestAnimationFrame(() => chatSearchRef.current?.focus())
    }
    const closeChatSearch = () => {
      setChatSearchOpen(false)
      setSearchInput('')
    }
    const openHashtagSearch = () => {
      setHashtagSideView(false)
      setHashtagActiveTab('messages')
      setHashtagSearchOpen(true)
      requestAnimationFrame(() => hashtagSearchRef.current?.focus())
    }
    const closeHashtagSearch = () => {
      setHashtagSearchOpen(false)
      setHashtagMsgFilter('')
    }

    const chatSearching = section === 'chat' && chatSearchOpen
    const hashtagSearching = section === 'hashtags' && hashtagSearchOpen
    const headerSearching = chatSearching || hashtagSearching

    const iconBtn = headerBtn
    const searchIcon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    )
    const infoIcon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    )

    const actions =
      section === 'chat' && thread && !chatSearching ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openChatSearch}
            title="Search"
            aria-label="Search"
            className={iconBtn}
          >
            {searchIcon}
          </button>
          <button
            type="button"
            onClick={() => {
              if (threadSideView === 'details') closeThreadSideView()
              else {
                setTagMsgIds(null)
                setThreadSideView('details')
              }
            }}
            title="Settings"
            aria-label="Settings"
            className={threadSideView ? headerBtnActive : iconBtn}
          >
            {infoIcon}
          </button>
        </div>
      ) : section === 'hashtags' && activeHashtagName && !hashtagSearching ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openHashtagSearch}
            title="Search"
            aria-label="Search"
            className={iconBtn}
          >
            {searchIcon}
          </button>
          <button
            type="button"
            onClick={() => setHashtagSideView(v => !v)}
            title="Settings"
            aria-label="Settings"
            className={hashtagSideView ? headerBtnActive : iconBtn}
          >
            {infoIcon}
          </button>
        </div>
      ) : null

    // ── Search ─────────────────────────────────────────────────────────────────
    const searchFieldCls = 'liquid-glass-field'
    const search = chatSearching ? (
      <input
        ref={chatSearchRef}
        type="search"
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') closeChatSearch() }}
        placeholder="Search messages…"
        className={searchFieldCls}
      />
    ) : hashtagSearching ? (
      <input
        ref={hashtagSearchRef}
        type="search"
        value={hashtagMsgFilter}
        onChange={e => setHashtagMsgFilter(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') closeHashtagSearch() }}
        placeholder="Search messages…"
        className={searchFieldCls}
      />
    ) : null

    return (
      <>
        {((section === 'chat' && chatDetailOpen) || (section === 'hashtags' && (!!activeHashtagName || hashtagCreating))) && (
          <AppHeader
            title={title}
            onBack={chatSearching ? closeChatSearch : hashtagSearching ? closeHashtagSearch : backFn}
            actions={actions}
            search={search}
            searchMode={headerSearching}
          />
        )}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden [animation:fade-up_220ms_ease-out]">

          {/* Chat — empty state on desktop until thread is opened */}
          {section === 'chat' && !chatDetailOpen && (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full liquid-glass flex items-center justify-center">
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
              searchActive={chatSearchOpen}
              onSearchChange={setSearchInput}
              onExitSearch={exitChatSearch}
              scrollRef={chatScrollRef}
              currentUser={currentUser}
              isSuperAdmin={isSuperAdmin}
              showHidden={showHidden}
              hideImages={hideImages}
              hiddenUris={allHiddenUris}
              hiddenMsgIds={effectiveHiddenMsgIds}
              onHideUri={hideUri}
              onHideDbUri={handleHideDbUri}
              onUnhideDbUri={handleUnhideDbUri}
              onHideMessage={handleHideMessage}
              onUnhideMessage={handleUnhideMessage}
              onLightbox={setLightbox}
              onRegisterJump={registerJump}
              enabledTypes={enabledTypes}
              senderStyles={senderStyles}
              participants={thread?.participants ?? []}
              thread={thread?.collection ?? activeThread}
              onOpenTag={openTagPane}
              onRegisterClearSelection={fn => { clearChatSelectionRef.current = fn }}
            />}
          </div>

          {/* Hashtags — empty state on desktop when none selected */}
          {section === 'hashtags' && !activeHashtagName && !hashtagCreating && (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full liquid-glass flex items-center justify-center">
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
              onJumpToMessage={goToMessage}
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
              pendingUrlHashtagId={pendingUrlHashtagId}
              onResolveUrlHashtag={resolveUrlHashtag}
              isSuperAdmin={isSuperAdmin}
              hideImages={hideImages}
              hiddenUris={allHiddenUris}
              hiddenMsgIds={effectiveHiddenMsgIds}
              onHideMessage={handleHideMessage}
              onUnhideMessage={handleUnhideMessage}
              onHideUri={handleHideDbUri}
              onUnhideUri={handleUnhideDbUri}
              senderStyles={senderStyles}
              enabledTypes={enabledTypes}
              showHidden={showHidden}
            />
          </div>

          {/* Story section */}
          {section === 'story' && (
            <StoryPane onJumpToMessages={jumpToDate} />
          )}

          {/* Settings section */}
          {section === 'settings' && (
            <SettingsPane
              showHidden={showHidden}
              onToggleShowHidden={handleToggleShowHidden}
              hiddenUriCount={hiddenUris.size}
              onClearHiddenUris={clearHiddenUris}
              thread={(thread?.collection ?? activeThread) || 'messages'}
              senderStyles={senderStyles}
              onUnhideMessage={handleUnhideMessage}
              onUnhideUri={handleUnhideDbUri}
              onJumpToMessage={(ts, msgId, t) => { void goToMessage(ts, msgId, t) }}
            />
          )}

          </div>{/* end section content */}
      </>
    )
  }

  if (!initialized) {
    return (
      <div className="md:p-3 font-sans bg-mist-50 dark:bg-mist-950 flex flex-col overflow-hidden" style={{ height: 'var(--resibo-shell-height)' }}>
        <AppLayout
          section="chat"
          onSectionChange={() => {}}
          initials=""
          detailGrow={8}
          listGrow={4}
          listPane={() => <ListPaneSkeleton />}
          detailPane={() => <ChatDetailSkeleton />}
        />
      </div>
    )
  }

  return (
    <div className="md:p-3 font-sans bg-mist-50 dark:bg-mist-950 flex flex-col overflow-hidden" style={{ height: 'var(--resibo-shell-height)' }}>
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
        detailGrow={
          section === 'settings' || section === 'story' ? 12
            : largeDesktop
              ? ((section === 'chat' && threadSideView) || (section === 'hashtags' && hashtagSideView) ? 7 : 12)
              : 8
        }
        listGrow={4}
        hideListPane={section === 'story' || section === 'settings'}
        onCloseMediaPane={() => {
          if (section === 'hashtags') setHashtagSideView(false)
          else closeThreadSideView()
        }}
        listPane={controls => {
          layoutControlsRef.current = controls
          return section === 'hashtags' ? (
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
              onNew={isSuperAdmin ? () => { window.location.assign('/upload') } : undefined}
              emptyMessage="No chats yet."
              onSelect={id => {
                setActiveThread(id)
                setChatDetailOpen(true)
                setChatSearchOpen(false)
                setSearchInput('')
                controls.onShowDetail()
              }}
            />
          )
        }}
        detailPane={renderDetailPane}
        mediaPane={(section === 'chat' && threadSideView && (() => {
          const t = threads.find(th => th.id === activeThread)
          if (!t) return undefined
          if (threadSideView === 'tag' && tagMsgIds) {
            return (
              <TagMessagesPane
                key={`tag-${activeThread}-${tagMsgIds.join(',')}`}
                hashtags={hashtags}
                thread={t.collection ?? activeThread}
                messageIds={tagMsgIds}
                messageCount={tagMsgIds.length}
                onClose={closeThreadSideView}
                onReloadHashtags={reloadHashtags}
                onApplied={() => {
                  clearChatSelectionRef.current?.()
                  closeThreadSideView()
                }}
              />
            )
          }
          if (threadSideView === 'details') {
            return (
              <ThreadDetailsPane
                key={`details-${activeThread}`}
                threadName={(t.name || '').trim() || defaultThreadName(t.participants ?? [])}
                threadCollection={t.collection ?? activeThread}
                participants={t.participants}
                enabledTypes={enabledTypes}
                onContentTypeChange={handleContentTypeChange}
                onResetContentTypes={handleResetContentTypes}
                hideImages={hideImages}
                onHideImagesChange={handleHideImagesChange}
                isSuperAdmin={isSuperAdmin}
                showHidden={showHidden}
                onToggleShowHidden={handleToggleShowHidden}
                onOpenMedia={() => { setTagMsgIds(null); setThreadSideView('media') }}
                onThreadDeleted={collection => {
                  setThreads(prev => prev.filter(th => th.collection !== collection))
                  setActiveThread(prev => prev === collection ? (threads.find(th => th.collection !== collection)?.id ?? 'messages') : prev)
                  closeThreadSideView()
                  setChatDetailOpen(false)
                }}
                onThreadUpdated={(collection, patch) => {
                  setThreads(prev => prev.map(th => {
                    if (th.collection !== collection && th.id !== collection) return th
                    return {
                      ...th,
                      ...(patch.name != null ? { name: patch.name } : {}),
                      ...(patch.participants != null ? { participants: patch.participants } : {}),
                    }
                  }))
                }}
              />
            )
          }
          if (threadSideView !== 'media') return undefined
          return (
            <MediaPane
              key={`media-${activeThread}`}
              thread={mediaThread}
              counts={mediaCounts}
              onLightbox={state => { void openArchiveLightbox(state) }}
              onContextMenu={handleGalleryContextMenu}
              hideImages={hideImages}
              hiddenUris={allHiddenUris}
              isSuperAdmin={isSuperAdmin}
              onHideUri={handleHideDbUri}
              onUnhideUri={handleUnhideDbUri}
              onGoToMessage={(ts, msgId) => { void goToMessage(ts, msgId) }}
              onBack={() => { setTagMsgIds(null); setThreadSideView('details') }}
            />
          )
        })()) || (section === 'hashtags' && hashtagSideView && activeHashtag && (
          <HashtagDetailsPane
            key={`hashtag-details-${activeHashtag.id}`}
            hashtag={activeHashtag}
            activeTab={hashtagActiveTab}
            isSuperAdmin={isSuperAdmin}
            onRenamed={name => {
              setActiveHashtagName(name)
              void reloadHashtags()
            }}
            onPrivacyChanged={() => { void reloadHashtags() }}
            onDeleted={() => {
              setHashtagSideView(false)
              void reloadHashtags()
              hashtagActionsRef.current?.back()
            }}
          />
        )) || undefined}
      />

      {/* Overlays */}
      {lightbox && <Lightbox state={lightbox}
        onClose={() => setLightbox(null)}
        onJumpToMessage={(ts, msgId) => { void goToMessage(ts, msgId) }}
        isSuperAdmin={isSuperAdmin}
        isHidden={!!(lightbox.uri && allHiddenUris.has(lightbox.uri))}
        onHide={handleHideDbUri}
        onUnhide={handleUnhideDbUri}
      />}
      {galleryCtxMenu && galleryCtxMenu.fromTouch ? (
        <ActionSheet
          onClose={() => setGalleryCtxMenu(null)}
          actions={[
            ...(galleryCtxMenu.kind === 'gallery' && galleryCtxMenu.galMsgId ? [{ label: 'Go to message', onPress: () => { void goToMessage(Number(galleryCtxMenu.galTs), galleryCtxMenu.galMsgId!); setGalleryCtxMenu(null) } }] : []),
            ...(galleryCtxMenu.mediaUri && isSuperAdmin ? [
              allHiddenUris.has(galleryCtxMenu.mediaUri)
                ? { label: 'Unhide', onPress: () => { handleUnhideDbUri(galleryCtxMenu.mediaUri!); setGalleryCtxMenu(null) } }
                : { label: 'Hide', destructive: true, onPress: () => { handleHideDbUri(galleryCtxMenu.mediaUri!); setGalleryCtxMenu(null) } }
            ] : []),
            ...(galleryCtxMenu.kind === 'media' && galleryCtxMenu.mediaUri ? [
              { label: 'Hide image', destructive: true, onPress: () => { hideUri(galleryCtxMenu.mediaUri!); setGalleryCtxMenu(null) } },
            ] : []),
          ]}
        />
      ) : galleryCtxMenu && galleryCtxMenu.kind === 'media' ? (
        <ContextMenu
          state={galleryCtxMenu}
          onClose={() => setGalleryCtxMenu(null)}
          onJumpToMessage={() => {}}
          onHideUri={hideUri}
        />
      ) : null}
    </div>
  )
}
