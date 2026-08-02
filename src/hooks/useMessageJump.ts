import { useCallback, useRef, useState } from 'react'
import { DateIndex } from '@/types'
import { LIMIT } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'
import { toast } from '@/lib/toast'

interface UseMessageJumpParams {
  withThread: (url: string) => string
  scrollRef: React.RefObject<HTMLDivElement | null>
  dateIndexRef: React.RefObject<DateIndex | null>
  lowerOffset: React.MutableRefObject<number>
  upperOffset: React.MutableRefObject<number>
  /** Drops search text and sender filters (and leaves search mode) before loading. */
  resetFilters: () => void
  loadMessages: (mode: 'fresh' | 'append' | 'prepend', skipScrollReset?: boolean) => Promise<void>
}

export function useMessageJump({
  withThread, scrollRef, dateIndexRef,
  lowerOffset, upperOffset, resetFilters, loadMessages,
}: UseMessageJumpParams) {
  const [jumping, setJumping] = useState(false)

  const pendingJump           = useRef<string | null>(null)
  const pendingScrollReset    = useRef(false)
  const pendingScrollBottom   = useRef(false)

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
      resetFilters()
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
  }, [withThread, resetFilters, loadMessages]) // eslint-disable-line react-hooks/exhaustive-deps

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
      resetFilters()
      pendingJump.current = null; pendingScrollReset.current = true
      await loadMessages('fresh')
    } catch { toast('Failed to jump to date') }
    finally { setJumping(false) }
  }, [withThread, resetFilters, loadMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChatJump = useCallback(async (target: string) => {
    if (target === 'recent') {
      try {
        const d = await apiFetch<{ total: number }>(withThread('/api/messages?offset=0&limit=1&asc=1&total=1'))
        lowerOffset.current = Math.max(0, d.total - LIMIT); upperOffset.current = lowerOffset.current
        resetFilters()
        pendingJump.current = null; pendingScrollBottom.current = true
        await loadMessages('fresh')
      } catch { toast('Failed to jump to recent messages') }
    } else if (target === 'beginning') {
      lowerOffset.current = 0; upperOffset.current = 0
      resetFilters()
      pendingJump.current = null; pendingScrollReset.current = true
      await loadMessages('fresh')
    } else {
      await handleDateJump(target)
    }
  }, [withThread, resetFilters, loadMessages, handleDateJump]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    jumping,
    pendingJump, pendingScrollReset, pendingScrollBottom,
    scrollToMsg, scheduleScrollToMsg,
    jumpToMessage, handleDateJump, handleChatJump,
  }
}
