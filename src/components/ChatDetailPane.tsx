'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { MessageBlock, LightboxState, DateIndex, Message, ThreadParticipant } from '@/types'
import { ContentTypeKey } from '@/lib/contentTypes'
import { groupMessages } from '@/lib/groupMessages'
import { buildMessageLink, formatMessagesText } from '@/lib/messageCopy'
import { buildMessageActions, actionsToSheet, MessageActionSurface } from '@/lib/messageActions'
import { useMessageLoader } from '@/hooks/useMessageLoader'
import { useMessageJump } from '@/hooks/useMessageJump'
import { useMessageSelection } from '@/hooks/useMessageSelection'
import { useChatScroll } from '@/hooks/useChatScroll'
import { useChatInit, filterKey } from '@/hooks/useChatInit'
import MessageList from './message/MessageList'
import MessageSelectionBar from './message/MessageSelectionBar'
import ActionSheet from './ActionSheet'
import DatePickerModal from './DatePickerModal'
import { MessageListSkeleton } from '@/components/skeletons'
import { pbSafe, toastPill } from '@/lib/ui'

export type JumpFn = (ts: number, msgId: string | null) => Promise<void>

interface Props {
  search: string
  searchActive?: boolean
  onSearchChange: (v: string) => void
  /** Leave search mode (e.g. after jumping to a message from a search result). */
  onExitSearch?: () => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  currentUser: string
  isSuperAdmin: boolean
  showHidden: boolean
  hideImages: boolean
  hiddenUris: Set<string>
  hiddenMsgIds: Set<string>
  onHideUri: (uri: string) => void
  onHideDbUri: (uri: string) => void
  onUnhideDbUri: (uri: string) => void
  onHideMessage: (id: string) => void
  onUnhideMessage: (id: string) => void
  onLightbox: (state: LightboxState) => void
  onRegisterJump: (fn: JumpFn | null) => void
  enabledTypes?: Set<ContentTypeKey>
  senderStyles?: Record<string, { initials: string; color: string }>
  participants?: ThreadParticipant[]
  thread?: string
  /** Open tag UI in the chat settings/side pane. */
  onOpenTag?: (msgIds: string[]) => void
  /** Parent registers clearSelection so tag apply can clear. */
  onRegisterClearSelection?: (fn: (() => void) | null) => void
}

