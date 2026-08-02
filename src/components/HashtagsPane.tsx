'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Hashtag, LightboxState, Message } from '@/types'
import { ContentTypeKey } from '@/lib/contentTypes'
import MessageList from './message/MessageList'
import MessageSelectionBar from './message/MessageSelectionBar'
import Lightbox from './Lightbox'
import ActionSheet from './ActionSheet'
import HashtagCreateForm from './HashtagCreateForm'
import Tabs from './Tabs'
import { useHashtagMessages } from '@/hooks/useHashtagMessages'
import { buildMessageLink, formatMessagesText } from '@/lib/messageCopy'
import { buildMessageActions, actionsToSheet } from '@/lib/messageActions'
import { pbSafe, toastPill } from '@/lib/ui'

interface HashtagsPaneProps {
  hashtags: Hashtag[]
  thread?: string
  onReload: () => void
  onJumpToMessage: (ts: number, msgId: string, thread?: string) => Promise<void> | void
  filter: string
  onFilterChange: (v: string) => void
  creating: boolean
  onCreatingChange: (v: boolean) => void
  onActiveHashtagChange: (name: string | null) => void
  onActionsChange: (actions: { back: () => void; delete: () => void; rename: (name: string) => Promise<void> } | null) => void
  onNavigateBack?: () => void
  pendingSelect?: Hashtag | null
  /** Id from URL while restore is in flight — kept so sync does not wipe `h` on refresh. */
  pendingUrlHashtagId?: string | null
  onResolveUrlHashtag?: (id: string | null) => void
  isSuperAdmin?: boolean
  showHidden?: boolean
  hideImages?: boolean
  hiddenUris?: Set<string>
  hiddenMsgIds?: Set<string>
  onHideMessage?: (msgId: string) => void
  onUnhideMessage?: (msgId: string) => void
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  activeTab: 'context' | 'messages'
  onActiveTabChange: (tab: 'context' | 'messages') => void
  msgFilter: string
  onMsgFilterChange: (v: string) => void
  senderStyles?: Record<string, { initials: string; color: string }>
  enabledTypes?: Set<ContentTypeKey>
}

