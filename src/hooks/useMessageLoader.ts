import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Message } from '@/types'
import { LIMIT, MAX_DOM_BLOCKS } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'
import { toast } from '@/lib/toast'

interface UseMessageLoaderParams {
  thread: string
  searchRef: React.RefObject<string>
  senderIdsRef: React.RefObject<string[]>
  showHiddenRef: React.RefObject<boolean>
  scrollRef: React.RefObject<HTMLDivElement | null>
}

export function useMessageLoader({ thread, searchRef, senderIdsRef, showHiddenRef, scrollRef }: UseMessageLoaderParams) {
  const [messages, setMessages]   = useState<Message[]>([])
  const messagesRef               = useRef<Message[]>([])
  const [total, setTotal]         = useState(0)
  const [hasMore, setHasMore]     = useState(false)
  const [searching, setSearching] = useState(false)

  const lowerOffset = useRef(0)
  const upperOffset = useRef(0)
  const loadingRef  = useRef(false)
  const hasMoreRef  = useRef(false)

  const withThread = useCallback((url: string) =>
    `${url}${url.includes('?') ? '&' : '?'}thread=${thread}`, [thread])

  const applyMessages = useCallback((msgs: Message[]) => {
    const seen = new Set<string>()
    const deduped = msgs.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
    messagesRef.current = deduped
    setMessages(deduped)
  }, [])

  const loadMessages = useCallback(async (mode: 'fresh' | 'append' | 'prepend', skipScrollReset = false) => {
    const offset = mode === 'prepend' ? lowerOffset.current : upperOffset.current
    const params = new URLSearchParams({ offset: String(mode === 'fresh' ? lowerOffset.current : offset), limit: String(LIMIT), asc: '1' })
    const q = searchRef.current
    const senderIds = senderIdsRef.current ?? []
    if (q) { params.delete('asc'); params.set('offset', '0'); params.set('search', q) }
    if (senderIds.length > 0) params.set('senderId', senderIds.join(','))
    if (showHiddenRef.current) params.set('showHidden', '1')

    const data = await apiFetch<{ messages: Message[]; total?: number; has_more: boolean }>(withThread('/api/messages?' + params))
    if (typeof data.total === 'number') setTotal(data.total)
    // Text search returns a single page; sender-only filter still paginates.
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

      if (combined.length > MAX_DOM_BLOCKS && el) {
        const excess = combined.length - MAX_DOM_BLOCKS
        const currentH = el.scrollHeight
        const currentTop = el.scrollTop
        const clientH = el.clientHeight
        const estCullH = Math.round(currentH * excess / combined.length)
        if (currentTop <= currentH - estCullH - clientH) {
          upperOffset.current -= excess
          flushSync(() => applyMessages(combined.slice(0, MAX_DOM_BLOCKS)))
        }
      }
      el?.style.removeProperty('overflow-anchor')

    } else if (mode === 'append') {
      upperOffset.current += count
      const next = [...prev, ...data.messages]
      const seen = new Set<string>()
      const deduped = next.filter(m => { if (!m._id || seen.has(m._id)) return false; seen.add(m._id); return true })
      if (deduped.length > MAX_DOM_BLOCKS) {
        const excess = deduped.length - MAX_DOM_BLOCKS
        const culled = deduped.slice(-MAX_DOM_BLOCKS)
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
      if (!skipScrollReset && scrollRef.current) scrollRef.current.scrollTop = 0
    }
  }, [applyMessages, withThread]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = useCallback(async () => {
    if (lowerOffset.current === 0) return
    lowerOffset.current = Math.max(0, lowerOffset.current - LIMIT)
    try { await loadMessages('prepend') } catch { lowerOffset.current += LIMIT; toast('Failed to load older messages') }
  }, [loadMessages])

  const loadNewer = useCallback(async () => {
    try { await loadMessages('append') } catch { toast('Failed to load newer messages') }
  }, [loadMessages])

  return {
    messages, messagesRef,
    total, setTotal,
    hasMore, setHasMore,
    searching, setSearching,
    lowerOffset, upperOffset,
    loadingRef, hasMoreRef,
    withThread,
    applyMessages, loadMessages, loadOlder, loadNewer,
  }
}
