import { useEffect, useRef, Dispatch, SetStateAction } from 'react'
import { Message, DateIndex } from '@/types'
import { LIMIT, LOAD_THRESHOLD } from '@/lib/constants'
import { apiFetch } from '@/lib/utils'

interface LoaderInitApi {
  withThread: (url: string) => string
  lowerOffset: React.MutableRefObject<number>
  upperOffset: React.MutableRefObject<number>
  loadingRef: React.MutableRefObject<boolean>
  hasMoreRef: React.MutableRefObject<boolean>
  messagesRef: React.MutableRefObject<Message[]>
  setSearching: (v: boolean) => void
  loadMessages: (mode: 'fresh' | 'append' | 'prepend', skipScrollReset?: boolean) => Promise<void>
  loadOlder: () => Promise<void>
  loadNewer: () => Promise<void>
}

interface JumpInitApi {
  scheduleScrollToMsg: (msgId: string) => void
  pendingJump: React.MutableRefObject<string | null>
}

interface UseChatInitParams {
  thread: string
  search: string
  senderIdsKey: string
  scrollRef: React.RefObject<HTMLDivElement | null>
  searchRef: React.MutableRefObject<string>
  senderIdsRef: React.MutableRefObject<string[]>
  dateIndexRef: React.MutableRefObject<DateIndex | null>
  deviceId: React.MutableRefObject<string>
  currentUserRef: React.MutableRefObject<string>
  loader: LoaderInitApi
  jump: JumpInitApi
  setDateIndex: Dispatch<SetStateAction<DateIndex | null>>
  setChatVisible: Dispatch<SetStateAction<boolean>>
}

/** Mount restore (URL msg / bookmark), date-index fetch, and debounced search. */
export function useChatInit({
  thread, search, senderIdsKey, scrollRef, searchRef, senderIdsRef, dateIndexRef,
  deviceId, currentUserRef, loader, jump, setDateIndex, setChatVisible,
}: UseChatInitParams) {
  useEffect(() => {
    let id = localStorage.getItem('deviceId')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id) }
    deviceId.current = id

    apiFetch<DateIndex>(loader.withThread('/api/date-index'))
      .then(di => { setDateIndex(di); dateIndexRef.current = di })
      .catch(() => {})

    async function init() {
      let userName = currentUserRef.current
      if (!userName) {
        try {
          const d = await fetch('/api/auth/me').then(r => r.json())
          if (d?.name) { userName = d.name; currentUserRef.current = d.name }
        } catch {}
      }

      let startIdx = 0, anchorMsgId: string | null = null, anchorOffset = 0
      const urlMsgId = new URLSearchParams(window.location.search).get('msg')
      if (urlMsgId) {
        anchorMsgId = urlMsgId
        try {
          const jd = await apiFetch<{ index: number | null }>(loader.withThread('/api/jump?msgId=' + urlMsgId))
          if (jd.index != null) startIdx = jd.index
        } catch {}
      } else {
        try {
          const ns = `${userName ? userName + '-' : ''}${thread}`
          const bk = await apiFetch<{ msgId: string | null; offset: number }>(
            loader.withThread(`/api/bookmark?deviceId=${id}&ns=${encodeURIComponent(ns)}`),
          )
          if (bk.msgId) {
            anchorMsgId = bk.msgId; anchorOffset = bk.offset ?? 0
            const jd = await apiFetch<{ index: number | null }>(loader.withThread('/api/jump?msgId=' + bk.msgId))
            if (jd.index != null) startIdx = jd.index
          }
        } catch {}
      }

      loader.lowerOffset.current = Math.max(0, startIdx - Math.floor(LIMIT / 2))
      loader.upperOffset.current = loader.lowerOffset.current
      loader.loadingRef.current = true
      try { await loader.loadMessages('fresh') } catch {}

      if (urlMsgId) jump.scheduleScrollToMsg(urlMsgId)

      if (anchorMsgId && !urlMsgId && scrollRef.current) {
        const anchor = document.getElementById('msg-' + anchorMsgId)?.closest<HTMLElement>('.msg-group')
        if (anchor) {
          scrollRef.current.scrollTop = 0
          scrollRef.current.scrollTop = anchor.getBoundingClientRect().top
            - scrollRef.current.getBoundingClientRect().top
            - anchorOffset
        }
      }
      setChatVisible(true)
      loader.loadingRef.current = false

      const el = scrollRef.current
      if (el) {
        loader.loadingRef.current = true
        if (el.scrollTop < LOAD_THRESHOLD && loader.lowerOffset.current > 0) await loader.loadOlder().catch(() => {})
        if (el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && loader.hasMoreRef.current) await loader.loadNewer().catch(() => {})
        loader.loadingRef.current = false
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchEffectMounted = useRef(false)

  useEffect(() => {
    if (!searchEffectMounted.current) { searchEffectMounted.current = true; return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const trimmed = search.trim()
      if (/^[0-9a-f]{24}$/i.test(trimmed)) {
        loader.setSearching(true)
        try {
          const byBlock = await apiFetch<{ messages: Message[] }>(loader.withThread(`/api/messages?groupIds=${trimmed}`))
          const msgs = byBlock.messages.length
            ? byBlock.messages
            : (await apiFetch<{ messages: Message[] }>(loader.withThread(`/api/messages?ids=${trimmed}`))).messages
          if (msgs.length) {
            searchRef.current = ''
            loader.lowerOffset.current = 0; loader.upperOffset.current = 0
            loader.messagesRef.current = msgs; loader.setSearching(false)
            jump.pendingJump.current = msgs[0]._id
          }
        } catch {}
        loader.setSearching(false)
        return
      }
      searchRef.current = trimmed
      loader.lowerOffset.current = 0; loader.upperOffset.current = 0
      loader.setSearching(!!trimmed || (senderIdsRef.current?.length ?? 0) > 0)
      await loader.loadMessages('fresh')
      loader.setSearching(false)
    }, 350)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const senderEffectMounted = useRef(false)
  useEffect(() => {
    if (!senderEffectMounted.current) { senderEffectMounted.current = true; return }
    let cancelled = false
    ;(async () => {
      loader.lowerOffset.current = 0
      loader.upperOffset.current = 0
      loader.setSearching(true)
      try {
        await loader.loadMessages('fresh')
      } finally {
        if (!cancelled) loader.setSearching(false)
      }
    })()
    return () => { cancelled = true }
  }, [senderIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
