'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { Message, MessageBlock, LightboxState, ContextMenuState, Hashtag, DateIndex } from '@/types'
import { ContentTypeKey } from '@/lib/contentTypes'
import { LIMIT, MAX_DOM, LOAD_THRESHOLD } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'
import { r2, fmtDate, fmtTime } from '@/lib/format'
import { groupMessages } from '@/lib/groupMessages'
import MessageList from './MessageList'
import HashtagPicker from './HashtagPicker'
import ContextMenu from './ContextMenu'
import ActionSheet from './ActionSheet'
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
}

export default function ChatDetailPane({
  search, onSearchChange, scrollRef,
  hashtags, onReloadHashtags,
  currentUser, isSuperAdmin, showHidden,
  hideImages, hiddenUris, hiddenMsgIds,
  onHideUri, onHideDbUri, onUnhideDbUri,
  onHideMessage, onUnhideMessage,
  onLightbox, onRegisterJump, onStatsChange, enabledTypes,
}: Props) {
  // ─── Messages ──────────────────────────────────────────────────────────────
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
  const [chatVisible, setChatVisible] = useState(false)

  // ─── Date index ────────────────────────────────────────────────────────────
  const [dateIndex, setDateIndex] = useState<DateIndex | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerDefault, setDatePickerDefault] = useState('')

  // ─── Selection ────────────────────────────────────────────────────────────
  const [selectedMsgs, setSelectedMsgs] = useState(new Map<string, { ts: number; tsEnd: number; allIds: string[]; blockId: string }>())
  const lastSelectedAnchor = useRef<{ id: string; ts: number; tsEnd: number } | null>(null)
  const [preloadedHashtagIds, setPreloadedHashtagIds] = useState<Set<string> | null>(null)
  const preloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [hashtagPicker, setHashtagPicker] = useState<{ msgIds: string[]; blockIds: string[] } | null>(null)

  // ─── UI overlays ──────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu]   = useState<ContextMenuState | null>(null)
  const [toast, setToast]       = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const deviceId          = useRef('')
  const currentUserRef    = useRef('')
  const lastBookmarkTime  = useRef(0)
  const pendingJump       = useRef<string | null>(null)
  const pendingScrollReset  = useRef(false)
  const pendingScrollBottom = useRef(false)
  const pendingLightboxScroll = useRef<string | null>(null)
  const queuedLoad        = useRef<'older' | 'newer' | null>(null)
  const searchRef         = useRef('')
  const searchTimer       = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showHiddenRef     = useRef(showHidden)
  const dateIndexRef      = useRef<DateIndex | null>(null)
  const blocksRef         = useRef<MessageBlock[]>([])

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const applyMessages = useCallback((msgs: Message[]) => {
    const seen = new Set<string>()
    const deduped = msgs.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
    messagesRef.current = deduped
    setMessages(deduped)
  }, [])

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const copyLink = useCallback((msgIds: string[]) => {
    const url = `${window.location.origin}${window.location.pathname}?msg=${msgIds[0]}`
    navigator.clipboard.writeText(url).then(() => showToast('Link copied'))
  }, [showToast])

  const copyText = useCallback((msgIds: string[]) => {
    const ids = new Set(msgIds)
    const msgs = messagesRef.current.filter(m => ids.has(m._id))
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
  }, [showToast])

  function scrollToMsg(msgId: string): boolean {
    const group =
      document.querySelector<HTMLElement>(`[data-id="${msgId}"]`) ??
      document.querySelector<HTMLElement>(`[data-msg-id="${msgId}"]`)?.closest<HTMLElement>('.msg-group')
    if (!group) return false
    group.scrollIntoView({ block: 'start' })
    const isDarkMode = document.documentElement.classList.contains('dark')
    group.style.background = isDarkMode ? '#3b3010' : '#fff3cd'
    setTimeout(() => { group.style.transition = 'background 1s'; group.style.background = '' }, 800)
    setTimeout(() => { group.style.transition = '' }, 1800)
    return true
  }

  // ─── Load messages ─────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (mode: 'fresh' | 'append' | 'prepend') => {
    const offset = mode === 'prepend' ? lowerOffset.current : mode === 'append' ? upperOffset.current : lowerOffset.current
    const params = new URLSearchParams({ offset: String(offset), limit: String(LIMIT), asc: '1' })
    const q = searchRef.current
    if (q) { params.delete('asc'); params.set('offset', '0'); params.set('search', q) }
    if (showHiddenRef.current) params.set('showHidden', '1')

    const data = await apiFetch<{ messages: Message[]; total: number; has_more: boolean }>('/api/messages?' + params)
    setTotal(data.total)
    hasMoreRef.current = !!(data.has_more && !q)
    setHasMore(hasMoreRef.current)

    const count = data.messages.length
    const prev  = messagesRef.current

    if (mode === 'prepend') {
      const el = scrollRef.current
      const prevH = el?.scrollHeight ?? 0
      const prevTop = el?.scrollTop ?? 0
      const combined = [...data.messages, ...prev]

      el?.style.setProperty('overflow-anchor', 'none')
      flushSync(() => applyMessages(combined))
      if (el) el.scrollTop = prevTop + el.scrollHeight - prevH

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
        const el = scrollRef.current
        const prevH2 = el?.scrollHeight ?? 0
        const prevTop2 = el?.scrollTop ?? 0
        const estCullH = Math.round(prevH2 * excess / deduped.length)
        if (prevTop2 > estCullH) {
          lowerOffset.current += excess
          el?.style.setProperty('overflow-anchor', 'none')
          flushSync(() => applyMessages(culled))
          if (el) { el.scrollTop = prevTop2 + el.scrollHeight - prevH2; el.style.removeProperty('overflow-anchor') }
        }
      } else {
        applyMessages(deduped)
      }
    } else {
      upperOffset.current = lowerOffset.current + count
      flushSync(() => applyMessages(data.messages))
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }
  }, [applyMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = useCallback(async () => {
    if (lowerOffset.current === 0) return
    lowerOffset.current = Math.max(0, lowerOffset.current - LIMIT)
    try { await loadMessages('prepend') } catch { lowerOffset.current += LIMIT }
  }, [loadMessages])

  const loadNewer = useCallback(async () => { await loadMessages('append') }, [loadMessages])

  // ─── Jump ──────────────────────────────────────────────────────────────────

  function setMsgParam(msgId: string | null) {
    const params = new URLSearchParams(window.location.search)
    if (msgId) params.set('msg', msgId); else params.delete('msg')
    window.history.replaceState(null, '', params.toString() ? `?${params}` : window.location.pathname)
  }

  const jumpToMessage = useCallback(async (ts: number, msgId: string | null) => {
    setJumping(true)
    try {
      const url = msgId ? `/api/jump?msgId=${msgId}` : `/api/jump?date=${new Date(ts).toISOString()}`
      const d = await apiFetch<{ index: number | null }>(url)
      if (d.index == null) return
      lowerOffset.current = Math.max(0, d.index - (msgId ? Math.floor(LIMIT / 2) : 0))
      upperOffset.current = lowerOffset.current
      searchRef.current = ''; onSearchChange('')
      if (msgId) setMsgParam(msgId)
      else pendingScrollReset.current = true
      await loadMessages('fresh')
      if (msgId && !scrollToMsg(msgId)) pendingJump.current = msgId
    } finally {
      setJumping(false)
    }
  }, [showHidden]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register jump function with parent
  useEffect(() => {
    onRegisterJump(jumpToMessage)
    return () => onRegisterJump(null)
  }, [jumpToMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Expose total + dateIndex to parent for SettingsPane
  useEffect(() => { onStatsChange?.(total, dateIndex) }, [total, dateIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Lightbox scroll ───────────────────────────────────────────────────────

  const handleMsgLightbox = useCallback(async (state: LightboxState) => {
    if (!state.ts) { onLightbox(state); return }
    const mtype = state.mediaType ?? 'photos'
    const uriParam = state.uri ? `&uri=${encodeURIComponent(state.uri)}` : ''
    const { offset: photoOff } = await apiFetch<{ offset: number }>(`/api/attachments?type=${mtype}&offsetOf=${state.ts}${uriParam}`)
    const { items, total } = await apiFetch<{ items: { uri: string; ts: number; sender: string; msgId: string }[]; total: number }>(
      `/api/attachments?type=${mtype}&offset=${Math.max(0, photoOff - 1)}&limit=3`
    )
    const baseOff = Math.max(0, photoOff - 1)
    const localIdx = items.findIndex(i => i.uri === state.uri || (i.msgId === state.msgId && i.ts === state.ts))
    const target = localIdx >= 0 ? localIdx : 0
    type PhotoItem = { uri: string; ts: number; sender: string; msgId: string }
    const typeMap: Record<string, LightboxState['type']> = { photos: 'photo', videos: 'video', gifs: 'gif' }
    const mkState = (absOff: number, item: PhotoItem): LightboxState => ({
      src: r2(item.uri), uri: item.uri, type: typeMap[mtype] ?? 'photo', mediaType: mtype,
      caption: `${new Date(item.ts).toLocaleDateString()} · ${item.sender}`,
      msgId: item.msgId, ts: item.ts,
      onPrev: absOff > 0 ? async () => { const { items: pi } = await apiFetch<{ items: PhotoItem[] }>(`/api/attachments?type=${mtype}&offset=${absOff - 1}&limit=1`); if (pi[0]) onLightbox(mkState(absOff - 1, pi[0])) } : undefined,
      onNext: absOff < total - 1 ? async () => { const { items: ni } = await apiFetch<{ items: PhotoItem[] }>(`/api/attachments?type=${mtype}&offset=${absOff + 1}&limit=1`); if (ni[0]) onLightbox(mkState(absOff + 1, ni[0])) } : undefined,
    })
    onLightbox(mkState(baseOff + target, items[target]))
  }, [onLightbox]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Scroll handler ────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
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
        const queued = queuedLoad.current; queuedLoad.current = null
        const qel = scrollRef.current
        const stillNearTop    = qel && qel.scrollTop < LOAD_THRESHOLD && lowerOffset.current > 0
        const stillNearBottom = qel && qel.scrollTop + qel.clientHeight > qel.scrollHeight - LOAD_THRESHOLD && hasMoreRef.current
        if (queued === 'older' && stillNearTop) await loadOlder().catch(() => {})
        else if (queued === 'newer' && stillNearBottom) await loadNewer().catch(() => {})
        loadingRef.current = false
      })
    }
    if (nearTop) run(loadOlder)
    else if (nearBottom) run(loadNewer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Ref sync ──────────────────────────────────────────────────────────────

  useEffect(() => { showHiddenRef.current = showHidden }, [showHidden])
  useEffect(() => { dateIndexRef.current  = dateIndex  }, [dateIndex])

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let id = localStorage.getItem('deviceId')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id) }
    deviceId.current = id

    apiFetch<DateIndex>('/api/date-index').then(setDateIndex).catch(() => {})

    async function init() {
      let userName = ''
      try {
        const d = await fetch('/api/auth/me').then(r => r.json())
        if (d?.name) { userName = d.name; currentUserRef.current = d.name }
      } catch {}

      let startIdx = 0, anchorMsgId: string | null = null, anchorOffset = 0
      const urlMsgId = new URLSearchParams(window.location.search).get('msg')
      if (urlMsgId) {
        anchorMsgId = urlMsgId
        try { const jd = await apiFetch<{ index: number | null }>('/api/jump?msgId=' + urlMsgId); if (jd.index != null) startIdx = jd.index } catch {}
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
      if (anchorMsgId && scrollRef.current) {
        const anchor = document.querySelector<HTMLElement>(`[data-msg-id="${anchorMsgId}"]`)?.closest<HTMLElement>('.msg-group')
        if (anchor) {
          scrollRef.current.scrollTop = 0
          scrollRef.current.scrollTop = anchor.getBoundingClientRect().top - scrollRef.current.getBoundingClientRect().top - anchorOffset
        }
      }
      setChatVisible(true)
      loadingRef.current = false

      const el = scrollRef.current
      if (el) {
        loadingRef.current = true
        if (el.scrollTop < LOAD_THRESHOLD && lowerOffset.current > 0) await loadOlder().catch(() => {})
        if (el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && hasMoreRef.current) await loadNewer().catch(() => {})
        loadingRef.current = false
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Search (react to prop) ────────────────────────────────────────────────

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const trimmed = search.trim()
      if (/^[0-9a-f]{24}$/i.test(trimmed)) {
        setSearching(true)
        const byBlock = await apiFetch<{ messages: Message[] }>(`/api/messages?groupIds=${trimmed}`)
        const msgs = byBlock.messages.length
          ? byBlock.messages
          : (await apiFetch<{ messages: Message[] }>(`/api/messages?ids=${trimmed}`)).messages
        if (msgs.length) {
          searchRef.current = ''
          lowerOffset.current = 0; upperOffset.current = 0
          setMessages(msgs); messagesRef.current = msgs
          pendingJump.current = msgs[0]._id
        }
        setSearching(false)
        return
      }
      searchRef.current = trimmed
      lowerOffset.current = 0; upperOffset.current = 0
      setSearching(!!trimmed)
      await loadMessages('fresh')
      setSearching(false)
    }, 350)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pending scroll after messages render ──────────────────────────────────

  useEffect(() => {
    if (pendingScrollReset.current) {
      pendingScrollReset.current = false
      if (scrollRef.current) scrollRef.current.scrollTop = 0
      return
    }
    if (pendingScrollBottom.current) {
      pendingScrollBottom.current = false
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      return
    }
    const jumpId = pendingJump.current
    if (jumpId && scrollToMsg(jumpId)) pendingJump.current = null
    const scrollId = pendingLightboxScroll.current
    if (scrollId) {
      const anchor = document.getElementById('msg-' + scrollId)?.closest<HTMLElement>('.msg-group')
      if (anchor) { pendingLightboxScroll.current = null; anchor.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
    }
  }, [messages])

  // ─── Selection preload ─────────────────────────────────────────────────────

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

  // ─── Selection handlers ────────────────────────────────────────────────────

  const blocks = useMemo(() => groupMessages(messages), [messages])
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  const handleToggle = useCallback(async (id: string, ts: number, tsEnd: number, allIds: string[], blockId: string, shiftKey?: boolean) => {
    if (shiftKey && lastSelectedAnchor.current) {
      const anchor = lastSelectedAnchor.current
      const anchorIdx = blocksRef.current.findIndex(b => b.msgs[0]._id === anchor.id)
      const clickedIdx = blocksRef.current.findIndex(b => b.msgs[0]._id === id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [start, end] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (let i = start; i <= end; i++) {
            const b = blocksRef.current[i]; const f = b.msgs[0]; const l = b.msgs[b.msgs.length - 1]
            next.set(f._id, { ts: f.timestamp_ms, tsEnd: l.timestamp_ms, allIds: b.msgs.map((m: Message) => m._id), blockId: f.blockId ?? f._id })
          }
          return next
        })
      } else {
        const minTs = Math.min(anchor.ts, ts); const maxTs = Math.max(anchor.tsEnd, tsEnd)
        const data = await apiFetch<{ messages: Message[] }>(`/api/messages?tsFrom=${minTs}&tsTo=${maxTs}`)
        const rangeBlocks = groupMessages(data.messages)
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (const b of rangeBlocks) {
            const f = b.msgs[0]; const l = b.msgs[b.msgs.length - 1]
            next.set(f._id, { ts: f.timestamp_ms, tsEnd: l.timestamp_ms, allIds: b.msgs.map((m: Message) => m._id), blockId: f.blockId ?? f._id })
          }
          return next
        })
      }
      return
    }
    lastSelectedAnchor.current = { id, ts, tsEnd }
    setSelectedMsgs(prev => { const next = new Map(prev); next.has(id) ? next.delete(id) : next.set(id, { ts, tsEnd, allIds, blockId }); return next })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function clearSelection() { setSelectedMsgs(new Map()); lastSelectedAnchor.current = null; setPreloadedHashtagIds(null) }

  function openNoteFromSelection() {
    const values = [...selectedMsgs.values()]
    const allIds = [...new Set(values.flatMap(v => v.allIds))]
    const blockIds = [...new Set(values.map(v => v.blockId).filter(Boolean))]
    setHashtagPicker({ msgIds: allIds, blockIds })
  }

  function applyHashtags(hashtagIds: string[], newNames: string[]) {
    const blockIds = hashtagPicker?.blockIds ?? []
    const snapHashtags = hashtags
    setHashtagPicker(null); clearSelection()
    const tagBlocks = (hashtagId: string) =>
      fetch('/api/hashtag-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hashtagId, blockIds }) })
    Promise.all(newNames.map(name => {
      const existing = snapHashtags.find(h => h.name === name)
      if (existing) return Promise.resolve(existing.id as string | undefined)
      return fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        .then(r => r.json()).then(d => d.doc?.id as string | undefined)
    })).then(ids => Promise.all([...hashtagIds, ...ids.filter((id): id is string => !!id)].map(tagBlocks))).then(() => onReloadHashtags())
  }

  // ─── Context menu ──────────────────────────────────────────────────────────

  const handleMsgContextMenu = useCallback((e: React.MouseEvent, msgIds: string[]) => {
    e.preventDefault()
    const fromTouch = !!(e as unknown as { _fromTouch?: boolean })._fromTouch
    const firstMsg = messagesRef.current.find(m => msgIds.includes(m._id))
    setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'message', msgIds, msgTs: firstMsg?.timestamp_ms, fromTouch })
  }, [])

  // ─── Date picker ───────────────────────────────────────────────────────────

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
  }, [])

  const handleDateJump = useCallback(async (date: string) => {
    if (!date) return
    setJumping(true)
    try {
      let offset: number | null = null
      if (date.startsWith('ts:')) {
        const ts = parseInt(date.slice(3))
        const t = new Date(ts)
        const midnight = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
        const d = await apiFetch<{ index: number | null }>(`/api/jump?date=${new Date(midnight).toISOString()}`)
        offset = d.index
      } else {
        offset = dateIndexRef.current
          ? (dateIndexRef.current.weeks.find(w => w.iso === date) ?? dateIndexRef.current.months.find(m => m.iso === date))?.offset ?? null
          : null
        if (offset == null) {
          const parts = date.split('-').map(Number)
          const localTs = parts.length === 3 && parts[0] && parts[1] && parts[2]
            ? new Date(parts[0], parts[1] - 1, parts[2]).getTime()
            : new Date(date).getTime()
          const d = await apiFetch<{ index: number | null }>(`/api/jump?date=${new Date(localTs).toISOString()}`)
          offset = d.index
        }
      }
      if (offset == null) return
      lowerOffset.current = offset; upperOffset.current = offset
      searchRef.current = ''; onSearchChange('')
      pendingJump.current = null; pendingScrollReset.current = true
      await loadMessages('fresh')
    } finally { setJumping(false) }
  }, [loadMessages, onSearchChange])

  const handleChatJump = useCallback(async (target: string) => {
    if (target === 'recent') {
      const d = await apiFetch<{ total: number }>('/api/messages?offset=0&limit=1&asc=1')
      lowerOffset.current = Math.max(0, d.total - LIMIT); upperOffset.current = lowerOffset.current
      pendingJump.current = null; pendingScrollBottom.current = true
      await loadMessages('fresh')
    } else if (target === 'beginning') {
      lowerOffset.current = 0; upperOffset.current = 0
      pendingJump.current = null; pendingScrollReset.current = true
      await loadMessages('fresh')
    } else {
      handleDateJump(target)
    }
  }, [loadMessages, handleDateJump])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Selection bar */}
      {selectedMsgs.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full px-4 py-2 flex items-center gap-2.5 text-[13px] whitespace-nowrap shadow-xl z-20">
          <span className="text-white/60 pr-0.5">{selectedMsgs.size} selected</span>
          <button onClick={openNoteFromSelection} className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full font-semibold transition-colors"># Tag</button>
          <button
            onClick={() => {
              const firstId = [...selectedMsgs.keys()][0]
              if (firstId) copyLink([firstId])
              clearSelection()
            }}
            className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full font-semibold transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Share
          </button>
          <button onClick={clearSelection} className="opacity-50 hover:opacity-100 transition-opacity pl-0.5">✕</button>
        </div>
      )}

      {/* Date-jump overlay */}
      {jumping && (
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

      {/* Initial spinner */}
      {!chatVisible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <svg className="animate-spin w-6 h-6 text-mist-400 opacity-60" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>
      )}

      {/* Chat scroll */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto flex flex-col min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0${selectedMsgs.size > 0 ? ' select-none' : ''}`}
        style={{ visibility: chatVisible ? 'visible' : 'hidden' }}
      >
        {searching && <div className="text-center py-2 text-[13px] text-gray-500 dark:text-gray-400">Searching…</div>}
        <MessageList
          blocks={blocks}
          onLightbox={handleMsgLightbox}
          selectedMsgIds={selectedMsgs}
          onToggle={handleToggle}
          onContextMenu={handleMsgContextMenu}
          dateIndex={dateIndex}
          onJumpTo={handleChatJump}
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
        />
      </div>

      {/* Overlays */}
      {showDatePicker && (
        <DatePickerModal defaultDate={datePickerDefault} onClose={() => setShowDatePicker(false)} onJump={handleChatJump} />
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
      {ctxMenu && ctxMenu.fromTouch ? (
        <ActionSheet
          onClose={() => setCtxMenu(null)}
          actions={[
            ...(ctxMenu.kind === 'message' && ctxMenu.msgTs != null ? [{ label: 'Go to message', onPress: () => { jumpToMessage(ctxMenu.msgTs!, ctxMenu.msgIds?.[0] ?? null); setCtxMenu(null) } }] : []),
            ...(ctxMenu.kind === 'message' && ctxMenu.msgIds ? [
              { label: 'Copy link', onPress: () => { copyLink(ctxMenu.msgIds!); setCtxMenu(null) } },
              { label: 'Copy text', onPress: () => { copyText(ctxMenu.msgIds!); setCtxMenu(null) } },
              { label: '# Tag', onPress: () => {
                const data = messagesRef.current.filter(m => ctxMenu.msgIds!.includes(m._id))
                setHashtagPicker({ msgIds: ctxMenu.msgIds!, blockIds: toBlockIds(data, messagesRef.current) }); setCtxMenu(null)
              }},
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
          onEditNote={() => setCtxMenu(null)}
          onJumpToMessage={(ts, msgId) => { jumpToMessage(+ts, msgId); setCtxMenu(null) }}
          onHideUri={onHideUri}
          onTagMessages={msgIds => {
            const data = messagesRef.current.filter(m => msgIds.includes(m._id))
            setHashtagPicker({ msgIds, blockIds: toBlockIds(data, messagesRef.current) })
          }}
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
