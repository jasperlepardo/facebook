import { useCallback, useRef, useState } from 'react'
import { LightboxState, DateIndex } from '@/types'
import { LIMIT } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'
import { r2 } from '@/lib/format'
import { toast } from '@/lib/toast'

interface UseMessageJumpParams {
  withThread: (url: string) => string
  scrollRef: React.RefObject<HTMLDivElement | null>
  searchRef: React.MutableRefObject<string>
  dateIndexRef: React.RefObject<DateIndex | null>
  lowerOffset: React.MutableRefObject<number>
  upperOffset: React.MutableRefObject<number>
  onSearchChange: (v: string) => void
  loadMessages: (mode: 'fresh' | 'append' | 'prepend', skipScrollReset?: boolean) => Promise<void>
  onLightbox: (state: LightboxState) => void
}

export function useMessageJump({
  withThread, scrollRef, searchRef, dateIndexRef,
  lowerOffset, upperOffset, onSearchChange, loadMessages, onLightbox,
}: UseMessageJumpParams) {
  const [jumping, setJumping] = useState(false)

  const pendingJump           = useRef<string | null>(null)
  const pendingScrollReset    = useRef(false)
  const pendingScrollBottom   = useRef(false)
  const pendingLightboxScroll = useRef<string | null>(null)

  function scrollToMsg(msgId: string): boolean {
    const row   = document.getElementById(`msg-${msgId}`)
    const group = row?.closest<HTMLElement>('.msg-group') ??
      document.querySelector<HTMLElement>(`[data-id="${msgId}"]`)
    if (!group || !group.offsetParent) return false
    const target = row ?? group
    const scroller = scrollRef.current
    if (!scroller) return false

    // Land just below the sticky date separator for this day
    const day  = target.closest<HTMLElement>('[data-day-iso]')
    const dsep = day?.querySelector<HTMLElement>('.dsep')
    const offset = dsep?.offsetHeight ?? 0
    const top = target.getBoundingClientRect().top
      - scroller.getBoundingClientRect().top
      + scroller.scrollTop
      - offset
    scroller.scrollTop = Math.max(0, top)

    const isDark = document.documentElement.classList.contains('dark')
    target.style.background = isDark ? '#3b3010' : '#fff3cd'
    setTimeout(() => { target.style.transition = 'background 1s'; target.style.background = '' }, 800)
    setTimeout(() => { target.style.transition = '' }, 1800)
    return true
  }

  function scheduleScrollToMsg(msgId: string, attempts = 0) {
    if (attempts > 40) { pendingJump.current = null; toast('Could not scroll to message'); return }
    if (scrollToMsg(msgId)) { pendingJump.current = null; return }
    requestAnimationFrame(() => scheduleScrollToMsg(msgId, attempts + 1))
  }

  const jumpToMessage = useCallback(async (ts: number, msgId: string | null) => {
    setJumping(true)
    try {
      const url = withThread(msgId ? `/api/jump?msgId=${msgId}` : `/api/jump?date=${new Date(ts).toISOString()}`)
      const d = await apiFetch<{ index: number | null }>(url)
      if (d.index == null) { toast('Message not found'); return }
      lowerOffset.current = Math.max(0, d.index - (msgId ? Math.floor(LIMIT / 2) : 0))
      upperOffset.current = lowerOffset.current
      searchRef.current = ''; onSearchChange('')
      if (msgId) {
        const params = new URLSearchParams(window.location.search)
        params.set('s', 'chat')
        params.set('msg', msgId)
        window.history.replaceState(null, '', `?${params}`)
      } else {
        pendingScrollReset.current = true
      }
      await loadMessages('fresh', !!msgId)
      if (msgId && !scrollToMsg(msgId)) { pendingJump.current = msgId; scheduleScrollToMsg(msgId) }
    } catch { toast('Failed to jump to message') }
    finally { setJumping(false) }
  }, [withThread, onSearchChange, loadMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateJump = useCallback(async (date: string) => {
    if (!date) return
    setJumping(true)
    try {
      let offset: number | null = null
      if (date.startsWith('ts:')) {
        const ts = parseInt(date.slice(3))
        const t = new Date(ts)
        const midnight = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
        const d = await apiFetch<{ index: number | null }>(withThread(`/api/jump?date=${new Date(midnight).toISOString()}`))
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
          const d = await apiFetch<{ index: number | null }>(withThread(`/api/jump?date=${new Date(localTs).toISOString()}`))
          offset = d.index
        }
      }
      if (offset == null) { toast('Date not found in archive'); return }
      lowerOffset.current = offset; upperOffset.current = offset
      searchRef.current = ''; onSearchChange('')
      pendingJump.current = null; pendingScrollReset.current = true
      await loadMessages('fresh')
    } catch { toast('Failed to jump to date') }
    finally { setJumping(false) }
  }, [withThread, onSearchChange, loadMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChatJump = useCallback(async (target: string) => {
    if (target === 'recent') {
      try {
        const d = await apiFetch<{ total: number }>(withThread('/api/messages?offset=0&limit=1&asc=1&total=1'))
        lowerOffset.current = Math.max(0, d.total - LIMIT); upperOffset.current = lowerOffset.current
        pendingJump.current = null; pendingScrollBottom.current = true
        await loadMessages('fresh')
      } catch { toast('Failed to jump to recent messages') }
    } else if (target === 'beginning') {
      lowerOffset.current = 0; upperOffset.current = 0
      pendingJump.current = null; pendingScrollReset.current = true
      await loadMessages('fresh')
    } else {
      await handleDateJump(target)
    }
  }, [withThread, loadMessages, handleDateJump]) // eslint-disable-line react-hooks/exhaustive-deps

  type PhotoItem = { uri: string; ts: number; sender: string; msgId: string }
  const lightboxWindow = useRef<{ mtype: string; total: number; items: Map<number, PhotoItem> } | null>(null)

  const handleMsgLightbox = useCallback(async (state: LightboxState) => {
    if (!state.ts) { onLightbox(state); return }

    // Show the tapped media immediately; enrich with neighbors in the background.
    onLightbox(state)

    const mtype = state.mediaType ?? 'photos'
    const uriParam = state.uri ? `&uri=${encodeURIComponent(state.uri)}` : ''
    const typeMap: Record<string, LightboxState['type']> = { photos: 'photo', videos: 'video', gifs: 'gif' }

    try {
      const { offset: photoOff } = await apiFetch<{ offset: number }>(withThread(`/api/attachments?type=${mtype}&offsetOf=${state.ts}${uriParam}`))
      const baseOff = Math.max(0, photoOff - 1)
      const { items, total } = await apiFetch<{ items: PhotoItem[]; total: number }>(
        withThread(`/api/attachments?type=${mtype}&offset=${baseOff}&limit=3`)
      )

      const win = { mtype, total, items: new Map<number, PhotoItem>() }
      items.forEach((item, i) => win.items.set(baseOff + i, item))
      lightboxWindow.current = win

      const localIdx = items.findIndex(i => i.uri === state.uri || (i.msgId === state.msgId && i.ts === state.ts))
      const target = localIdx >= 0 ? localIdx : Math.min(1, items.length - 1)
      if (!items[target]) return

      const ensureItem = async (absOff: number): Promise<PhotoItem | null> => {
        if (absOff < 0) return null
        const cached = lightboxWindow.current
        if (cached?.mtype === mtype && cached.items.has(absOff)) return cached.items.get(absOff)!
        try {
          const { items: fetched } = await apiFetch<{ items: PhotoItem[] }>(
            withThread(`/api/attachments?type=${mtype}&offset=${absOff}&limit=1`)
          )
          if (!fetched[0]) return null
          if (!lightboxWindow.current || lightboxWindow.current.mtype !== mtype) {
            lightboxWindow.current = { mtype, total, items: new Map() }
          }
          lightboxWindow.current.total = total
          lightboxWindow.current.items.set(absOff, fetched[0])
          return fetched[0]
        } catch {
          return null
        }
      }

      const mkState = (absOff: number, item: PhotoItem): LightboxState => {
        const prev = lightboxWindow.current?.items.get(absOff - 1)
        const next = lightboxWindow.current?.items.get(absOff + 1)
        const kind = typeMap[mtype] ?? 'photo'
        return {
          src: r2(item.uri),
          uri: item.uri, type: kind, mediaType: mtype,
          caption: `${new Date(item.ts).toLocaleDateString()} · ${item.sender}`,
          msgId: item.msgId, ts: item.ts,
          index: absOff + 1,
          total,
          prevSrc: prev ? r2(prev.uri) : undefined,
          nextSrc: next ? r2(next.uri) : undefined,
          onPrev: absOff > 0 ? async () => {
            try {
              const pi = await ensureItem(absOff - 1)
              if (!pi) return
              // Warm metadata only — full image prefetch waits until current is ready in Lightbox
              void ensureItem(absOff - 2)
              onLightbox(mkState(absOff - 1, pi))
            } catch { /* keep current */ }
          } : undefined,
          onNext: absOff < total - 1 ? async () => {
            try {
              const ni = await ensureItem(absOff + 1)
              if (!ni) return
              void ensureItem(absOff + 2)
              onLightbox(mkState(absOff + 1, ni))
            } catch { /* keep current */ }
          } : undefined,
        }
      }

      onLightbox(mkState(baseOff + target, items[target]))
    } catch {
      /* keep the immediate open state */
    }
  }, [withThread, onLightbox])

  return {
    jumping,
    pendingJump, pendingScrollReset, pendingScrollBottom, pendingLightboxScroll,
    scrollToMsg, scheduleScrollToMsg,
    jumpToMessage, handleDateJump, handleChatJump, handleMsgLightbox,
  }
}
