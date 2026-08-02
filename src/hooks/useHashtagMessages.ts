'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Hashtag, Message } from '@/types'
import { apiFetch } from '@/lib/utils'
import { buildHashtagBlocks } from '@/lib/buildHashtagBlocks'

const CHUNK = 60
const MAX_VISIBLE = CHUNK * 2  // max message blocks kept in DOM at once

interface UseHashtagMessagesParams {
  thread: string
  isSuperAdmin?: boolean
  showHidden?: boolean
  hiddenMsgIds?: Set<string>
  activeTab: 'context' | 'messages'
  msgFilter: string
}

export function useHashtagMessages({ thread, isSuperAdmin, showHidden, hiddenMsgIds, activeTab, msgFilter }: UseHashtagMessagesParams) {
  const [allMsgs, setAllMsgs] = useState<Message[]>([])
  const [winStart, setWinStart] = useState(0)
  const [winEnd, setWinEnd]   = useState(CHUNK)
  const winRef = useRef({ start: 0, end: CHUNK })
  const [msgThread, setMsgThread] = useState<string>(thread)
  const msgsScrollRef    = useRef<HTMLDivElement>(null)
  const topSentinelRef   = useRef<HTMLDivElement>(null)
  const botSentinelRef   = useRef<HTMLDivElement>(null)
  const allMsgsRef = useRef<Message[]>([])
  allMsgsRef.current = allMsgs
  winRef.current = { start: winStart, end: winEnd }
  const filteredMsgsRef = useRef<Message[]>([])

  const filteredMsgs = useMemo(() => {
    let msgs = allMsgs
    if (!(showHidden && isSuperAdmin) && hiddenMsgIds?.size) {
      msgs = msgs.filter(m => !m._id || !hiddenMsgIds.has(m._id))
    }
    const q = msgFilter.trim().toLowerCase()
    if (!q) return msgs
    return msgs.filter(m => m.content?.toLowerCase().includes(q))
  }, [allMsgs, msgFilter, showHidden, isSuperAdmin, hiddenMsgIds])
  filteredMsgsRef.current = filteredMsgs

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
  }, [msgFilter])

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

  async function loadMessages(h: Hashtag) {
    try {
      const res = await apiFetch<{ groups: { messageId: string }[] }>(`/api/hashtag-groups?hashtagId=${h.id}`)
      const messageIds = res.groups.map(g => g.messageId).filter(Boolean)
      if (!messageIds.length) { winRef.current = { start: 0, end: CHUNK }; setWinStart(0); setWinEnd(CHUNK); setAllMsgs([]); return }
      const resolvedThread = h.thread ?? thread
      setMsgThread(resolvedThread)
      const data = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, thread: resolvedThread, showHidden: !!(showHidden && isSuperAdmin) }),
      }).then(r => r.json())
      const sorted = (data.messages ?? []).sort((a: Message, b: Message) => a.timestamp_ms - b.timestamp_ms)
      const end = Math.min(CHUNK, sorted.length)
      winRef.current = { start: 0, end }
      setWinStart(0); setWinEnd(end)
      setAllMsgs(sorted)
    } catch { winRef.current = { start: 0, end: CHUNK }; setWinStart(0); setWinEnd(CHUNK); setAllMsgs([]) }
  }

  const visibleMsgs = filteredMsgs.slice(winStart, winEnd)
  const blocks = useMemo(() => buildHashtagBlocks(visibleMsgs), [winStart, winEnd, filteredMsgs]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore   = winEnd < filteredMsgs.length
  const hasBefore = winStart > 0

  return {
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
  }
}
