'use client'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { Message, Note, Tab, LightboxState, CtxMenuState, GalleryItem } from '@/types'
import { LIMIT, MAX_DOM, LOAD_THRESHOLD } from '@/lib/constants'
import { groupMessages } from '@/lib/groupMessages'
import MessageGroup from './MessageGroup'
import NotesPane from './NotesPane'
import NoteModal from './NoteModal'
import Gallery from './Gallery'
import FilesView from './FilesView'
import Lightbox from './Lightbox'
import ContextMenu from './ContextMenu'

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
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

  // Notes
  const [allNotes, setAllNotes]   = useState<Note[]>([])
  const [noteModal, setNoteModal] = useState<{ note: Note | null; msgIds: string[] } | null>(null)

  // Selection
  const [selectedMsgs, setSelectedMsgs] = useState(new Map<string, { ts: number; tsEnd: number }>())

  // UI overlays
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [ctxMenu, setCtxMenu]   = useState<CtxMenuState | null>(null)

  // Notes pane width (resizable)
  const [notesWidth, setNotesWidth] = useState('50%')

  // Refs
  const chatRef       = useRef<HTMLDivElement>(null)
  const deviceId      = useRef('')
  const bkLast        = useRef(0)
  const didPrepend    = useRef(false)
  const scrollBefore  = useRef({ h: 0, top: 0 })

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const setMsg = (msgs: Message[]) => {
    const seen = new Set<string>()
    const deduped = msgs.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
    messagesRef.current = deduped
    setMessages(deduped)
  }

  const reloadNotes = useCallback(async () => {
    const d = await apiFetch<{ docs: Note[] }>('/api/notes?limit=500&sort=start&depth=1')
    setAllNotes(d.docs ?? [])
  }, [])

  // ─── Scroll preservation for prepend ────────────────────────────────────────

  useLayoutEffect(() => {
    if (didPrepend.current && chatRef.current) {
      chatRef.current.scrollTop = scrollBefore.current.top + chatRef.current.scrollHeight - scrollBefore.current.h
      didPrepend.current = false
    }
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
      if (chatRef.current) {
        scrollBefore.current = { h: chatRef.current.scrollHeight, top: chatRef.current.scrollTop }
        didPrepend.current = true
      }
      const next = [...data.messages, ...prev]
      if (next.length > MAX_DOM) { upperOffset.current -= next.length - MAX_DOM; setMsg(next.slice(0, MAX_DOM)) }
      else setMsg(next)
    } else if (mode === 'append') {
      upperOffset.current += count
      setMessages(cur => {
        const next = [...cur, ...data.messages]
        const seen = new Set<string>()
        const deduped = next.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
        if (deduped.length > MAX_DOM) { lowerOffset.current += deduped.length - MAX_DOM; messagesRef.current = deduped.slice(-MAX_DOM); return deduped.slice(-MAX_DOM) }
        messagesRef.current = deduped; return deduped
      })
    } else {
      upperOffset.current = lowerOffset.current + count
      setMsg(data.messages)
      if (chatRef.current) chatRef.current.scrollTop = 0
    }
  }

  async function loadOlder() {
    if (lowerOffset.current === 0) return
    lowerOffset.current = Math.max(0, lowerOffset.current - LIMIT)
    try { await loadMessages('prepend') } catch { lowerOffset.current += LIMIT }
  }

  async function loadNewer() {
    try { await loadMessages('append') } catch (e) { console.error('loadNewer failed:', e) }
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
    await loadMessages('fresh')
    if (!msgId) return
    const anchor = document.getElementById('msg-' + msgId)?.closest<HTMLElement>('.msg-group')
    if (!anchor) return
    anchor.scrollIntoView({ block: 'center' })
    anchor.style.background = '#fff3cd'
    setTimeout(() => { anchor.style.transition = 'background 1s'; anchor.style.background = '' }, 800)
    setTimeout(() => { anchor.style.transition = '' }, 1800)
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
      if (now - bkLast.current >= 300) {
        bkLast.current = now
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

    // Infinite scroll
    if (loadingRef.current || searchRef.current) return
    if (el.scrollTop < LOAD_THRESHOLD && lowerOffset.current > 0) {
      loadingRef.current = true
      loadOlder().finally(() => { loadingRef.current = false })
    } else if (el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && hasMoreRef.current) {
      loadingRef.current = true
      loadNewer().finally(() => { loadingRef.current = false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let id = localStorage.getItem('deviceId')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id) }
    deviceId.current = id

    fetch('/api/users/me').then(r => r.json()).then(d => { if (d?.user?.name) setCurrentUser(d.user.name) }).catch(() => {})
    reloadNotes()

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
      try { await loadMessages('fresh') } catch (e) { console.error(e) }

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

      const el = chatRef.current
      if (el && el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && hasMoreRef.current) {
        loadingRef.current = true
        loadNewer().finally(() => { loadingRef.current = false })
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

  function handleToggle(id: string, ts: number, tsEnd: number) {
    setSelectedMsgs(prev => {
      const next = new Map(prev)
      next.has(id) ? next.delete(id) : next.set(id, { ts, tsEnd })
      return next
    })
  }

  function clearSelection() {
    setSelectedMsgs(new Map())
  }

  function openNoteFromSelection() {
    const vals = [...selectedMsgs.values()]
    const pad = (n: number) => String(n).padStart(2, '0')
    const toLocal = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
    const firstTs = Math.min(...vals.map(v => v.ts))
    const lastTs  = Math.max(...vals.map(v => v.tsEnd))
    setNoteModal({ note: { id: '', start: toLocal(firstTs), end: toLocal(lastTs), title: '', tags: [] }, msgIds: [...selectedMsgs.keys()] })
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
              <button onClick={openNoteFromSelection} className="bg-blue-600 px-3.5 py-1 rounded-full text-[13px] font-semibold">📝 Note</button>
              <button onClick={clearSelection} className="opacity-80 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Chat scroll */}
          <div
            ref={chatRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto flex flex-col min-h-0"
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

        {/* Notes pane */}
        <div id="notes-pane" className="flex flex-col min-h-0 flex-shrink-0 overflow-hidden" style={{ width: notesWidth }}>
          <NotesPane
            notes={allNotes}
            onEdit={note => setNoteModal({ note, msgIds: (note.msgIds ?? '').split(',').filter(Boolean) })}
            onNew={() => setNoteModal({ note: null, msgIds: [] })}
            onJumpToDate={jumpToDate}
            onJumpToMessage={msgId => jumpToMessage(0, msgId)}
            onContextMenu={handleNoteContextMenu}
          />
        </div>
      </div>

      {/* Overlays */}
      {noteModal && (
        <NoteModal
          note={noteModal.note?.id ? noteModal.note : null}
          msgIds={noteModal.msgIds}
          onClose={() => { setNoteModal(null); clearSelection() }}
          onSaved={reloadNotes}
        />
      )}
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
      {ctxMenu  && (
        <ContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onEditNote={note => { setNoteModal({ note, msgIds: (note.msgIds ?? '').split(',').filter(Boolean) }); setCtxMenu(null) }}
          onJumpToMessage={(ts, msgId) => { jumpToMessage(+ts, msgId); setCtxMenu(null) }}
        />
      )}
    </div>
  )
}
