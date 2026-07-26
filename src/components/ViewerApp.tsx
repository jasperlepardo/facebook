'use client'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { Message, Note, Tab, LightboxState, ContextMenuState, GalleryItem, Hashtag, DateIndex } from '@/types'
import { LIMIT, MAX_DOM, LOAD_THRESHOLD } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'
import { r2 } from '@/lib/format'
import { groupMessages } from '@/lib/groupMessages'
import MessageGroup, { DateMenu } from './MessageGroup'
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
  const [jumping,   setJumping]   = useState(false)
  const lowerOffset = useRef(0)
  const upperOffset = useRef(0)
  const loadingRef  = useRef(false)
  const hasMoreRef  = useRef(false)

  // Media counts
  const [mediaCounts, setMediaCounts] = useState<{ photos: number; videos: number; files: number }>({ photos: 0, videos: 0, files: 0 })

  // UI
  const [currentTab, setCurrentTab]   = useState<Tab>('chat')
  const [searchInput, setSearchInput] = useState('')
  const searchRef   = useRef('')
  const [chatVisible, setChatVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState('')

  // Date index (loaded once on mount for DateMenu navigation)
  const [dateIndex, setDateIndex] = useState<DateIndex | null>(null)

  // Hashtags
  const [hashtags, setHashtags]         = useState<Hashtag[]>([])
  const [hashtagPicker, setHashtagPicker] = useState<{ msgIds: string[]; blockIds: string[] } | null>(null)

  // Selection
  const [selectedMsgs, setSelectedMsgs] = useState(new Map<string, { ts: number; tsEnd: number; allIds: string[]; blockId: string }>())
  const lastSelectedAnchor = useRef<{ id: string; ts: number; tsEnd: number } | null>(null)
  const [preloadedHashtagIds, setPreloadedHashtagIds] = useState<Set<string> | null>(null)
  const preloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // UI overlays
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [ctxMenu, setCtxMenu]   = useState<ContextMenuState | null>(null)

  // Notes pane width (resizable)
  const [notesWidth, setNotesWidth] = useState('50%')

  // Refs
  const chatRef       = useRef<HTMLDivElement>(null)
  const deviceId      = useRef('')
  const lastBookmarkTime = useRef(0)
  const pendingJump         = useRef<string | null>(null)
  const pendingScrollReset  = useRef(false)
  const pendingLightboxScroll = useRef<string | null>(null)
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

  // ─── Scroll chat to current lightbox photo in background ───────────────────

  useEffect(() => {
    const msgId = lightbox?.msgId
    if (!msgId || !chatRef.current) return
    const anchor = document.getElementById('msg-' + msgId)?.closest<HTMLElement>('.msg-group')
    if (anchor) {
      anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else {
      pendingLightboxScroll.current = msgId
      apiFetch<{ index: number | null }>(`/api/jump?msgId=${msgId}`)
        .then(d => {
          if (d.index == null) return
          lowerOffset.current = Math.max(0, d.index - Math.floor(LIMIT / 2))
          upperOffset.current = lowerOffset.current
          loadMessages('fresh').catch(() => {})
        }).catch(() => {})
    }
  }, [lightbox?.msgId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Scroll to pending jump target after messages render ────────────────────

  useEffect(() => {
    // After a fresh date-jump, override any scroll-anchor adjustment the browser made
    if (pendingScrollReset.current) {
      pendingScrollReset.current = false
      if (chatRef.current) chatRef.current.scrollTop = 0
      return
    }
    // Pending jump (chat navigation)
    const jumpId = pendingJump.current
    if (jumpId) {
      const anchor = document.getElementById('msg-' + jumpId)?.closest<HTMLElement>('.msg-group')
      if (anchor) {
        pendingJump.current = null
        anchor.scrollIntoView({ block: 'center' })
        anchor.style.background = '#fff3cd'
        setTimeout(() => { anchor.style.transition = 'background 1s'; anchor.style.background = '' }, 800)
        setTimeout(() => { anchor.style.transition = '' }, 1800)
      }
    }
    // Pending lightbox background scroll
    const scrollId = pendingLightboxScroll.current
    if (scrollId) {
      const anchor = document.getElementById('msg-' + scrollId)?.closest<HTMLElement>('.msg-group')
      if (anchor) {
        pendingLightboxScroll.current = null
        anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
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

    const chatTop = el.getBoundingClientRect().top

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
    apiFetch<DateIndex>('/api/date-index').then(setDateIndex).catch(() => {})

    Promise.all(['photos', 'videos', 'files'].map(t =>
      apiFetch<{ total: number }>(`/api/attachments?type=${t}&limit=1`).then(d => ({ t, n: d.total ?? 0 })).catch(() => ({ t, n: 0 }))
    )).then(results => {
      const c = Object.fromEntries(results.map(r => [r.t, r.n])) as { photos: number; videos: number; files: number }
      setMediaCounts(c)
    })

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
      const trimmed = v.trim()

      // Block ID / message ID jump — 24-char hex ObjectId
      if (/^[0-9a-f]{24}$/i.test(trimmed)) {
        setSearching(true)
        // Try as blockId first, fall back to _id
        const byBlock = await apiFetch<{ messages: Message[] }>(`/api/messages?groupIds=${trimmed}`)
        const msgs = byBlock.messages.length
          ? byBlock.messages
          : (await apiFetch<{ messages: Message[] }>(`/api/messages?ids=${trimmed}`)).messages
        if (msgs.length) {
          searchRef.current = ''
          lowerOffset.current = 0; upperOffset.current = 0
          setMessages(msgs)
          messagesRef.current = msgs
          pendingJump.current = msgs[0]._id
        }
        setSearchInput(trimmed)
        setSearching(false)
        return
      }

      searchRef.current = trimmed
      lowerOffset.current = 0; upperOffset.current = 0
      setSearching(!!trimmed)
      await loadMessages('fresh')
      setSearching(false)
    }, 350)
  }

  // ─── Date jump ───────────────────────────────────────────────────────────────

  async function handleDateJump(date: string) {
    if (!date) return
    setJumping(true)
    try {
      let offset: number | null = null

      if (date.startsWith('ts:')) {
        // Exact message timestamp from an adjacent rendered block — resolve without API call
        const ts = parseInt(date.slice(3))
        const msgIdx = messagesRef.current.findIndex(m => m.timestamp_ms === ts)
        if (msgIdx !== -1) {
          offset = lowerOffset.current + msgIdx
        } else {
          // Message scrolled out of window — fall back to API with exact timestamp
          const d = await apiFetch<{ index: number | null }>(`/api/jump?date=${new Date(ts).toISOString()}`)
          offset = d.index
        }
      } else {
        // YYYY-MM-DD ISO: check pre-computed index (days, weeks, months)
        offset = dateIndex
          ? (dateIndex.days.find(d => d.iso === date) ?? dateIndex.weeks.find(w => w.iso === date) ?? dateIndex.months.find(m => m.iso === date))?.offset ?? null
          : null
        if (offset == null) {
          const d = await apiFetch<{ index: number | null }>('/api/jump?date=' + date)
          offset = d.index
        }
      }

      if (offset == null) return
      lowerOffset.current = offset
      upperOffset.current = offset
      searchRef.current = ''; setSearchInput('')
      pendingScrollReset.current = true
      await loadMessages('fresh')

    } finally {
      setJumping(false)
    }
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
    setPreloadedHashtagIds(null)
  }

  // Preload hashtag membership whenever the selection settles
  useEffect(() => {
    clearTimeout(preloadTimer.current)
    if (selectedMsgs.size === 0) { setPreloadedHashtagIds(null); return }
    const blockIds = [...new Set([...selectedMsgs.values()].map(v => v.blockId).filter(Boolean))]
    preloadTimer.current = setTimeout(() => {
      fetch(`/api/hashtag-groups?blockIds=${blockIds.join(',')}`)
        .then(r => r.json())
        .then(d => setPreloadedHashtagIds(new Set<string>(d.hashtagIds ?? [])))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(preloadTimer.current)
  }, [selectedMsgs])

  function openNoteFromSelection() {
    const values = [...selectedMsgs.values()]
    const allIds = [...new Set(values.flatMap(v => v.allIds))]
    const blockIds = [...new Set(values.map(v => v.blockId).filter(Boolean))]
    setHashtagPicker({ msgIds: allIds, blockIds })
  }

  function applyHashtags(hashtagIds: string[], newNames: string[]) {
    const blockIds     = hashtagPicker?.blockIds ?? []
    const snapHashtags = hashtags

    setHashtagPicker(null)
    clearSelection()

    const tagBlocks = (hashtagId: string) =>
      fetch('/api/hashtag-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtagId, blockIds }),
      })

    // Create new hashtags first, then tag all blocks, then reload
    Promise.all(newNames.map(name => {
      const existing = snapHashtags.find(h => h.name === name)
      if (existing) return Promise.resolve(existing.id as string | undefined)
      return fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        .then(r => r.json()).then(d => d.doc?.id as string | undefined)
    }))
      .then(ids => Promise.all([...hashtagIds, ...ids.filter((id): id is string => !!id)].map(tagBlocks)))
      .then(() => reloadHashtags())
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

  // ─── Lightbox with chat navigation ──────────────────────────────────────────

  async function handleMsgLightbox(state: LightboxState) {
    if (!state.ts) { setLightbox(state); return }

    const mtype = state.mediaType ?? 'photos'
    // Find document offset of this item in the full sorted media list
    const { offset: docOff } = await apiFetch<{ offset: number }>(
      `/api/attachments?type=${mtype}&offsetOf=${state.ts}`
    )
    const { items, total } = await apiFetch<{ items: { uri: string; ts: number; sender: string; msgId: string }[]; total: number }>(
      `/api/attachments?type=${mtype}&offset=${Math.max(0, docOff - 1)}&limit=3`
    )
    const baseOff  = Math.max(0, docOff - 1)
    const localIdx = items.findIndex(i => i.msgId === state.msgId || i.ts === state.ts)
    const target   = localIdx >= 0 ? localIdx : 0

    type PhotoItem = { uri: string; ts: number; sender: string; msgId: string }

    const typeMap: Record<string, LightboxState['type']> = { photos: 'photo', videos: 'video', gifs: 'gif' }

    const mkState = (absOff: number, item: PhotoItem): LightboxState => ({
      src:       r2(item.uri),
      type:      typeMap[mtype] ?? 'photo',
      mediaType: mtype,
      caption:   `${new Date(item.ts).toLocaleDateString()} · ${item.sender}`,
      msgId:     item.msgId,
      ts:        item.ts,
      onPrev:  absOff > 0
        ? async () => {
            const { items: pi } = await apiFetch<{ items: PhotoItem[] }>(
              `/api/attachments?type=${mtype}&offset=${absOff - 1}&limit=1`
            )
            if (pi[0]) setLightbox(mkState(absOff - 1, pi[0]))
          }
        : undefined,
      onNext:  absOff < total - 1
        ? async () => {
            const { items: ni } = await apiFetch<{ items: PhotoItem[] }>(
              `/api/attachments?type=${mtype}&offset=${absOff + 1}&limit=1`
            )
            if (ni[0]) setLightbox(mkState(absOff + 1, ni[0]))
          }
        : undefined,
    })

    setLightbox(mkState(baseOff + target, items[target]))
  }

  // ─── Tabs ────────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'chat',   label: 'Chat' },
    { key: 'photos', label: `Photos${mediaCounts.photos ? ` (${mediaCounts.photos.toLocaleString()})` : ''}` },
    { key: 'videos', label: `Videos${mediaCounts.videos ? ` (${mediaCounts.videos.toLocaleString()})` : ''}` },
    { key: 'files',  label: `Files & Audio${mediaCounts.files ? ` (${mediaCounts.files.toLocaleString()})` : ''}` },
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

          {/* Selection bar */}
          {selectedMsgs.size > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full px-4 py-2 flex items-center gap-3 text-[13px] whitespace-nowrap shadow-xl z-20">
              <span>{selectedMsgs.size} message{selectedMsgs.size > 1 ? 's' : ''} selected</span>
              <button onClick={openNoteFromSelection} className="bg-blue-600 px-3.5 py-1 rounded-full text-[13px] font-semibold"># Tag</button>
              <button onClick={clearSelection} className="opacity-80 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Date-jump loading overlay */}
          {jumping && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 backdrop-blur-[2px] pointer-events-none">
              <div className="flex items-center gap-2 bg-white border border-gray-200 shadow-md rounded-full px-4 py-2 text-[13px] text-gray-600">
                <svg className="animate-spin w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Loading…
              </div>
            </div>
          )}

          {/* Chat scroll */}
          <div
            ref={chatRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-y-auto flex flex-col min-h-0 [overflow-anchor:none]${selectedMsgs.size > 0 ? ' select-none' : ''}`}
            style={{ visibility: chatVisible ? 'visible' : 'hidden' }}
          >
            {searching && <div className="text-center py-2 text-[13px] text-gray-500">Searching…</div>}
            {currentTab === 'chat' && (() => {
              const jumpTo = async (target: string) => {
                if (target === 'recent') {
                  const d = await apiFetch<{ total: number }>('/api/messages?offset=0&limit=1&asc=1')
                  lowerOffset.current = Math.max(0, d.total - LIMIT)
                  upperOffset.current = lowerOffset.current
                  loadMessages('fresh')
                }
                else if (target === 'beginning')  { lowerOffset.current = 0; upperOffset.current = 0; loadMessages('fresh') }
                else handleDateJump(target)
              }
              // Group blocks into day sections so sticky headers push each other
              const days: { date: string; blocks: typeof blocks }[] = []
              for (const b of blocks) {
                if (b.newDate) days.push({ date: b.date, blocks: [] })
                days[days.length - 1]?.blocks.push(b)
              }
              return days.map((day, dayIdx) => (
                <div key={day.date + day.blocks[0].msgs[0]._id}
                  id={`day-${new Date(Number(day.blocks[0].msgs[0].timestamp_ms)).toISOString().split('T')[0]}`}
                  className="flex flex-col">
                  <div className="dsep sticky top-0 z-10 flex items-center py-1.5 bg-white/90 backdrop-blur-sm text-xs text-[#616061]">
                    <span className="flex-1 border-t border-gray-200" />
                    <DateMenu
                      date={day.date}
                      ts={day.blocks[0].msgs[0].timestamp_ms}
                      prevDayTs={dayIdx > 0 ? days[dayIdx - 1].blocks[0].msgs[0].timestamp_ms : undefined}
                      nextDayTs={dayIdx < days.length - 1 ? days[dayIdx + 1].blocks[0].msgs[0].timestamp_ms : undefined}
                      dateIndex={dateIndex}
                      onJumpTo={jumpTo}
                    />
                    <span className="flex-1 border-t border-gray-200" />
                  </div>
                  {day.blocks.map((b, i) => (
                    <MessageGroup
                      key={b.msgs[0]._id ?? i}
                      block={b}
                      isSelected={selectedMsgs.has(b.msgs[0]._id)}
                      onToggle={handleToggle}
                      onLightbox={handleMsgLightbox}
                      onContextMenu={handleMsgContextMenu}
                    />
                  ))}
                </div>
              ))
            })()}
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
          initialSelected={preloadedHashtagIds ?? undefined}
          onClose={() => setHashtagPicker(null)}
          onApply={applyHashtags}
        />
      )}
      {lightbox && <Lightbox state={lightbox}
        onClose={() => {
          const { ts, msgId } = lightbox
          setLightbox(null)
          if (currentTab === 'chat' && msgId && !document.getElementById('msg-' + msgId)) jumpToMessage(Number(ts), msgId)
        }}
        onJumpToMessage={(ts, msgId) => { setLightbox(null); jumpToMessage(ts, msgId) }}
      />}
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
