'use client'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { Message, Note, Tab, LightboxState, ContextMenuState, GalleryItem, Hashtag } from '@/types'
import { LIMIT, MAX_DOM, LOAD_THRESHOLD } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'
import { groupMessages } from '@/lib/groupMessages'
import MessageGroup from './MessageGroup'
import HashtagsPane from './HashtagsPane'
import HashtagPicker from './HashtagPicker'
import NoteModal from './NoteModal'
import Gallery from './Gallery'
import FilesView from './FilesView'
import Lightbox from './Lightbox'
import ContextMenu from './ContextMenu'

// Given a set of selected messages and the full visible message list,
// return the anchor ID (first _id) of each groupMessages block that contains a selected message.
function toBlockIds(selected: Message[], allMsgs: Message[]): string[] {
  const blocks = groupMessages(allMsgs)
  const selectedIds = new Set(selected.map(m => m._id))
  const blockIds = new Set<string>()
  for (const block of blocks) {
    if (block.msgs.some(m => selectedIds.has(m._id))) {
      const bid = block.msgs[0].blockId
      if (bid) blockIds.add(bid)
    }
  }
  return [...blockIds]
}

export default function ViewerApp() {
  // Messages
  const [messages, setMessages]   = useState<Message[]>([])
  const messagesRef               = useRef<Message[]>([])
  const [total, setTotal]         = useState(0)
  const [hasMore, setHasMore]     = useState(false)
  const [searching, setSearching] = useState(false)
  const lowerOffset = useRef(0)
  const upperOffset = useRef(0)
  const loadingRef  = useRef(false)
  const hasMoreRef  = useRef(false)

  // UI
  const [currentTab, setCurrentTab]   = useState<Tab>('chat')
  const [searchInput, setSearchInput] = useState('')
  const searchRef   = useRef('')
  const [chatVisible, setChatVisible] = useState(false)
  const [stickyDate, setStickyDate]   = useState('')
  const [currentUser, setCurrentUser] = useState('')

  // Hashtags
  const [hashtags, setHashtags]         = useState<Hashtag[]>([])
  const [hashtagPicker, setHashtagPicker] = useState<{ msgIds: string[]; blockIds: string[] } | null>(null)

  // Selection
  const [selectedMsgs, setSelectedMsgs] = useState(new Map<string, { ts: number; tsEnd: number; allIds: string[]; blockId: string }>())
  const lastSelectedAnchor = useRef<{ id: string; ts: number; tsEnd: number } | null>(null)

  // UI overlays
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [ctxMenu, setCtxMenu]   = useState<ContextMenuState | null>(null)

  // Notes pane width (resizable)
  const [notesWidth, setNotesWidth] = useState('50%')

  // Refs
  const chatRef       = useRef<HTMLDivElement>(null)
  const deviceId      = useRef('')
  const lastBookmarkTime = useRef(0)
  const pendingJump   = useRef<string | null>(null)
  const queuedLoad    = useRef<'older' | 'newer' | null>(null)
  // ─── Helpers ────────────────────────────────────────────────────────────────

  const applyMessages = (msgs: Message[]) => {
    const seen = new Set<string>()
    const deduped = msgs.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
    messagesRef.current = deduped
    setMessages(deduped)
  }

  const reloadHashtags = useCallback(async () => {
    const d = await apiFetch<{ docs: Hashtag[] }>('/api/hashtags?limit=200&sort=firstMsgTs&depth=0')
    setHashtags(d.docs ?? [])
  }, [])

  // ─── Scroll to pending jump target after messages render ────────────────────

  useEffect(() => {
    const msgId = pendingJump.current
    if (!msgId) return
    const anchor = document.getElementById('msg-' + msgId)?.closest<HTMLElement>('.msg-group')
    if (!anchor) return
    pendingJump.current = null
    anchor.scrollIntoView({ block: 'center' })
    anchor.style.background = '#fff3cd'
    setTimeout(() => { anchor.style.transition = 'background 1s'; anchor.style.background = '' }, 800)
    setTimeout(() => { anchor.style.transition = '' }, 1800)
  }, [messages])

  // ─── Load messages ───────────────────────────────────────────────────────────

  async function loadMessages(mode: 'fresh' | 'append' | 'prepend') {
    const offset = mode === 'prepend' ? lowerOffset.current : mode === 'append' ? upperOffset.current : lowerOffset.current
    const params = new URLSearchParams({ offset: String(offset), limit: String(LIMIT), asc: '1' })
    const q = searchRef.current
    if (q) { params.delete('asc'); params.set('offset', '0'); params.set('search', q) }

    const data = await apiFetch<{ messages: Message[]; total: number; has_more: boolean }>('/api/messages?' + params)
    setTotal(data.total)
    hasMoreRef.current = !!(data.has_more && !q)
    setHasMore(hasMoreRef.current)

    const count = data.messages.length
    const prev  = messagesRef.current

    if (mode === 'prepend') {
      const el = chatRef.current
      const prevH = el?.scrollHeight ?? 0
      const prevTop = el?.scrollTop ?? 0
      const combined = [...data.messages, ...prev]

      // Step 1: prepend only — formula correct for pure prepend
      flushSync(() => applyMessages(combined))
      if (el) {
        const newScrollTop = prevTop + el.scrollHeight - prevH
        el.scrollTop = newScrollTop
      }

      // Step 2: cull bottom only if it won't clamp scrollTop.
      // After cull: max scrollTop = (currentH - cullH) - clientH
      // Clamps when currentScrollTop > maxAfterCull → skip cull to avoid triggering loadNewer.
      if (combined.length > MAX_DOM && el) {
        const excess = combined.length - MAX_DOM
        const currentH = el.scrollHeight
        const currentTop = el.scrollTop
        const clientH = el.clientHeight
        const estCullH = Math.round(currentH * excess / combined.length)
        if (currentTop <= currentH - estCullH - clientH) {
          upperOffset.current -= excess
          flushSync(() => applyMessages(combined.slice(0, MAX_DOM)))
        }
        // else: skip cull — DOM temporarily > MAX_DOM; will cull on next prepend
      }

    } else if (mode === 'append') {
      upperOffset.current += count
      const next = [...prev, ...data.messages]
      const seen = new Set<string>()
      const deduped = next.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
      if (deduped.length > MAX_DOM) {
        const excess = deduped.length - MAX_DOM
        const culled = deduped.slice(-MAX_DOM)

        // Step 1: append only — no scroll adjustment (new content appears below viewport)
        flushSync(() => applyMessages(deduped))

        // Step 2: cull top only if user is safely above the culled region.
        // Estimate culled height proportionally; if scrollTop < culledH, skip to avoid clamping.
        const el = chatRef.current
        const prevH2 = el?.scrollHeight ?? 0
        const prevTop2 = el?.scrollTop ?? 0
        const estCullH = Math.round(prevH2 * excess / deduped.length)
        if (prevTop2 > estCullH) {
          lowerOffset.current += excess
          flushSync(() => applyMessages(culled))
          if (el) el.scrollTop = prevTop2 + el.scrollHeight - prevH2
        }
        // else: skip cull — DOM temporarily > MAX_DOM; will cull on next append
      } else {
        applyMessages(deduped)
      }
    } else {
      upperOffset.current = lowerOffset.current + count
      applyMessages(data.messages)
      if (chatRef.current) chatRef.current.scrollTop = 0
    }
  }

  async function loadOlder() {
    if (lowerOffset.current === 0) return
    lowerOffset.current = Math.max(0, lowerOffset.current - LIMIT)
    try { await loadMessages('prepend') } catch { lowerOffset.current += LIMIT }
  }

  async function loadNewer() {
    await loadMessages('append')
  }

  // ─── Jump ────────────────────────────────────────────────────────────────────

  async function jumpToDate(date: string) {
    setCurrentTab('chat')
    const d = await apiFetch<{ index: number | null }>('/api/jump?date=' + date)
    if (d.index == null) return
    lowerOffset.current = Math.max(0, d.index - Math.floor(LIMIT / 2))
    upperOffset.current = lowerOffset.current
    searchRef.current = ''; setSearchInput('')
    await loadMessages('fresh')
  }

  async function jumpToMessage(ts: number, msgId: string | null) {
    setCurrentTab('chat')
    const url = msgId ? `/api/jump?msgId=${msgId}` : `/api/jump?date=${new Date(ts).toISOString()}`
    const d = await apiFetch<{ index: number | null }>(url)
    if (d.index == null) return
    lowerOffset.current = Math.max(0, d.index - Math.floor(LIMIT / 2))
    upperOffset.current = lowerOffset.current
    searchRef.current = ''; setSearchInput('')
    if (msgId) pendingJump.current = msgId
    await loadMessages('fresh')
  }

  // ─── Scroll handler ──────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    const el = chatRef.current
    if (!el) return

    // Sticky date
    const chatTop = el.getBoundingClientRect().top
    let sticky = ''
    for (const sep of el.querySelectorAll<HTMLElement>('.dsep')) {
      if (sep.getBoundingClientRect().top <= chatTop + 2) sticky = sep.textContent?.trim() ?? ''
      else break
    }
    setStickyDate(sticky)

    // Bookmark
    const id = deviceId.current
    if (id && !searchRef.current) {
      const now = Date.now()
      if (now - lastBookmarkTime.current >= 300) {
        lastBookmarkTime.current = now
        for (const g of el.querySelectorAll<HTMLElement>('.msg-group')) {
          const rect = g.getBoundingClientRect()
          if (rect.bottom > chatTop) {
            fetch('/api/bookmark', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ msgId: g.dataset.id, offset: Math.max(0, rect.top - chatTop), deviceId: id }) }).catch(() => {})
            break
          }
        }
      }
    }

    // Infinite scroll — queue next load if one is already in progress
    const nearTop    = el.scrollTop < LOAD_THRESHOLD && lowerOffset.current > 0
    const nearBottom = el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && hasMoreRef.current

    if (loadingRef.current || searchRef.current) {
      if (nearTop)    queuedLoad.current = 'older'
      if (nearBottom) queuedLoad.current = 'newer'
      return
    }

    const run = (fn: () => Promise<void>) => {
      loadingRef.current = true
      fn().finally(async () => {
        const queued = queuedLoad.current
        queuedLoad.current = null
        // Re-check scroll position — the prepend may have moved us far from the edge
        const qel = chatRef.current
        const stillNearTop    = qel && qel.scrollTop < LOAD_THRESHOLD && lowerOffset.current > 0
        const stillNearBottom = qel && qel.scrollTop + qel.clientHeight > qel.scrollHeight - LOAD_THRESHOLD && hasMoreRef.current
        if (queued === 'older' && stillNearTop)    { await loadOlder().catch(() => {}) }
        else if (queued === 'newer' && stillNearBottom) { await loadNewer().catch(() => {}) }
        loadingRef.current = false
      })
    }

    if (nearTop)         run(loadOlder)
    else if (nearBottom) run(loadNewer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let id = localStorage.getItem('deviceId')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id) }
    deviceId.current = id

    fetch('/api/users/me').then(r => r.json()).then(d => { if (d?.user?.name) setCurrentUser(d.user.name) }).catch(() => {})
    reloadHashtags()

    async function init() {
      let startIdx = 0, anchorMsgId: string | null = null, anchorOffset = 0
      try {
        const bk = await apiFetch<{ msgId: string | null; offset: number }>('/api/bookmark?deviceId=' + id)
        if (bk.msgId) {
          anchorMsgId = bk.msgId; anchorOffset = bk.offset ?? 0
          const jd = await apiFetch<{ index: number | null }>('/api/jump?msgId=' + bk.msgId)
          if (jd.index != null) startIdx = jd.index
        }
      } catch {}

      lowerOffset.current = Math.max(0, startIdx - Math.floor(LIMIT / 2))
      upperOffset.current = lowerOffset.current
      try { await loadMessages('fresh') } catch {}

      loadingRef.current = true // block scroll handler during restoration
      if (anchorMsgId && chatRef.current) {
        const anchor = document.getElementById('msg-' + anchorMsgId)?.closest<HTMLElement>('.msg-group')
        if (anchor) {
          chatRef.current.scrollTop = 0
          chatRef.current.scrollTop = anchor.getBoundingClientRect().top - chatRef.current.getBoundingClientRect().top - anchorOffset
        }
      }
      setChatVisible(true)
      loadingRef.current = false

      // Preload in whichever direction the restored position is close to the edge.
      // Keep loadingRef true throughout so the scroll handler doesn't double-fire.
      const el = chatRef.current
      if (el) {
        loadingRef.current = true
        if (el.scrollTop < LOAD_THRESHOLD && lowerOffset.current > 0) {
          await loadOlder().catch(() => {})
        }
        if (el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && hasMoreRef.current) {
          await loadNewer().catch(() => {})
        }
        loadingRef.current = false
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Search ──────────────────────────────────────────────────────────────────

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function handleSearchChange(v: string) {
    setSearchInput(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      searchRef.current = v.trim()
      lowerOffset.current = 0; upperOffset.current = 0
      setSearching(!!v.trim())
      await loadMessages('fresh')
      setSearching(false)
    }, 350)
  }

  // ─── Date jump ───────────────────────────────────────────────────────────────

  async function handleDateJump(date: string) {
    if (!date) return
    const d = await apiFetch<{ index: number | null }>('/api/jump?date=' + date)
    if (d.index == null) return
    lowerOffset.current = Math.max(0, d.index - Math.floor(LIMIT / 2))
    upperOffset.current = lowerOffset.current
    searchRef.current = ''; setSearchInput('')
    await loadMessages('fresh')
  }

  // ─── Selection ───────────────────────────────────────────────────────────────

  async function handleToggle(id: string, ts: number, tsEnd: number, allIds: string[], blockId: string, shiftKey?: boolean) {
    if (shiftKey && lastSelectedAnchor.current) {
      const anchor = lastSelectedAnchor.current
      const anchorIdx = blocks.findIndex(b => b.msgs[0]._id === anchor.id)
      const clickedIdx = blocks.findIndex(b => b.msgs[0]._id === id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        // Both visible in DOM — fast path
        const [start, end] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (let i = start; i <= end; i++) {
            const b = blocks[i]
            const f = b.msgs[0]
            const l = b.msgs[b.msgs.length - 1]
            next.set(f._id, { ts: f.timestamp_ms, tsEnd: l.timestamp_ms, allIds: b.msgs.map(m => m._id), blockId: f.blockId ?? f._id })
          }
          return next
        })
      } else {
        // One or both blocks scrolled out of DOM — fetch full range by timestamp
        const minTs = Math.min(anchor.ts, ts)
        const maxTs = Math.max(anchor.tsEnd, tsEnd)
        const data = await apiFetch<{ messages: Message[] }>(`/api/messages?tsFrom=${minTs}&tsTo=${maxTs}`)
        const rangeBlocks = groupMessages(data.messages)
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (const b of rangeBlocks) {
            const f = b.msgs[0]
            const l = b.msgs[b.msgs.length - 1]
            next.set(f._id, { ts: f.timestamp_ms, tsEnd: l.timestamp_ms, allIds: b.msgs.map(m => m._id), blockId: f.blockId ?? f._id })
          }
          return next
        })
      }
      return
    }
    lastSelectedAnchor.current = { id, ts, tsEnd }
    setSelectedMsgs(prev => {
      const next = new Map(prev)
      next.has(id) ? next.delete(id) : next.set(id, { ts, tsEnd, allIds, blockId })
      return next
    })
  }

  function clearSelection() {
    setSelectedMsgs(new Map())
    lastSelectedAnchor.current = null
  }

  function openNoteFromSelection() {
    const values = [...selectedMsgs.values()]
    const allIds = [...new Set(values.flatMap(v => v.allIds))]
    const blockIds = [...new Set(values.map(v => v.blockId).filter(Boolean))]
    setHashtagPicker({ msgIds: allIds, blockIds })
  }

  async function applyHashtags(hashtagIds: string[], newNames: string[]) {
    const blockIds = hashtagPicker?.blockIds ?? []

    // Close modal immediately — API work runs in the background
    setHashtagPicker(null)
    clearSelection()

    const tagBlocks = (hashtagId: string) =>
      fetch('/api/hashtag-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtagId, blockIds }),
      })

    ;(async () => {
      await Promise.all(hashtagIds.map(tagBlocks))
      await Promise.all(newNames.map(async name => {
        const alreadyExists = hashtags.find(h => h.name === name)
        const id = alreadyExists
          ? alreadyExists.id
          : await fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
              .then(r => r.json()).then(d => d.doc?.id)
        if (id) await tagBlocks(id)
      }))
      reloadHashtags()
    })()
  }

  // ─── Resizer ─────────────────────────────────────────────────────────────────

  const resizerData = useRef({ startX: 0, startW: 0, dragging: false })
  function onResizerDown(e: React.MouseEvent) {
    const pane = document.getElementById('notes-pane')!
    resizerData.current = { startX: e.clientX, startW: pane.offsetWidth, dragging: true }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!resizerData.current.dragging) return
      const delta = resizerData.current.startX - e.clientX
      const w = Math.max(220, Math.min(window.innerWidth * 0.6, resizerData.current.startW + delta))
      setNotesWidth(w + 'px')
    }
    const up = () => { resizerData.current.dragging = false; document.body.style.userSelect = ''; document.body.style.cursor = '' }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  }, [])

  // ─── Message blocks (memoized) ───────────────────────────────────────────────

  const blocks = useMemo(() => groupMessages(messages), [messages])

  // ─── Context menu ────────────────────────────────────────────────────────────

  function handleNoteContextMenu(e: React.MouseEvent, note: Note) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'note', note })
  }

  function handleGalleryContextMenu(e: React.MouseEvent, item: GalleryItem) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'gallery', galTs: String(item.ts), galMsgId: item.msgId ?? null })
  }

  function handleMsgContextMenu(e: React.MouseEvent, msgIds: string[]) {
    e.preventDefault()
    const selectedMsgsData = messagesRef.current.filter(m => msgIds.includes(m._id))
    const blockIds = toBlockIds(selectedMsgsData, messagesRef.current)
    setHashtagPicker({ msgIds, blockIds })
  }

  // ─── Tabs ────────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat',   label: 'Chat' },
    { key: 'photos', label: 'Photos (4,955)' },
    { key: 'videos', label: 'Videos (155)' },
    { key: 'files',  label: 'Files & Audio' },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="font-sans bg-white h-screen flex flex-col overflow-hidden">

      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center gap-2.5 shadow-md z-10 flex-shrink-0">
        <input type="date" id="date-jump" min="2016-07-14" max="2024-05-09" title="Jump to date"
          onChange={e => handleDateJump(e.target.value)}
          className="px-2.5 py-1.5 rounded bg-white/20 text-white text-xs border-none outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:invert" />
        <input type="search" value={searchInput} onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search messages…"
          className="px-3.5 py-1.5 rounded-full bg-white/20 text-white w-[200px] text-[13px] outline-none placeholder:text-white/65 focus:bg-white/30" />
        <span className="text-xs text-white/75 whitespace-nowrap">{total > 0 ? `${total.toLocaleString()} messages` : ''}</span>
        <span className="flex-1" />
        {currentUser && <span className="text-xs text-white/75">{currentUser}</span>}
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b-2 border-gray-200 flex-shrink-0">
        {tabs.map(t => (
          <div key={t.key} onClick={() => setCurrentTab(t.key)}
            className={`px-5 py-2.5 cursor-pointer text-[13px] font-semibold border-b-[3px] -mb-px select-none transition-colors hover:bg-gray-100 ${currentTab === t.key ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 overflow-hidden flex flex-row min-h-0">

        {/* Chat pane */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">

          {/* Sticky date */}
          {stickyDate && (
            <div className="absolute top-2 left-0 right-0 flex justify-center z-10 pointer-events-none">
              <span className="bg-white/93 border border-gray-200 rounded-full px-4 py-0.5 text-xs text-[#616061] font-semibold shadow-sm">{stickyDate}</span>
            </div>
          )}

          {/* Selection bar */}
          {selectedMsgs.size > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full px-4 py-2 flex items-center gap-3 text-[13px] whitespace-nowrap shadow-xl z-20">
              <span>{selectedMsgs.size} message{selectedMsgs.size > 1 ? 's' : ''} selected</span>
              <button onClick={openNoteFromSelection} className="bg-blue-600 px-3.5 py-1 rounded-full text-[13px] font-semibold"># Tag</button>
              <button onClick={clearSelection} className="opacity-80 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Chat scroll */}
          <div
            ref={chatRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-y-auto flex flex-col min-h-0${selectedMsgs.size > 0 ? ' select-none' : ''}`}
            style={{ visibility: chatVisible ? 'visible' : 'hidden' }}
          >
            {searching && <div className="text-center py-2 text-[13px] text-gray-500">Searching…</div>}
            {currentTab === 'chat' && blocks.map((b, i) => (
              <MessageGroup
                key={b.msgs[0]._id ?? i}
                block={b}
                isSelected={selectedMsgs.has(b.msgs[0]._id)}
                onToggle={handleToggle}
                onLightbox={setLightbox}
                onContextMenu={handleMsgContextMenu}
              />
            ))}
            {currentTab === 'photos' && <Gallery type="photos" onLightbox={setLightbox} onContextMenu={handleGalleryContextMenu} />}
            {currentTab === 'videos' && <Gallery type="videos" onLightbox={setLightbox} onContextMenu={handleGalleryContextMenu} />}
            {currentTab === 'files'  && <FilesView />}
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onResizerDown}
          className="w-[5px] bg-gray-200 cursor-col-resize flex-shrink-0 hover:bg-blue-600 transition-colors"
        />

        {/* Hashtags pane */}
        <div id="notes-pane" className="flex flex-col min-h-0 flex-shrink-0 overflow-hidden" style={{ width: notesWidth }}>
          <HashtagsPane hashtags={hashtags} onReload={reloadHashtags} onJumpToMessage={jumpToMessage} />
        </div>
      </div>

      {/* Overlays */}
      {hashtagPicker && (
        <HashtagPicker
          hashtags={hashtags}
          blockIds={hashtagPicker.blockIds}
          onClose={() => setHashtagPicker(null)}
          onApply={applyHashtags}
        />
      )}
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
      {ctxMenu  && (
        <ContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onEditNote={() => setCtxMenu(null)}
          onJumpToMessage={(ts, msgId) => { jumpToMessage(+ts, msgId); setCtxMenu(null) }}
        />
      )}
    </div>
  )
}
