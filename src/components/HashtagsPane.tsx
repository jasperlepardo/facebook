'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import { Hashtag, LightboxState, Message } from '@/types'
import { apiFetch, toSlug } from '@/lib/utils'
import { buildHashtagBlocks } from '@/lib/buildHashtagBlocks'
import MessageList from './MessageList'
import Lightbox from './Lightbox'
import ActionSheet from './ActionSheet'
import HashtagCreateForm from './HashtagCreateForm'
import Tabs from './Tabs'

const CHUNK = 60
const MAX_VISIBLE = CHUNK * 2  // max message blocks kept in DOM at once


interface HashtagsPaneProps {
  hashtags: Hashtag[]
  onReload: () => void
  onJumpToMessage: (ts: number, msgId: string) => void
  filter: string
  onFilterChange: (v: string) => void
  creating: boolean
  onCreatingChange: (v: boolean) => void
  onActiveHashtagChange: (name: string | null) => void
  onActionsChange: (actions: { back: () => void; delete: () => void; rename: (name: string) => Promise<void> } | null) => void
  onNavigateBack?: () => void
  pendingSelect?: Hashtag | null
  isSuperAdmin?: boolean
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
}

export default function HashtagsPane({ hashtags, onReload, onJumpToMessage, filter, onFilterChange, creating, onCreatingChange, onActiveHashtagChange, onActionsChange, onNavigateBack, pendingSelect, isSuperAdmin, hideImages, hiddenUris, hiddenMsgIds, onHideMessage, onUnhideMessage, onHideUri, onUnhideUri, activeTab, onActiveTabChange, msgFilter, onMsgFilterChange }: HashtagsPaneProps) {
  const [selected, setSelected] = useState<Hashtag | null>(null)
  const [context, setContext] = useState('')
  const [allMsgs, setAllMsgs] = useState<Message[]>([])
  const [winStart, setWinStart] = useState(0)
  const [winEnd, setWinEnd]   = useState(CHUNK)
  const winRef = useRef({ start: 0, end: CHUNK })
  const [newName, setNewName] = useState('')
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [ctxMsgIds, setCtxMsgIds] = useState<string[] | null>(null)
  const [editingContext, setEditingContext] = useState(false)
  const ctxRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const newRef = useRef<HTMLInputElement>(null)
  const deleteRef = useRef<() => Promise<void>>(async () => {})
  const renameRef = useRef<(name: string) => Promise<void>>(async () => {})
  const msgsScrollRef    = useRef<HTMLDivElement>(null)
  const topSentinelRef   = useRef<HTMLDivElement>(null)
  const botSentinelRef   = useRef<HTMLDivElement>(null)
  const allMsgsRef = useRef<Message[]>([])
  allMsgsRef.current = allMsgs
  winRef.current = { start: winStart, end: winEnd }
  const filteredMsgsRef = useRef<Message[]>([])
  const restoredFromUrl = useRef(false)

  const filteredMsgs = useMemo(() => {
    const q = msgFilter.trim().toLowerCase()
    if (!q) return allMsgs
    return allMsgs.filter(m => m.content?.toLowerCase().includes(q))
  }, [allMsgs, msgFilter])
  filteredMsgsRef.current = filteredMsgs

  function setHashtagParam(id: string | null) {
    const params = new URLSearchParams(window.location.search)
    if (id) params.set('h', id); else params.delete('h')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }

  // Open hashtag selected from HashtagListPane
  useEffect(() => {
    if (pendingSelect) openDetail(pendingSelect)
  }, [pendingSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  // When create form is triggered while a hashtag is open, reset selection first
  useEffect(() => {
    if (creating && selected) {
      setHashtagParam(null)
      setSelected(null)
      onActiveHashtagChange(null)
      onActionsChange(null)
    }
  }, [creating]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore selected hashtag from URL once hashtags have loaded
  useEffect(() => {
    if (restoredFromUrl.current || !hashtags.length) return
    restoredFromUrl.current = true
    const id = new URLSearchParams(window.location.search).get('h')
    if (!id) return
    const h = hashtags.find(h => h.id === id)
    if (h) openDetail(h)
  }, [hashtags]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bottom sentinel: append downward, cull from top
  useEffect(() => {
    if (activeTab !== 'messages' || !botSentinelRef.current || !msgsScrollRef.current) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      const all = filteredMsgsRef.current
      const { start, end } = winRef.current
      const newEnd = Math.min(end + CHUNK, all.length)
      if (newEnd === end) return
      const excess = (newEnd - start) - MAX_VISIBLE
      if (excess > 0) {
        const el = msgsScrollRef.current!
        const prevH = el.scrollHeight
        const newStart = start + excess
        winRef.current = { start: newStart, end: newEnd }
        flushSync(() => { setWinStart(newStart); setWinEnd(newEnd) })
        el.scrollTop += el.scrollHeight - prevH
      } else {
        winRef.current = { start, end: newEnd }
        setWinEnd(newEnd)
      }
    }, { root: msgsScrollRef.current, rootMargin: '300px' })
    io.observe(botSentinelRef.current)
    return () => io.disconnect()
  }, [activeTab, winStart, winEnd, filteredMsgs.length])

  // Top sentinel: append upward, cull from bottom
  useEffect(() => {
    if (activeTab !== 'messages' || !topSentinelRef.current || !msgsScrollRef.current || winStart === 0) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      const { start, end } = winRef.current
      if (start === 0) return
      const newStart = Math.max(0, start - CHUNK)
      const excess = (end - newStart) - MAX_VISIBLE
      const newEnd = excess > 0 ? end - excess : end
      const el = msgsScrollRef.current!
      const prevH = el.scrollHeight
      winRef.current = { start: newStart, end: newEnd }
      flushSync(() => { setWinStart(newStart); setWinEnd(newEnd) })
      el.scrollTop += el.scrollHeight - prevH
    }, { root: msgsScrollRef.current, rootMargin: '300px' })
    io.observe(topSentinelRef.current)
    return () => io.disconnect()
  }, [activeTab, winStart, winEnd])

  // Reset window when filter changes
  useEffect(() => {
    const end = Math.min(CHUNK, filteredMsgsRef.current.length)
    winRef.current = { start: 0, end }
    setWinStart(0)
    setWinEnd(end)
  }, [msgFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleScrollToDay(target: string) {
    const container = msgsScrollRef.current
    if (!container) return
    let el: Element | null = null
    if (target === 'beginning') {
      el = container.querySelector('[data-day-iso]')
    } else if (target === 'recent') {
      const all = container.querySelectorAll('[data-day-iso]')
      el = all[all.length - 1] ?? null
    } else if (target.startsWith('ts:')) {
      const iso = new Date(parseInt(target.slice(3))).toISOString().split('T')[0]
      el = container.querySelector(`[data-day-iso="${iso}"]`)
    } else {
      el = container.querySelector(`[data-day-iso="${target}"]`)
    }
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  async function openDetail(h: Hashtag) {
    setHashtagParam(h.id)
    setSelected(h)
    onActiveHashtagChange(h.name)
    setContext(h.context ?? '')
    onActiveTabChange('context')
    setEditingContext(false)
    await loadMessages(h)
  }

  async function loadMessages(h: Hashtag) {
    try {
      const res = await apiFetch<{ groups: { blockId: string }[] }>(`/api/hashtag-groups?hashtagId=${h.id}`)
      const blockIds = res.groups.map(g => g.blockId)
      if (!blockIds.length) { winRef.current = { start: 0, end: CHUNK }; setWinStart(0); setWinEnd(CHUNK); setAllMsgs([]); return }
      const data = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIds, showHidden: !!isSuperAdmin }),
      }).then(r => r.json())
      const sorted = (data.messages ?? []).sort((a: Message, b: Message) => a.timestamp_ms - b.timestamp_ms)
      const end = Math.min(CHUNK, sorted.length)
      winRef.current = { start: 0, end }
      setWinStart(0); setWinEnd(end)
      setAllMsgs(sorted)
    } catch { winRef.current = { start: 0, end: CHUNK }; setWinStart(0); setWinEnd(CHUNK); setAllMsgs([]) }
  }

  function handleContextChange(v: string) {
    setContext(v)
    if (!selected) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: v }) })
    }, 600)
  }

  async function createHashtag() {
    const slug = newName.trim()
    if (!slug) return
    await fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: slug }) })
    setNewName(''); onCreatingChange(false)
    onReload()
  }

  async function removeGroup(blockId: string) {
    if (!selected) return
    await fetch('/api/hashtag-groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashtagId: selected.id, blockId }),
    })
    setSelected(prev => prev ? { ...prev, groupCount: Math.max(0, (prev.groupCount ?? 1) - 1) } : prev)
    await loadMessages(selected)
    onReload()
  }

  async function deleteHashtag() {
    if (!selected || !confirm(`Delete #${selected.name}?`)) return
    await fetch(`/api/hashtags/${selected.id}`, { method: 'DELETE' })
    setHashtagParam(null)
    setSelected(null)
    onActiveHashtagChange(null)
    onActionsChange(null)
    onReload()
  }

  // Keep action refs current every render so ViewerApp always calls the latest version
  deleteRef.current = deleteHashtag
  renameRef.current = async (name: string) => {
    if (!selected) return
    await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    setSelected(prev => prev ? { ...prev, name } : prev)
    onActiveHashtagChange(name)
    onReload()
  }

  // Re-register actions whenever the selected hashtag changes
  useEffect(() => {
    if (!selected) { onActionsChange(null); return }
    onActionsChange({
      back:   () => { setHashtagParam(null); setSelected(null); onActiveHashtagChange(null); onActionsChange(null); onNavigateBack?.() },
      delete: () => deleteRef.current(),
      rename: (name: string) => renameRef.current(name),
    })
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = filter ? hashtags.filter(h => h.name.includes(filter.toLowerCase())) : hashtags

  // ─── Detail view ───────────────────────────────────────────────────────────
  const visibleMsgs = filteredMsgs.slice(winStart, winEnd)
  const blocks = useMemo(() => buildHashtagBlocks(visibleMsgs), [winStart, winEnd, filteredMsgs]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore   = winEnd < filteredMsgs.length
  const hasBefore = winStart > 0

  if (!selected) {
    if (creating) {
      return <HashtagCreateForm
        isSuperAdmin={isSuperAdmin}
        onCancel={() => { onCreatingChange(false); onNavigateBack?.() }}
        onCreate={async ({ name, isPrivate, context }) => {
          const res = await fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, isPrivate, context: context || undefined }) })
          const { doc } = await res.json()
          onCreatingChange(false)
          await onReload()
          if (doc) openDetail(doc)
        }}
      />
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white dark:bg-mist-900 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-mist-100 dark:bg-mist-800 flex items-center justify-center">
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
      <div className="flex flex-col h-full min-h-0 bg-white dark:bg-mist-900">
        {/* Tabs */}
        <Tabs
          tabs={[
            { key: 'context',  label: 'Context' },
            { key: 'messages', label: 'Messages' },
          ]}
          active={activeTab}
          onChange={onActiveTabChange}
        />


        {/* Tab content */}
        <div className="flex-1 min-h-0 relative">

          {/* Context tab */}
          {activeTab === 'context' && (
            <div className="absolute inset-0 overflow-y-auto">
              {editingContext ? (
                <textarea
                  ref={ctxRef}
                  value={context}
                  onChange={e => handleContextChange(e.target.value)}
                  onBlur={() => setEditingContext(false)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') setEditingContext(false) }}
                  placeholder={`Notes and context for #${selected.name}…\n\nSupports **markdown**`}
                  className="w-full h-full p-3 text-sm text-gray-700 dark:text-mist-200 leading-relaxed resize-none outline-hidden font-mono bg-white dark:bg-mist-900"
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

          {/* Messages tab */}
          {activeTab === 'messages' && (
            <div className="absolute inset-0 flex flex-col">
              <div ref={msgsScrollRef} className="flex-1 overflow-y-auto">
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
                  onContextMenu={(e, msgIds) => { if ((e as any)._fromTouch) setCtxMsgIds(msgIds) }}
                  isSuperAdmin={isSuperAdmin}
                  hideImages={hideImages}
                  hiddenUris={hiddenUris}
                  hiddenMsgIds={hiddenMsgIds}
                  onHideMessage={onHideMessage}
                  onUnhideMessage={onUnhideMessage}
                  onHideUri={onHideUri}
                  onUnhideUri={onUnhideUri}
                  renderBlockActions={block => (
                    <>
                      <button
                        onClick={() => onJumpToMessage(block.msgs[0].timestamp_ms, block.msgs[0]._id)}
                        className="text-[11px] bg-white dark:bg-mist-800 border border-gray-200 dark:border-mist-600 rounded-sm px-1.5 py-0.5 text-mist-600 dark:text-mist-400 shadow-xs hover:bg-mist-50 dark:hover:bg-mist-900/30"
                      >→ Jump</button>
                      <button
                        onClick={() => removeGroup(block.msgs[0].blockId!)}
                        className="text-[11px] bg-white dark:bg-mist-800 border border-gray-200 dark:border-mist-600 rounded-sm px-1.5 py-0.5 text-red-500 shadow-xs hover:bg-red-50 dark:hover:bg-red-900/30"
                      >× Remove</button>
                    </>
                  )}
                />
                {hasMore && <div ref={botSentinelRef} className="h-8" />}
              </div>
            </div>
          )}

        </div>
      </div>
    {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
    {ctxMsgIds && (() => {
      const msg = allMsgsRef.current.find(m => ctxMsgIds.includes(m._id))
      if (!msg) return null
      return (
        <ActionSheet
          onClose={() => setCtxMsgIds(null)}
          actions={[
            { label: 'Go to message', onPress: () => { onJumpToMessage(msg.timestamp_ms, msg._id); setCtxMsgIds(null) } },
            { label: 'Remove block', destructive: true, onPress: () => { removeGroup(msg.blockId!); setCtxMsgIds(null) } },
          ]}
        />
      )
    })()}
    </>
  )

}