export default function HashtagsPane({ hashtags, thread = 'messages', onReload, onJumpToMessage, filter: _filter, onFilterChange: _onFilterChange, creating, onCreatingChange, onActiveHashtagChange, onActionsChange, onNavigateBack, pendingSelect, pendingUrlHashtagId, onResolveUrlHashtag, isSuperAdmin, showHidden, hideImages, hiddenUris, hiddenMsgIds, onHideMessage, onUnhideMessage, onHideUri, onUnhideUri, activeTab, onActiveTabChange, msgFilter, onMsgFilterChange: _onMsgFilterChange, senderStyles, enabledTypes }: HashtagsPaneProps) {
  const [selected, setSelected] = useState<Hashtag | null>(null)
  const [context, setContext] = useState('')
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [sheetMsgIds, setSheetMsgIds] = useState<string[] | null>(null)
  const [selectedMsgs, setSelectedMsgs] = useState(new Map<string, { ts: number }>())
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnchor = useRef<{ id: string; ts: number } | null>(null)
  const [editingContext, setEditingContext] = useState(false)
  const ctxRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const deleteRef = useRef<() => Promise<void>>(async () => {})
  const renameRef = useRef<(name: string) => Promise<void>>(async () => {})
  const restoredFromUrl = useRef(false)

  const {
    allMsgs,
    allMsgsRef,
    filteredMsgs,
    msgsScrollRef,
    topSentinelRef,
    botSentinelRef,
    msgThread,
    blocks,
    hasMore,
    hasBefore,
    loadMessages,
    handleScrollToDay,
  } = useHashtagMessages({ thread, isSuperAdmin, showHidden, hiddenMsgIds, activeTab, msgFilter })

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const showHiddenReloadMounted = useRef(false)
  useEffect(() => {
    if (!showHiddenReloadMounted.current) {
      showHiddenReloadMounted.current = true
      return
    }
    if (selected) void loadMessages(selected)
  }, [showHidden]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingSelect) openDetail(pendingSelect)
  }, [pendingSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return
    const fresh = hashtags.find(h => h.id === selected.id)
    if (fresh && (fresh.name !== selected.name || fresh.isPrivate !== selected.isPrivate || fresh.context !== selected.context)) {
      setSelected(fresh)
      if (fresh.name !== selected.name) onActiveHashtagChange(fresh.name)
      if (fresh.context !== selected.context) setContext(fresh.context ?? '')
    }
  }, [hashtags]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (creating && selected) {
      setSelected(null)
      onActiveHashtagChange(null)
      onActionsChange(null)
    }
  }, [creating]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (restoredFromUrl.current || !hashtags.length) return
    restoredFromUrl.current = true
    const id = pendingUrlHashtagId ?? new URLSearchParams(window.location.search).get('h')
    if (!id) {
      onResolveUrlHashtag?.(null)
      return
    }
    const h = hashtags.find(h => h.id === id)
    if (!h) {
      onResolveUrlHashtag?.(null)
      return
    }
    const wantMessages = new URLSearchParams(window.location.search).get('tab') === 'messages'
      || activeTab === 'messages'
    void openDetail(h, { tab: wantMessages ? 'messages' : 'context' })
  }, [hashtags]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(h: Hashtag, opts?: { tab?: 'context' | 'messages' }) {
    setSelected(h)
    onActiveHashtagChange(h.name)
    onResolveUrlHashtag?.(h.id)
    setContext(h.context ?? '')
    onActiveTabChange(opts?.tab ?? 'context')
    setEditingContext(false)
    setSelectedMsgs(new Map())
    lastAnchor.current = null
    _onMsgFilterChange('')
    await loadMessages(h)
  }

  function handleContextChange(v: string) {
    setContext(v)
    if (!selected) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: v }) })
    }, 600)
  }

  async function removeGroup(messageIds: string[]) {
    if (!selected || !messageIds.length) return
    await Promise.all(messageIds.map(messageId =>
      fetch('/api/hashtag-groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtagId: selected.id, messageId, thread: msgThread }),
      }),
    ))
    setSelected(prev => prev ? { ...prev, groupCount: Math.max(0, (prev.groupCount ?? messageIds.length) - messageIds.length) } : prev)
    setSelectedMsgs(new Map())
    lastAnchor.current = null
    await loadMessages(selected)
    onReload()
  }

  async function deleteHashtag() {
    if (!selected || !confirm(`Delete #${selected.name}?`)) return
    await fetch(`/api/hashtags/${selected.id}`, { method: 'DELETE' })
    setSelected(null)
    onActiveHashtagChange(null)
    onActionsChange(null)
    onReload()
  }

  deleteRef.current = deleteHashtag
  renameRef.current = async (name: string) => {
    if (!selected) return
    await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    setSelected(prev => prev ? { ...prev, name } : prev)
    onActiveHashtagChange(name)
    onReload()
  }

  useEffect(() => {
    if (!selected) { onActionsChange(null); return }
    onActionsChange({
      back:   () => { setSelected(null); onActiveHashtagChange(null); onActionsChange(null); onNavigateBack?.() },
      delete: () => deleteRef.current(),
      rename: (name: string) => renameRef.current(name),
    })
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((id: string, ts: number, _tsEnd: number, _allIds: string[], shiftKey?: boolean) => {
    if (shiftKey && lastAnchor.current) {
      const flat = blocks.flatMap(b => b.msgs)
      const aIdx = flat.findIndex(m => m._id === lastAnchor.current!.id)
      const cIdx = flat.findIndex(m => m._id === id)
      if (aIdx !== -1 && cIdx !== -1) {
        const [start, end] = aIdx < cIdx ? [aIdx, cIdx] : [cIdx, aIdx]
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (let i = start; i <= end; i++) next.set(flat[i]._id, { ts: flat[i].timestamp_ms })
          return next
        })
        return
      }
    }
    lastAnchor.current = { id, ts }
    setSelectedMsgs(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, { ts })
      return next
    })
  }, [blocks])

  const clearSelection = useCallback(() => {
    setSelectedMsgs(new Map())
    lastAnchor.current = null
  }, [])

  const copyLink = useCallback((msgIds: string[]) => {
    if (!msgIds[0]) return
    navigator.clipboard.writeText(buildMessageLink(msgIds[0], msgThread)).then(() => showToast('Link copied'))
  }, [msgThread, showToast])

  const copyText = useCallback((msgIds: string[]) => {
    const ids = new Set(msgIds)
    const msgs = allMsgsRef.current.filter(m => ids.has(m._id))
    const text = formatMessagesText(msgs)
    if (!text) return
    navigator.clipboard.writeText(text).then(() => showToast('Text copied'))
  }, [allMsgsRef, showToast])

  const makeActions = useCallback((msgIds: string[], opts?: { omitSelect?: boolean; isSelected?: boolean }) => {
    const msgs: Message[] = allMsgsRef.current.filter(m => msgIds.includes(m._id))
    const first = msgs[0]
    return buildMessageActions({
      surface: 'hashtag',
      count: msgIds.length,
      isSelected: opts?.isSelected,
      isHidden: !!(first && hiddenMsgIds?.has(first._id)),
      isSuperAdmin,
      omitSelect: opts?.omitSelect,
      callbacks: {
        onSelect: () => {
          if (!first) return
          handleToggle(first._id, first.timestamp_ms, first.timestamp_ms, [first._id])
        },
        onGoToMessage: first
          ? () => { void onJumpToMessage(first.timestamp_ms, first._id, msgThread) }
          : undefined,
        onCopyLink: () => copyLink(msgIds),
        onCopyText: () => copyText(msgIds),
        onRemove: () => { void removeGroup(msgIds) },
        onHide: onHideMessage && msgIds.length ? () => { for (const id of msgIds) onHideMessage(id) } : undefined,
        onUnhide: onUnhideMessage && msgIds.length ? () => { for (const id of msgIds) onUnhideMessage(id) } : undefined,
      },
    })
  }, [allMsgsRef, handleToggle, onJumpToMessage, msgThread, copyLink, copyText, isSuperAdmin, hiddenMsgIds, onHideMessage, onUnhideMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIds = useMemo(() => [...selectedMsgs.keys()], [selectedMsgs])
  const barActions = useMemo(
    () => makeActions(selectedIds, { omitSelect: true }),
    [makeActions, selectedIds],
  )
  const sheetActions = useMemo(
    () => (sheetMsgIds ? makeActions(sheetMsgIds, {
      isSelected: sheetMsgIds[0] ? selectedMsgs.has(sheetMsgIds[0]) : false,
    }) : []),
    [sheetMsgIds, makeActions, selectedMsgs],
  )

  if (!selected) {
    if (creating) {
      return <HashtagCreateForm
        isSuperAdmin={isSuperAdmin}
        onCancel={() => { onCreatingChange(false); onNavigateBack?.() }}
        onCreate={async ({ name, isPrivate, context }, signal) => {
          const res = await fetch('/api/hashtags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, isPrivate, context: context || undefined }),
            signal,
          })
          if (signal.aborted) return
          const { doc } = await res.json()
          if (signal.aborted) return
          onCreatingChange(false)
          await onReload()
          if (signal.aborted) return
          if (doc) openDetail(doc)
        }}
      />
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 liquid-glass-atmosphere px-8 text-center">
        <div className="w-20 h-20 rounded-full liquid-glass flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400 dark:text-mist-500">
            <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
            <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Tag what matters</h3>
          <p className="text-sm text-mist-500 dark:text-mist-400 leading-relaxed">Select a hashtag to browse tagged messages, add context, and jump back to any moment.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full min-h-0 liquid-glass-atmosphere">
        <Tabs
          tabs={[
            { key: 'context',  label: 'Context' },
            { key: 'messages', label: 'Messages' },
          ]}
          active={activeTab}
          onChange={onActiveTabChange}
        />

        <div className="flex-1 min-h-0 relative">
          {activeTab === 'context' && (
            <div className={`absolute inset-0 overflow-y-auto ${pbSafe} md:pb-0`}>
              {editingContext ? (
                <textarea
                  ref={ctxRef}
                  value={context}
                  onChange={e => handleContextChange(e.target.value)}
                  onBlur={() => setEditingContext(false)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') setEditingContext(false) }}
                  placeholder={`Notes and context for #${selected.name}…\n\nSupports **markdown**`}
                  className="w-full h-full p-3 text-sm text-gray-700 dark:text-mist-200 leading-relaxed resize-none outline-hidden font-mono bg-transparent"
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => { setEditingContext(true); setTimeout(() => ctxRef.current?.focus(), 10) }}
                  className="min-h-full p-3 cursor-text"
                >
                  {context ? (
                    <ReactMarkdown components={{
                      p:          ({children}) => <p className="text-sm text-gray-700 dark:text-mist-200 leading-relaxed mb-3">{children}</p>,
                      h1:         ({children}) => <h1 className="text-base font-bold text-gray-900 dark:text-white mb-2 mt-4">{children}</h1>,
                      h2:         ({children}) => <h2 className="text-sm font-bold text-gray-800 dark:text-mist-100 mb-2 mt-3">{children}</h2>,
                      h3:         ({children}) => <h3 className="text-sm font-semibold text-gray-800 dark:text-mist-100 mb-1 mt-3">{children}</h3>,
                      ul:         ({children}) => <ul className="list-disc pl-4 mb-3 space-y-1 text-sm text-gray-700 dark:text-mist-200">{children}</ul>,
                      ol:         ({children}) => <ol className="list-decimal pl-4 mb-3 space-y-1 text-sm text-gray-700 dark:text-mist-200">{children}</ol>,
                      li:         ({children}) => <li className="leading-relaxed">{children}</li>,
                      strong:     ({children}) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
                      em:         ({children}) => <em className="italic">{children}</em>,
                      a:          ({href, children}) => <a href={href} target="_blank" rel="noopener" className="text-mist-600 dark:text-mist-400 underline">{children}</a>,
                      code:       ({children}) => <code className="bg-gray-100 dark:bg-mist-800 text-xs px-1 py-0.5 rounded-sm font-mono">{children}</code>,
                      blockquote: ({children}) => <blockquote className="border-l-2 border-gray-300 dark:border-mist-600 pl-3 text-gray-500 dark:text-mist-400 italic my-2">{children}</blockquote>,
                    }}>{context}</ReactMarkdown>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-600 italic">Click to add context… supports **markdown**</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="absolute inset-0 flex flex-col">
              {selectedMsgs.size > 0 && (
                <MessageSelectionBar
                  count={selectedMsgs.size}
                  actions={barActions}
                  onClear={clearSelection}
                />
              )}
              <div ref={msgsScrollRef} className={`flex-1 overflow-y-auto ${pbSafe} md:pb-0${selectedMsgs.size > 0 ? ' select-none' : ''}`}>
                <div className="min-h-full flex flex-col">
                {allMsgs.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-mist-500 text-center py-8">No messages tagged yet.</p>
                )}
                {allMsgs.length > 0 && filteredMsgs.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-mist-500 text-center py-8">No messages match.</p>
                )}
                {hasBefore && <div ref={topSentinelRef} className="h-8" />}
                <MessageList
                  blocks={blocks}
                  onLightbox={setLightbox}
                  onJumpTo={handleScrollToDay}
                  selectedMsgIds={selectedMsgs}
                  onToggle={handleToggle}
                  onContextMenu={(e, msgIds) => {
                    e.preventDefault()
                    if ((e as unknown as { _fromTouch?: boolean })._fromTouch) setSheetMsgIds(msgIds)
                  }}
                  isSuperAdmin={isSuperAdmin}
                  hideImages={hideImages}
                  hiddenUris={hiddenUris}
                  hiddenMsgIds={hiddenMsgIds}
                  onHideUri={onHideUri}
                  onUnhideUri={onUnhideUri}
                  enabledTypes={enabledTypes}
                  senderStyles={senderStyles}
                />
                {hasMore && <div ref={botSentinelRef} className="h-8" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
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
    </>
  )
}
