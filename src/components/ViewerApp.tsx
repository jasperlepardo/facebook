'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { Message, Section, MediaTab, LightboxState, ContextMenuState, GalleryItem, Hashtag, DateIndex } from '@/types'
import { LIMIT, MAX_DOM, LOAD_THRESHOLD } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'
import { r2 } from '@/lib/format'
import { groupMessages } from '@/lib/groupMessages'
import MessageList from './MessageList'
import HashtagsPane from './HashtagsPane'
import HashtagPicker from './HashtagPicker'
import Gallery from './Gallery'
import FilesView from './FilesView'
import Lightbox from './Lightbox'
import ContextMenu from './ContextMenu'
import ActionSheet from './ActionSheet'
import SettingsPane from './SettingsPane'
import AppHeader from './AppHeader'
import AppNav from './AppNav'
import DatePickerModal from './DatePickerModal'

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

  // Navigation — default to 'chat' for SSR, then correct from URL after hydration
  const [section, setSection]     = useState<Section>('chat')
  const [mediaTab, setMediaTab]   = useState<MediaTab>('photos')
  const [searchInput, setSearchInput] = useState('')
  const [hideImages, setHideImages] = useState(false)
  const [hiddenUris, setHiddenUris] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('hiddenUris') ?? '[]')) } catch { return new Set() }
  })
  const [dbHiddenItems, setDbHiddenItems] = useState<{ _id: string; type: 'message' | 'uri'; value: string }[]>([])
  const dbHiddenUris    = useMemo(() => new Set(dbHiddenItems.filter(i => i.type === 'uri').map(i => i.value)), [dbHiddenItems])
  const dbHiddenMsgIds  = useMemo(() => new Set(dbHiddenItems.filter(i => i.type === 'message').map(i => i.value)), [dbHiddenItems])
  const allHiddenUris   = useMemo(() => new Set([...dbHiddenUris, ...hiddenUris]), [dbHiddenUris, hiddenUris])
  const searchRef   = useRef('')
  const [chatVisible, setChatVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  // Date index
  const [dateIndex, setDateIndex] = useState<DateIndex | null>(null)

  // Hashtags
  const [hashtags, setHashtags]         = useState<Hashtag[]>([])
  const [hashtagPicker, setHashtagPicker] = useState<{ msgIds: string[]; blockIds: string[] } | null>(null)
  const [hashtagFilter, setHashtagFilter] = useState('')
  const [hashtagCreating, setHashtagCreating] = useState(false)
  const [activeHashtagName, setActiveHashtagName] = useState<string | null>(null)
  const [showHashtagMenu, setShowHashtagMenu] = useState(false)
  const [editingHashtagTitle, setEditingHashtagTitle] = useState(false)
  const [hashtagTitleInput, setHashtagTitleInput] = useState('')
  const hashtagActionsRef = useRef<{ back: () => void; delete: () => void; rename: (name: string) => Promise<void> } | null>(null)
  const hashtagTitleInputRef = useRef<HTMLInputElement>(null)

  // Selection
  const [selectedMsgs, setSelectedMsgs] = useState(new Map<string, { ts: number; tsEnd: number; allIds: string[]; blockId: string }>())
  const lastSelectedAnchor = useRef<{ id: string; ts: number; tsEnd: number } | null>(null)
  const [preloadedHashtagIds, setPreloadedHashtagIds] = useState<Set<string> | null>(null)
  const preloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // UI overlays
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [ctxMenu, setCtxMenu]   = useState<ContextMenuState | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerDefault, setDatePickerDefault] = useState('')


  // Refs
  const chatRef       = useRef<HTMLDivElement>(null)
  const deviceId      = useRef('')
  const currentUserRef = useRef('')
  const lastBookmarkTime = useRef(0)
  const pendingJump         = useRef<string | null>(null)
  const pendingScrollReset  = useRef(false)
  const pendingScrollBottom = useRef(false)
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

  // Sync hideImages from localStorage after hydration
  useEffect(() => {
    setHideImages(localStorage.getItem('hideImages') === '1')
  }, [])

  // ─── Scroll chat to current lightbox photo in background ───────────────────

  useEffect(() => {
    const msgId = lightbox?.msgId
    if (!msgId || !chatRef.current) return
    const anchor = document.querySelector<HTMLElement>(`[data-msg-id="${msgId}"]`)?.closest<HTMLElement>('.msg-group')
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

  function scrollToMsg(msgId: string): boolean {
    const msgLine = document.querySelector<HTMLElement>(`[data-msg-id="${msgId}"]`)
    if (!msgLine) return false
    msgLine.scrollIntoView({ block: 'start' })
    const group = msgLine.closest<HTMLElement>('.msg-group')
    if (group) {
      const isDarkMode = document.documentElement.classList.contains('dark')
      group.style.background = isDarkMode ? '#3b3010' : '#fff3cd'
      setTimeout(() => { group.style.transition = 'background 1s'; group.style.background = '' }, 800)
      setTimeout(() => { group.style.transition = '' }, 1800)
    }
    return true
  }

  useEffect(() => {
    if (pendingScrollReset.current) {
      pendingScrollReset.current = false
      if (chatRef.current) chatRef.current.scrollTop = 0
      return
    }
    if (pendingScrollBottom.current) {
      pendingScrollBottom.current = false
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
      return
    }
    const jumpId = pendingJump.current
    if (jumpId && scrollToMsg(jumpId)) pendingJump.current = null
    const scrollId = pendingLightboxScroll.current
    if (scrollId) {
      const anchor = document.getElementById('msg-' + scrollId)?.closest<HTMLElement>('.msg-group')
      if (anchor) {
        pendingLightboxScroll.current = null
        anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }, [messages])

  // ─── Sync section + mediaTab to/from URL ────────────────────────────────────

  const mountedRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!mountedRef.current) {
      // First run after hydration: read URL → state
      mountedRef.current = true
      const s = params.get('s')
      const t = params.get('t')
      if (s === 'media' || s === 'hashtags' || s === 'settings') setSection(s)
      if (t === 'videos' || t === 'files') setMediaTab(t)
      return
    }
    // Subsequent runs: state → URL
    if (section === 'chat') { params.delete('s'); params.delete('t') }
    else { params.set('s', section); params.delete('msg'); if (section === 'media') params.set('t', mediaTab); else params.delete('t') }
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [section, mediaTab])

  // ─── Load messages ───────────────────────────────────────────────────────────

  async function loadMessages(mode: 'fresh' | 'append' | 'prepend') {
    const offset = mode === 'prepend' ? lowerOffset.current : mode === 'append' ? upperOffset.current : lowerOffset.current
    const params = new URLSearchParams({ offset: String(offset), limit: String(LIMIT), asc: '1' })
    const q = searchRef.current
    if (q) { params.delete('asc'); params.set('offset', '0'); params.set('search', q) }
    if (showHidden) params.set('showHidden', '1')

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

      el?.style.setProperty('overflow-anchor', 'none')
      flushSync(() => applyMessages(combined))
      if (el) {
        const newScrollTop = prevTop + el.scrollHeight - prevH
        el.scrollTop = newScrollTop
      }

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
      }
      el?.style.removeProperty('overflow-anchor')

    } else if (mode === 'append') {
      upperOffset.current += count
      const next = [...prev, ...data.messages]
      const seen = new Set<string>()
      const deduped = next.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
      if (deduped.length > MAX_DOM) {
        const excess = deduped.length - MAX_DOM
        const culled = deduped.slice(-MAX_DOM)

        flushSync(() => applyMessages(deduped))

        const el = chatRef.current
        const prevH2 = el?.scrollHeight ?? 0
        const prevTop2 = el?.scrollTop ?? 0
        const estCullH = Math.round(prevH2 * excess / deduped.length)
        if (prevTop2 > estCullH) {
          lowerOffset.current += excess
          el?.style.setProperty('overflow-anchor', 'none')
          flushSync(() => applyMessages(culled))
          if (el) {
            el.scrollTop = prevTop2 + el.scrollHeight - prevH2
            el.style.removeProperty('overflow-anchor')
          }
        }
      } else {
        applyMessages(deduped)
      }
    } else {
      upperOffset.current = lowerOffset.current + count
      flushSync(() => applyMessages(data.messages))
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

  function setMsgParam(msgId: string | null) {
    const params = new URLSearchParams(window.location.search)
    if (msgId) params.set('msg', msgId); else params.delete('msg')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }

  async function jumpToMessage(ts: number, msgId: string | null) {
    setSection('chat')
    setJumping(true)
    try {
      const url = msgId ? `/api/jump?msgId=${msgId}` : `/api/jump?date=${new Date(ts).toISOString()}`
      const d = await apiFetch<{ index: number | null }>(url)
      if (d.index == null) return
      lowerOffset.current = Math.max(0, d.index - (msgId ? Math.floor(LIMIT / 2) : 0))
      upperOffset.current = lowerOffset.current
      searchRef.current = ''; setSearchInput('')
      if (msgId) setMsgParam(msgId)
      else pendingScrollReset.current = true
      await loadMessages('fresh')
      // Scroll to the exact message synchronously (before paint) so there is no
      // visible flash of the context buffer that was loaded above the target.
      if (msgId && !scrollToMsg(msgId)) pendingJump.current = msgId
    } finally {
      setJumping(false)
    }
  }

  // ─── Scroll handler ──────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    const el = chatRef.current
    if (!el) return

    const chatTop = el.getBoundingClientRect().top

    const id = deviceId.current
    if (id && !searchRef.current) {
      const now = Date.now()
      if (now - lastBookmarkTime.current >= 300) {
        lastBookmarkTime.current = now
        for (const g of el.querySelectorAll<HTMLElement>('.msg-group')) {
          const rect = g.getBoundingClientRect()
          if (rect.bottom > chatTop) {
            fetch('/api/bookmark', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ msgId: g.dataset.id, offset: Math.max(0, rect.top - chatTop), deviceId: id, ns: currentUserRef.current || undefined }) }).catch(() => {})
            break
          }
        }
      }
    }

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

    fetch('/api/hidden-items').then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.items) return
      setDbHiddenItems(d.items.map((i: any) => ({ _id: i._id, type: i.type, value: i.value })))
    }).catch(() => {})
    reloadHashtags()
    apiFetch<DateIndex>('/api/date-index').then(setDateIndex).catch(() => {})

    Promise.all(['photos', 'videos', 'files'].map(t =>
      apiFetch<{ total: number }>(`/api/attachments?type=${t}&limit=1`).then(d => ({ t, n: d.total ?? 0 })).catch(() => ({ t, n: 0 }))
    )).then(results => {
      const c = Object.fromEntries(results.map(r => [r.t, r.n])) as { photos: number; videos: number; files: number }
      setMediaCounts(c)
    })

    async function init() {
      let userName = ''
      try {
        const d = await fetch('/api/auth/me').then(r => r.json())
        if (d?.name) { userName = d.name; currentUserRef.current = d.name; setCurrentUser(d.name) }
        if (d?.superAdmin) { setIsSuperAdmin(true); setShowHidden(true) }
      } catch {}

      let startIdx = 0, anchorMsgId: string | null = null, anchorOffset = 0
      const urlMsgId = new URLSearchParams(window.location.search).get('msg')
      if (urlMsgId) {
        anchorMsgId = urlMsgId
        try {
          const jd = await apiFetch<{ index: number | null }>('/api/jump?msgId=' + urlMsgId)
          if (jd.index != null) startIdx = jd.index
        } catch {}
      } else {
        try {
          const nsParam = userName ? `&ns=${encodeURIComponent(userName)}` : ''
          const bk = await apiFetch<{ msgId: string | null; offset: number }>(`/api/bookmark?deviceId=${id}${nsParam}`)
          if (bk.msgId) {
            anchorMsgId = bk.msgId; anchorOffset = bk.offset ?? 0
            const jd = await apiFetch<{ index: number | null }>('/api/jump?msgId=' + bk.msgId)
            if (jd.index != null) startIdx = jd.index
          }
        } catch {}
      }

      lowerOffset.current = Math.max(0, startIdx - Math.floor(LIMIT / 2))
      upperOffset.current = lowerOffset.current
      if (urlMsgId) pendingJump.current = urlMsgId
      try { await loadMessages('fresh') } catch {}

      loadingRef.current = true
      if (anchorMsgId && chatRef.current) {
        const anchor = document.querySelector<HTMLElement>(`[data-msg-id="${anchorMsgId}"]`)?.closest<HTMLElement>('.msg-group')
        if (anchor) {
          chatRef.current.scrollTop = 0
          chatRef.current.scrollTop = anchor.getBoundingClientRect().top - chatRef.current.getBoundingClientRect().top - anchorOffset
        }
      }
      setChatVisible(true)
      loadingRef.current = false

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

      if (/^[0-9a-f]{24}$/i.test(trimmed)) {
        setSearching(true)
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

  function openDatePicker() {
    const el = chatRef.current
    if (el) {
      const containerTop = el.getBoundingClientRect().top
      const dayEls = el.querySelectorAll<HTMLElement>('[data-day-iso]')
      let current = ''
      for (const dayEl of dayEls) {
        if (dayEl.getBoundingClientRect().top <= containerTop + 1) {
          current = dayEl.dataset.dayIso ?? ''
        } else {
          break
        }
      }
      setDatePickerDefault(current)
    }
    setShowDatePicker(true)
  }

  async function handleDateJump(date: string) {
    if (!date) return
    setJumping(true)
    try {
      let offset: number | null = null

      if (date.startsWith('ts:')) {
        const ts = parseInt(date.slice(3))
        const msgIdx = messagesRef.current.findIndex(m => m.timestamp_ms === ts)
        if (msgIdx !== -1) {
          offset = lowerOffset.current + msgIdx
        } else {
          const d = await apiFetch<{ index: number | null }>(`/api/jump?date=${new Date(ts).toISOString()}`)
          offset = d.index
        }
      } else {
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
      pendingJump.current = null
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

    Promise.all(newNames.map(name => {
      const existing = snapHashtags.find(h => h.name === name)
      if (existing) return Promise.resolve(existing.id as string | undefined)
      return fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        .then(r => r.json()).then(d => d.doc?.id as string | undefined)
    }))
      .then(ids => Promise.all([...hashtagIds, ...ids.filter((id): id is string => !!id)].map(tagBlocks)))
      .then(() => reloadHashtags())
  }

  // ─── Message blocks (memoized) ───────────────────────────────────────────────

  const blocks = useMemo(() => groupMessages(messages), [messages])

  // ─── Context menu ────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const { x, y, uri } = (e as CustomEvent).detail
      setCtxMenu({ x, y, kind: 'media', mediaUri: uri })
    }
    window.addEventListener('media-ctx', handler)
    return () => window.removeEventListener('media-ctx', handler)
  }, [])

  function hideUri(uri: string) {
    setHiddenUris(prev => {
      const next = new Set(prev)
      next.add(uri)
      localStorage.setItem('hiddenUris', JSON.stringify([...next]))
      return next
    })
  }

  async function handleHideMessage(msgId: string) {
    const res = await fetch('/api/hidden-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'message', value: msgId }) })
    const { item } = await res.json()
    if (item) setDbHiddenItems(prev => [...prev.filter(i => !(i.type === 'message' && i.value === msgId)), { _id: item._id, type: 'message', value: msgId }])
  }

  async function handleUnhideMessage(msgId: string) {
    const item = dbHiddenItems.find(i => i.type === 'message' && i.value === msgId)
    if (!item) return
    await fetch(`/api/hidden-items?id=${item._id}`, { method: 'DELETE' })
    setDbHiddenItems(prev => prev.filter(i => i._id !== item._id))
  }

  async function handleHideDbUri(uri: string) {
    const res = await fetch('/api/hidden-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'uri', value: uri }) })
    const { item } = await res.json()
    if (item) setDbHiddenItems(prev => [...prev.filter(i => !(i.type === 'uri' && i.value === uri)), { _id: item._id, type: 'uri', value: uri }])
  }

  async function handleUnhideDbUri(uri: string) {
    const item = dbHiddenItems.find(i => i.type === 'uri' && i.value === uri)
    if (!item) return
    await fetch(`/api/hidden-items?id=${item._id}`, { method: 'DELETE' })
    setDbHiddenItems(prev => prev.filter(i => i._id !== item._id))
  }

  function handleGalleryContextMenu(e: React.MouseEvent, item: GalleryItem) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'gallery', galTs: String(item.ts), galMsgId: item.msgId ?? null, mediaUri: item.uri })
  }

  function handleMsgContextMenu(e: React.MouseEvent, msgIds: string[]) {
    e.preventDefault()
    const fromTouch = !!(e as any)._fromTouch
    const firstMsg = messagesRef.current.find(m => msgIds.includes(m._id))
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'message', msgIds, msgTs: firstMsg?.timestamp_ms, fromTouch })
  }

  // ─── Lightbox with chat navigation ──────────────────────────────────────────

  async function handleMsgLightbox(state: LightboxState) {
    if (!state.ts) { setLightbox(state); return }

    const mtype = state.mediaType ?? 'photos'
    const uriParam = state.uri ? `&uri=${encodeURIComponent(state.uri)}` : ''
    const { offset: photoOff } = await apiFetch<{ offset: number }>(
      `/api/attachments?type=${mtype}&offsetOf=${state.ts}${uriParam}`
    )
    const { items, total } = await apiFetch<{ items: { uri: string; ts: number; sender: string; msgId: string }[]; total: number }>(
      `/api/attachments?type=${mtype}&offset=${Math.max(0, photoOff - 1)}&limit=3`
    )
    const baseOff  = Math.max(0, photoOff - 1)
    const localIdx = items.findIndex(i => i.uri === state.uri || (i.msgId === state.msgId && i.ts === state.ts))
    const target   = localIdx >= 0 ? localIdx : 0

    type PhotoItem = { uri: string; ts: number; sender: string; msgId: string }

    const typeMap: Record<string, LightboxState['type']> = { photos: 'photo', videos: 'video', gifs: 'gif' }

    const mkState = (absOff: number, item: PhotoItem): LightboxState => ({
      src:       r2(item.uri),
      uri:       item.uri,
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

  // ─── Chat date jump (for DateMenu inside MessageList) ────────────────────────

  async function handleChatJump(target: string) {
    if (target === 'recent') {
      const d = await apiFetch<{ total: number }>('/api/messages?offset=0&limit=1&asc=1')
      lowerOffset.current = Math.max(0, d.total - LIMIT)
      upperOffset.current = lowerOffset.current
      pendingJump.current = null
      pendingScrollBottom.current = true
      await loadMessages('fresh')
    } else if (target === 'beginning') {
      lowerOffset.current = 0; upperOffset.current = 0
      pendingJump.current = null
      pendingScrollReset.current = true
      await loadMessages('fresh')
    } else {
      handleDateJump(target)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const initials = currentUser
    ? currentUser.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
    : ''

  const sectionTitle = section === 'chat' ? 'Chat' : section === 'media' ? 'Media' : section === 'settings' ? 'Settings' : activeHashtagName ? `#${activeHashtagName}` : 'Hashtags'

  return (
    <div className="font-sans bg-white dark:bg-gray-900 h-dvh flex flex-col overflow-hidden">

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0 pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] md:pb-0">

        {/* Nav — left on desktop, bottom on mobile */}
        <AppNav section={section} initials={initials} onSectionChange={setSection} />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden dark:bg-gray-900">

          {/* Header */}
          <AppHeader
            section={section}
            sectionTitle={sectionTitle}
            activeHashtagName={activeHashtagName}
            editingHashtagTitle={editingHashtagTitle}
            setEditingHashtagTitle={setEditingHashtagTitle}
            hashtagTitleInput={hashtagTitleInput}
            setHashtagTitleInput={setHashtagTitleInput}
            hashtagTitleInputRef={hashtagTitleInputRef}
            hashtagActionsRef={hashtagActionsRef}
            setActiveHashtagName={setActiveHashtagName}
            searchInput={searchInput}
            onSearchChange={handleSearchChange}
            hashtagFilter={hashtagFilter}
            onHashtagFilterChange={setHashtagFilter}
            onHashtagCreatingChange={setHashtagCreating}
            showHashtagMenu={showHashtagMenu}
            setShowHashtagMenu={setShowHashtagMenu}
            scrollContainerRef={chatRef}
            hideImages={hideImages}
            onToggleHideImages={() => setHideImages(v => {
              const next = !v
              localStorage.setItem('hideImages', next ? '1' : '0')
              return next
            })}
          />

          {/* Chat section — always mounted, hidden when not active */}
          <div className={`flex-1 flex flex-col min-h-0 relative${section !== 'chat' ? ' hidden' : ''}`}>

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
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-[2px] pointer-events-none">
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md rounded-full px-4 py-2 text-[13px] text-gray-600 dark:text-gray-300">
                  <svg className="animate-spin w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Loading…
                </div>
              </div>
            )}

            {/* Initial load spinner */}
            {!chatVisible && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <svg className="animate-spin w-6 h-6 text-blue-400 opacity-60" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            )}

            {/* Chat scroll */}
            <div
              ref={chatRef}
              onScroll={handleScroll}
              className={`flex-1 overflow-y-auto flex flex-col min-h-0${selectedMsgs.size > 0 ? ' select-none' : ''}`}
              style={{ visibility: chatVisible ? 'visible' : 'hidden' }}
            >
              {searching && <div className="text-center py-2 text-[13px] text-gray-500 dark:text-gray-400">Searching…</div>}
              <MessageList
                blocks={blocks}
                onLightbox={handleMsgLightbox}
                isSelected={id => selectedMsgs.has(id)}
                onToggle={handleToggle}
                onContextMenu={handleMsgContextMenu}
                dateIndex={dateIndex}
                onJumpTo={handleChatJump}
                onOpenDatePicker={openDatePicker}
                hideImages={hideImages}
                hiddenUris={allHiddenUris}
                isSuperAdmin={isSuperAdmin}
                hiddenMsgIds={dbHiddenMsgIds}
                onHideMessage={handleHideMessage}
                onUnhideMessage={handleUnhideMessage}
                onHideUri={handleHideDbUri}
                onUnhideUri={handleUnhideDbUri}
              />
            </div>
          </div>

          {/* Media section */}
          {section === 'media' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
                {([
                  { key: 'photos' as MediaTab, label: `Photos${mediaCounts.photos ? ` (${mediaCounts.photos.toLocaleString()})` : ''}` },
                  { key: 'videos' as MediaTab, label: `Videos${mediaCounts.videos ? ` (${mediaCounts.videos.toLocaleString()})` : ''}` },
                  { key: 'files'  as MediaTab, label: `Files & Audio${mediaCounts.files ? ` (${mediaCounts.files.toLocaleString()})` : ''}` },
                ]).map(t => (
                  <button key={t.key} onClick={() => setMediaTab(t.key)}
                    className={`px-5 py-2.5 text-[13px] font-semibold border-b-[3px] -mb-px select-none transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${mediaTab === t.key ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400 border-transparent'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {mediaTab === 'photos' && <Gallery type="photos" onLightbox={setLightbox} onContextMenu={handleGalleryContextMenu} hideImages={hideImages} hiddenUris={allHiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={handleHideDbUri} onUnhideUri={handleUnhideDbUri} />}
              {mediaTab === 'videos' && <Gallery type="videos" onLightbox={setLightbox} onContextMenu={handleGalleryContextMenu} hideImages={hideImages} hiddenUris={allHiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={handleHideDbUri} onUnhideUri={handleUnhideDbUri} />}
              {mediaTab === 'files'  && <FilesView />}
            </div>
          )}

          {/* Hashtags section — always mounted, hidden when not active */}
          <div className={`flex-1 flex flex-col min-h-0${section !== 'hashtags' ? ' hidden' : ''}`}>
            <HashtagsPane
              hashtags={hashtags}
              onReload={reloadHashtags}
              onJumpToMessage={jumpToMessage}
              filter={hashtagFilter}
              onFilterChange={setHashtagFilter}
              creating={hashtagCreating}
              onCreatingChange={setHashtagCreating}
              onActiveHashtagChange={setActiveHashtagName}
              onActionsChange={a => { hashtagActionsRef.current = a }}
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

          {/* Settings section */}
          {section === 'settings' && (
            <SettingsPane
              total={total}
              dateIndex={dateIndex}
              currentUser={currentUser}
              isSuperAdmin={isSuperAdmin}
              showHidden={showHidden}
              onToggleShowHidden={() => setShowHidden(v => {
                const next = !v
                localStorage.setItem('showHidden', next ? '1' : '0')
                return next
              })}
              hiddenUriCount={hiddenUris.size}
              onClearHiddenUris={() => {
                setHiddenUris(new Set())
                localStorage.removeItem('hiddenUris')
              }}
            />
          )}

        </div>
      </div>

      {/* Overlays */}
      {showDatePicker && (
        <DatePickerModal
          defaultDate={datePickerDefault}
          onClose={() => setShowDatePicker(false)}
          onJump={handleChatJump}
        />
      )}
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
          if (section === 'chat' && msgId && !document.getElementById('msg-' + msgId)) jumpToMessage(Number(ts), msgId)
        }}
        onJumpToMessage={(ts, msgId) => { setLightbox(null); jumpToMessage(ts, msgId) }}
      />}
      {ctxMenu && ctxMenu.fromTouch ? (
        <ActionSheet
          onClose={() => setCtxMenu(null)}
          actions={[
            ...(ctxMenu.kind === 'message' && ctxMenu.msgTs != null ? [{
              label: 'Go to message',
              onPress: () => { jumpToMessage(ctxMenu.msgTs!, ctxMenu.msgIds?.[0] ?? null); setCtxMenu(null) },
            }] : []),
            ...(ctxMenu.kind === 'message' && ctxMenu.msgIds ? [{
              label: '# Tag',
              onPress: () => {
                const data = messagesRef.current.filter(m => ctxMenu.msgIds!.includes(m._id))
                setHashtagPicker({ msgIds: ctxMenu.msgIds!, blockIds: toBlockIds(data, messagesRef.current) })
                setCtxMenu(null)
              },
            }] : []),
            ...(ctxMenu.kind === 'message' && isSuperAdmin && ctxMenu.msgIds?.length ? [dbHiddenMsgIds.has(ctxMenu.msgIds[0]) ? {
              label: 'Unhide message',
              onPress: () => { handleUnhideMessage(ctxMenu.msgIds![0]); setCtxMenu(null) },
            } : {
              label: 'Hide message',
              destructive: true,
              onPress: () => { handleHideMessage(ctxMenu.msgIds![0]); setCtxMenu(null) },
            }] : []),
          ]}
        />
      ) : ctxMenu ? (
        <ContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onEditNote={() => setCtxMenu(null)}
          onJumpToMessage={(ts, msgId) => { jumpToMessage(+ts, msgId); setCtxMenu(null) }}
          onHideUri={hideUri}
          onTagMessages={msgIds => {
            const selectedMsgsData = messagesRef.current.filter(m => msgIds.includes(m._id))
            const blockIds = toBlockIds(selectedMsgsData, messagesRef.current)
            setHashtagPicker({ msgIds, blockIds })
          }}
        />
      ) : null}
    </div>
  )
}
