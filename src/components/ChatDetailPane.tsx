'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { MessageBlock, LightboxState, ContextMenuState, Hashtag, DateIndex } from '@/types'
import { ContentTypeKey } from '@/lib/contentTypes'
import { fmtDate, fmtTime } from '@/lib/format'
import { groupMessages } from '@/lib/groupMessages'
import { useMessageLoader } from '@/hooks/useMessageLoader'
import { useMessageJump } from '@/hooks/useMessageJump'
import { useMessageSelection } from '@/hooks/useMessageSelection'
import { useChatScroll } from '@/hooks/useChatScroll'
import { useChatInit } from '@/hooks/useChatInit'
import MessageList from './message/MessageList'
import HashtagPicker from './HashtagPicker'
import ContextMenu from './ContextMenu'
import ActionSheet from './ActionSheet'
import DatePickerModal from './DatePickerModal'

export type JumpFn = (ts: number, msgId: string | null) => Promise<void>

interface Props {
  search: string
  onSearchChange: (v: string) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  hashtags: Hashtag[]
  onReloadHashtags: () => void
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
  onStatsChange?: (total: number, dateIndex: DateIndex | null) => void
  enabledTypes?: Set<ContentTypeKey>
  senderColor?: string
  thread?: string
}

export default function ChatDetailPane({
  search, onSearchChange, scrollRef,
  hashtags, onReloadHashtags,
  currentUser, isSuperAdmin, showHidden,
  hideImages, hiddenUris, hiddenMsgIds,
  onHideUri, onHideDbUri, onUnhideDbUri,
  onHideMessage, onUnhideMessage,
  onLightbox, onRegisterJump, onStatsChange, enabledTypes, senderColor,
  thread = 'messages',
}: Props) {
  const searchRef      = useRef('')
  const showHiddenRef  = useRef(showHidden)
  const dateIndexRef   = useRef<DateIndex | null>(null)
  const blocksRef      = useRef<MessageBlock[]>([])
  const deviceId       = useRef('')
  const currentUserRef = useRef(currentUser)

  useEffect(() => { showHiddenRef.current = showHidden }, [showHidden])
  useEffect(() => { currentUserRef.current = currentUser }, [currentUser])

  const loader = useMessageLoader({ thread, searchRef, showHiddenRef, scrollRef })
  const jump   = useMessageJump({
    withThread: loader.withThread, scrollRef, searchRef, dateIndexRef,
    lowerOffset: loader.lowerOffset, upperOffset: loader.upperOffset,
    onSearchChange, loadMessages: loader.loadMessages, onLightbox,
  })
  const selection = useMessageSelection({
    thread, withThread: loader.withThread,
    hashtags, onReloadHashtags,
    messagesRef: loader.messagesRef, blocksRef,
  })

  const [dateIndex, setDateIndex]             = useState<DateIndex | null>(null)
  const [showDatePicker, setShowDatePicker]   = useState(false)
  const [datePickerDefault, setDatePickerDefault] = useState('')
  const [chatVisible, setChatVisible]         = useState(false)
  const [ctxMenu, setCtxMenu]                 = useState<ContextMenuState | null>(null)
  const [toast, setToast]                     = useState<string | null>(null)
  const toastTimer                            = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScroll = useChatScroll({
    scrollRef, searchRef, thread, deviceId, currentUserRef, loader,
  })

  useChatInit({
    thread, search, scrollRef, searchRef, dateIndexRef,
    deviceId, currentUserRef, loader, jump, setDateIndex, setChatVisible,
  })

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const copyLink = useCallback((msgIds: string[]) => {
    const threadParam = thread !== 'messages' ? `&thread=${thread}` : ''
    const url = `${window.location.origin}${window.location.pathname}?msg=${msgIds[0]}${threadParam}`
    navigator.clipboard.writeText(url).then(() => showToast('Link copied'))
  }, [showToast, thread])

  const copyText = useCallback((msgIds: string[]) => {
    const ids = new Set(msgIds)
    const msgs = loader.messagesRef.current.filter(m => ids.has(m._id))
    if (!msgs.length) return
    const first = msgs[0]
    const header = `${first.sender_name} · ${fmtDate(first.timestamp_ms)} at ${fmtTime(first.timestamp_ms)}`
    const lines = msgs.flatMap(m => {
      const parts: string[] = []
      if (m.content) parts.push(m.content)
      if (m.photos?.length) parts.push('[photo]')
      if (m.videos?.length) parts.push('[video]')
      if (m.audio_files?.length) parts.push('[audio]')
      if (m.gifs?.length) parts.push('[GIF]')
      if (m.sticker) parts.push('[sticker]')
      if (m.files?.length) parts.push('[file]')
      if (m.share?.link) parts.push(m.share.share_text ? `${m.share.share_text} ${m.share.link}` : m.share.link)
      if (m.call_duration != null) parts.push(m.missed ? 'Missed call' : `Call (${m.call_duration}s)`)
      return parts
    })
    navigator.clipboard.writeText([header, ...lines].join('\n')).then(() => showToast('Text copied'))
  }, [showToast, loader.messagesRef])

  useEffect(() => {
    onRegisterJump(jump.jumpToMessage)
    return () => onRegisterJump(null)
  }, [jump.jumpToMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onStatsChange?.(loader.total, dateIndex) }, [loader.total, dateIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { dateIndexRef.current = dateIndex }, [dateIndex])

  const blocks = useMemo(() => groupMessages(loader.messages), [loader.messages])
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
    const scrollId = jump.pendingLightboxScroll.current
    if (scrollId) {
      const anchor = document.getElementById('msg-' + scrollId)?.closest<HTMLElement>('.msg-group')
      if (anchor) { jump.pendingLightboxScroll.current = null; anchor.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
    }
  }, [loader.messages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMsgContextMenu = useCallback((e: React.MouseEvent, msgIds: string[]) => {
    e.preventDefault()
    const fromTouch = !!(e as unknown as { _fromTouch?: boolean })._fromTouch
    const firstMsg = loader.messagesRef.current.find(m => msgIds.includes(m._id))
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'message', msgIds, msgTs: firstMsg?.timestamp_ms, fromTouch })
  }, [loader.messagesRef])

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

  return (
    <>
      {selection.selectedMsgs.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full px-4 py-2 flex items-center gap-2.5 text-[13px] whitespace-nowrap shadow-xl z-20">
          <span className="text-white/60 pr-0.5">{selection.selectedMsgs.size} selected</span>
          <button onClick={selection.openNoteFromSelection} className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full font-semibold transition-colors"># Tag</button>
          <button
            onClick={() => {
              const firstId = [...selection.selectedMsgs.keys()][0]
              if (firstId) copyLink([firstId])
              selection.clearSelection()
            }}
            className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full font-semibold transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Share
          </button>
          <button onClick={selection.clearSelection} className="opacity-50 hover:opacity-100 transition-opacity pl-0.5">✕</button>
        </div>
      )}

      {jump.jumping && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-mist-900/60 backdrop-blur-[2px] pointer-events-none">
          <div className="flex items-center gap-2 bg-white dark:bg-mist-800 border border-mist-200 dark:border-mist-700 shadow-md rounded-full px-4 py-2 text-[13px] text-mist-600 dark:text-mist-300">
            <svg className="animate-spin w-3.5 h-3.5 text-mist-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Loading…
          </div>
        </div>
      )}

      {!chatVisible && (
        <div className="absolute inset-0 flex flex-col justify-end px-4 pb-6 pointer-events-none z-10 overflow-hidden">
          {[
            { side: 'left',  widths: ['w-48', 'w-32'] },
            { side: 'right', widths: ['w-56'] },
            { side: 'left',  widths: ['w-40'] },
            { side: 'right', widths: ['w-36', 'w-44'] },
            { side: 'left',  widths: ['w-52', 'w-28'] },
            { side: 'right', widths: ['w-40'] },
          ].map((row, i) => (
            <div key={i} className={`flex flex-col gap-1 mb-2 ${row.side === 'right' ? 'items-end' : 'items-start'}`}>
              {row.widths.map((w, j) => (
                <div key={j} className={`h-9 rounded-2xl animate-pulse ${w} ${row.side === 'right' ? 'bg-blue-200 dark:bg-blue-900/40' : 'bg-mist-200 dark:bg-mist-700/60'}`} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto flex flex-col min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0${selection.selectedMsgs.size > 0 ? ' select-none' : ''}`}
        style={{ visibility: chatVisible ? 'visible' : 'hidden' }}
      >
        {loader.searching && <div className="text-center py-2 text-[13px] text-gray-500 dark:text-gray-400">Searching…</div>}
        <MessageList
          blocks={blocks}
          onLightbox={jump.handleMsgLightbox}
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
          onHideMessage={onHideMessage}
          onUnhideMessage={onUnhideMessage}
          onHideUri={onHideDbUri}
          onUnhideUri={onUnhideDbUri}
          enabledTypes={enabledTypes}
          senderColor={senderColor}
        />
      </div>

      {showDatePicker && (
        <DatePickerModal defaultDate={datePickerDefault} onClose={() => setShowDatePicker(false)} onJump={jump.handleChatJump} />
      )}
      {selection.hashtagPicker && (
        <HashtagPicker
          hashtags={hashtags}
          initialSelected={selection.preloadedHashtagIds ?? undefined}
          onClose={() => selection.setHashtagPicker(null)}
          onApply={selection.applyHashtags}
        />
      )}
      {ctxMenu && ctxMenu.fromTouch ? (
        <ActionSheet
          onClose={() => setCtxMenu(null)}
          actions={[
            ...(ctxMenu.kind === 'message' && ctxMenu.msgTs != null ? [{ label: 'Go to message', onPress: () => { jump.jumpToMessage(ctxMenu.msgTs!, ctxMenu.msgIds?.[0] ?? null); setCtxMenu(null) } }] : []),
            ...(ctxMenu.kind === 'message' && ctxMenu.msgIds ? [
              { label: 'Copy link', onPress: () => { copyLink(ctxMenu.msgIds!); setCtxMenu(null) } },
              { label: 'Copy text', onPress: () => { copyText(ctxMenu.msgIds!); setCtxMenu(null) } },
              { label: '# Tag', onPress: () => { selection.setHashtagPicker({ msgIds: ctxMenu.msgIds! }); setCtxMenu(null) } },
            ] : []),
            ...(isSuperAdmin && ctxMenu.msgIds?.length ? [hiddenMsgIds.has(ctxMenu.msgIds[0])
              ? { label: 'Unhide message', onPress: () => { onUnhideMessage(ctxMenu.msgIds![0]); setCtxMenu(null) } }
              : { label: 'Hide message', destructive: true, onPress: () => { onHideMessage(ctxMenu.msgIds![0]); setCtxMenu(null) } }
            ] : []),
          ]}
        />
      ) : ctxMenu ? (
        <ContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onJumpToMessage={(ts, msgId) => { jump.jumpToMessage(+ts, msgId); setCtxMenu(null) }}
          onHideUri={onHideUri}
          onTagMessages={msgIds => selection.setHashtagPicker({ msgIds })}
          onCopyLink={copyLink}
          onCopyText={copyText}
        />
      ) : null}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-mist-900 dark:bg-mist-700 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none z-[400]">
          {toast}
        </div>
      )}
    </>
  )
}