export default function ChatDetailPane({
  search, searchActive = false, onSearchChange, onExitSearch, scrollRef,
  currentUser, isSuperAdmin, showHidden,
  hideImages, hiddenUris, hiddenMsgIds,
  onHideUri: _onHideUri, onHideDbUri, onUnhideDbUri,
  onHideMessage, onUnhideMessage,
  onLightbox, onRegisterJump, enabledTypes, senderStyles,
  participants = [],
  thread = 'messages',
  onOpenTag,
  onRegisterClearSelection,
}: Props) {
  const searchRef      = useRef('')
  const senderIdsRef   = useRef<string[]>([])
  const showHiddenRef  = useRef(showHidden)
  const dateIndexRef   = useRef<DateIndex | null>(null)
  const blocksRef      = useRef<MessageBlock[]>([])
  const deviceId       = useRef('')
  const currentUserRef = useRef(currentUser)
  const senderMenuRef  = useRef<HTMLDivElement>(null)
  const [senderIds, setSenderIds] = useState<string[]>([])
  const [senderMenuOpen, setSenderMenuOpen] = useState(false)

  useEffect(() => { showHiddenRef.current = showHidden }, [showHidden])
  useEffect(() => { currentUserRef.current = currentUser }, [currentUser])
  useEffect(() => {
    setSenderIds([])
    senderIdsRef.current = []
    setSenderMenuOpen(false)
  }, [thread])
  useEffect(() => {
    senderIdsRef.current = senderIds
  }, [senderIds])

  const appliedFilterKey = useRef(filterKey('', []))

  // Jumping lands on an unfiltered window, so search and sender filters have to
  // go with it — otherwise the target message isn't in the range we load.
  const resetFilters = useCallback(() => {
    searchRef.current = ''
    senderIdsRef.current = []
    setSenderIds([])
    appliedFilterKey.current = filterKey('', [])
    onSearchChange('')
    onExitSearch?.()
  }, [onSearchChange, onExitSearch])

  const loader = useMessageLoader({ thread, searchRef, senderIdsRef, showHiddenRef, scrollRef })

  const showHiddenReloadMounted = useRef(false)
  useEffect(() => {
    if (!showHiddenReloadMounted.current) {
      showHiddenReloadMounted.current = true
      return
    }
    let cancelled = false
    ;(async () => {
      loader.lowerOffset.current = 0
      loader.upperOffset.current = 0
      loader.setSearching(true)
      try {
        await loader.loadMessages('fresh')
      } finally {
        if (!cancelled) loader.setSearching(false)
      }
    })()
    return () => { cancelled = true }
  }, [showHidden]) // eslint-disable-line react-hooks/exhaustive-deps

  const jump   = useMessageJump({
    withThread: loader.withThread, scrollRef, dateIndexRef,
    lowerOffset: loader.lowerOffset, upperOffset: loader.upperOffset,
    resetFilters, loadMessages: loader.loadMessages,
  })
  const selection = useMessageSelection({
    withThread: loader.withThread,
    messagesRef: loader.messagesRef, blocksRef,
  })
  useEffect(() => {
    onRegisterClearSelection?.(selection.clearSelection)
    return () => onRegisterClearSelection?.(null)
  }, [onRegisterClearSelection, selection.clearSelection])
  const [dateIndex, setDateIndex]             = useState<DateIndex | null>(null)
  const [showDatePicker, setShowDatePicker]   = useState(false)
  const [datePickerDefault, setDatePickerDefault] = useState('')
  const [chatVisible, setChatVisible]         = useState(false)
  const [sheetMsgIds, setSheetMsgIds]         = useState<string[] | null>(null)
  const [toast, setToast]                     = useState<string | null>(null)
  const toastTimer                            = useRef<ReturnType<typeof setTimeout> | null>(null)

  const senderIdsKey = senderIds.slice().sort().join(',')
  const hasSenderFilter = senderIds.length > 0
  const surface: MessageActionSurface = search.trim() || hasSenderFilter ? 'chat-search' : 'chat'

  const handleScroll = useChatScroll({
    scrollRef, searchRef, thread, deviceId, currentUserRef, loader,
  })

  useChatInit({
    thread, search, senderIdsKey, scrollRef, searchRef, senderIdsRef, dateIndexRef,
    deviceId, currentUserRef, appliedFilterKey,
    loader, jump, setDateIndex, setChatVisible,
  })

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const copyLink = useCallback((msgIds: string[]) => {
    if (!msgIds[0]) return
    navigator.clipboard.writeText(buildMessageLink(msgIds[0], thread)).then(() => showToast('Link copied'))
  }, [showToast, thread])

  const copyText = useCallback((msgIds: string[]) => {
    const ids = new Set(msgIds)
    const msgs = loader.messagesRef.current.filter(m => ids.has(m._id))
    const text = formatMessagesText(msgs)
    if (!text) return
    navigator.clipboard.writeText(text).then(() => showToast('Text copied'))
  }, [showToast, loader.messagesRef])

  useEffect(() => {
    onRegisterJump(jump.jumpToMessage)
    return () => onRegisterJump(null)
  }, [jump.jumpToMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { dateIndexRef.current = dateIndex }, [dateIndex])

  const blocks = useMemo(() => {
    const msgs = (isSuperAdmin && showHidden)
      ? loader.messages
      : loader.messages.filter(m => !m._id || !hiddenMsgIds.has(m._id))
    return groupMessages(msgs)
  }, [loader.messages, isSuperAdmin, showHidden, hiddenMsgIds])
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  useEffect(() => {
    if (jump.pendingScrollReset.current) {
      jump.pendingScrollReset.current = false
      if (scrollRef.current) scrollRef.current.scrollTop = 0
      return
    }
    if (jump.pendingScrollBottom.current) {
      jump.pendingScrollBottom.current = false
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      return
    }
    const jumpId = jump.pendingJump.current
    if (jumpId) jump.scheduleScrollToMsg(jumpId)
  }, [loader.messages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMsgContextMenu = useCallback((e: React.MouseEvent, msgIds: string[]) => {
    e.preventDefault()
    const fromTouch = !!(e as unknown as { _fromTouch?: boolean })._fromTouch
    if (!fromTouch) return
    setSheetMsgIds(msgIds)
  }, [])

  const openDatePicker = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      const containerTop = el.getBoundingClientRect().top
      const dayEls = el.querySelectorAll<HTMLElement>('[data-day-iso]')
      let current = ''
      for (const dayEl of dayEls) {
        if (dayEl.getBoundingClientRect().top <= containerTop + 1) current = dayEl.dataset.dayIso ?? ''
        else break
      }
      setDatePickerDefault(current)
    }
    setShowDatePicker(true)
  }, [scrollRef])

  const resolveMsgs = useCallback((msgIds: string[]): Message[] => {
    const ids = new Set(msgIds)
    return loader.messagesRef.current.filter(m => ids.has(m._id))
  }, [loader.messagesRef])

  const makeActions = useCallback((msgIds: string[], opts?: { omitSelect?: boolean; isSelected?: boolean }) => {
    const msgs = resolveMsgs(msgIds)
    const first = msgs[0]
    const isHidden = !!(first && hiddenMsgIds.has(first._id))
    return buildMessageActions({
      surface,
      count: msgIds.length,
      isSelected: opts?.isSelected,
      isHidden,
      isSuperAdmin,
      omitSelect: opts?.omitSelect,
      callbacks: {
        onSelect: () => {
          if (!first) return
          selection.handleToggle(first._id, first.timestamp_ms, first.timestamp_ms, [first._id])
        },
        onGoToMessage: first
          ? () => { jump.jumpToMessage(first.timestamp_ms, first._id) }
          : undefined,
        onTag: onOpenTag ? () => onOpenTag(msgIds) : undefined,
        onCopyLink: () => copyLink(msgIds),
        onCopyText: () => copyText(msgIds),
        onHide: msgIds.length ? () => { for (const id of msgIds) onHideMessage(id) } : undefined,
        onUnhide: msgIds.length ? () => { for (const id of msgIds) onUnhideMessage(id) } : undefined,
      },
    })
  }, [surface, isSuperAdmin, hiddenMsgIds, resolveMsgs, selection, jump, copyLink, copyText, onHideMessage, onUnhideMessage, onOpenTag])

  const selectedIds = useMemo(() => [...selection.selectedMsgs.keys()], [selection.selectedMsgs])
  const barActions = useMemo(
    () => makeActions(selectedIds, { omitSelect: true }),
    [makeActions, selectedIds],
  )

  const sheetActions = useMemo(
    () => (sheetMsgIds ? makeActions(sheetMsgIds, {
      isSelected: sheetMsgIds[0] ? selection.selectedMsgs.has(sheetMsgIds[0]) : false,
    }) : []),
    [sheetMsgIds, makeActions, selection.selectedMsgs],
  )

  const searchQuery = search.trim()
  const searchIdle = searchActive && !searchQuery && !hasSenderFilter
  const searchNoResults = searchActive && (!!searchQuery || hasSenderFilter) && !loader.searching && chatVisible && loader.messages.length === 0
  const showSearchEmpty = searchIdle || searchNoResults
  const showList = !showSearchEmpty && chatVisible && !jump.jumping && !loader.searching
  const filterMembers = participants.filter(p => !!p.id)

  useEffect(() => {
    if (!searchActive) {
      if (senderIds.length) {
        setSenderIds([])
        senderIdsRef.current = []
      }
      setSenderMenuOpen(false)
    }
  }, [searchActive, senderIds.length])

  useEffect(() => {
    if (!senderMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!senderMenuRef.current?.contains(e.target as Node)) setSenderMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSenderMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [senderMenuOpen])

  function toggleSender(id: string) {
    setSenderIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      senderIdsRef.current = next
      return next
    })
  }

  function clearSenders() {
    setSenderIds([])
    senderIdsRef.current = []
  }

  const senderLabel = !hasSenderFilter
    ? 'All senders'
    : senderIds.length === 1
      ? (filterMembers.find(p => p.id === senderIds[0])?.name ?? '1 sender')
      : `${senderIds.length} senders`

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      {selection.selectedMsgs.size > 0 && !searchIdle && (
        <MessageSelectionBar
          count={selection.selectedMsgs.size}
          actions={barActions}
          onClear={selection.clearSelection}
        />
      )}

      {searchActive && filterMembers.length > 0 && (
        <div className="relative z-30 shrink-0 px-3 py-2 liquid-glass-bar liquid-glass-bar-frosted">
          <div ref={senderMenuRef} className="relative max-w-sm">
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
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); clearSenders() } }}
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
                  onClick={clearSenders}
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
                {filterMembers.map(p => {
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
        </div>
      )}

      {showSearchEmpty && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-center px-8 pt-14 bg-transparent pointer-events-none">
          <div className="w-16 h-16 rounded-full liquid-glass flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400 dark:text-mist-500">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {searchIdle ? 'Search this conversation' : 'No messages found'}
            </p>
            <p className="text-sm text-mist-400 dark:text-mist-500 mt-1">
              {searchIdle
                ? (filterMembers.length ? 'Choose senders above, or type to search' : 'Type to find messages')
                : 'Try a different search or sender'}
            </p>
          </div>
        </div>
      )}

      {!showSearchEmpty && (!chatVisible || jump.jumping || loader.searching) && (
        <div
          className="absolute inset-0 flex flex-col justify-end z-30 overflow-hidden liquid-glass-atmosphere pointer-events-none"
          aria-busy
          aria-label={loader.searching ? 'Searching' : 'Loading'}
        >
          <MessageListSkeleton />
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto min-h-0 ${pbSafe} md:pb-0${selection.selectedMsgs.size > 0 ? ' select-none' : ''}`}
        style={{ visibility: showList ? 'visible' : 'hidden' }}
      >
        <div className="min-h-full flex flex-col justify-end">
          <MessageList
            blocks={blocks}
            onLightbox={onLightbox}
            selectedMsgIds={selection.selectedMsgs}
            onToggle={selection.handleToggle}
            onContextMenu={handleMsgContextMenu}
            dateIndex={dateIndex}
            onJumpTo={jump.handleChatJump}
            onOpenDatePicker={openDatePicker}
            hideImages={hideImages}
            hiddenUris={hiddenUris}
            isSuperAdmin={isSuperAdmin}
            hiddenMsgIds={hiddenMsgIds}
            onHideUri={onHideDbUri}
            onUnhideUri={onUnhideDbUri}
            enabledTypes={enabledTypes}
            senderStyles={senderStyles}
          />
        </div>
      </div>

      {showDatePicker && (
        <DatePickerModal defaultDate={datePickerDefault} onClose={() => setShowDatePicker(false)} onJump={jump.handleChatJump} />
      )}
      {sheetMsgIds && (
        <ActionSheet
          onClose={() => setSheetMsgIds(null)}
          actions={actionsToSheet(sheetActions.map(a => ({
            ...a,
            onPress: () => { a.onPress(); setSheetMsgIds(null) },
          })))}
        />
      )}
      {toast && (
        <div className={toastPill}>
          {toast}
        </div>
      )}
    </div>
  )
}
