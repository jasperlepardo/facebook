import { useCallback, useRef } from 'react'
import { LOAD_THRESHOLD } from '@/lib/constants'

interface LoaderScrollApi {
  lowerOffset: React.MutableRefObject<number>
  hasMoreRef: React.MutableRefObject<boolean>
  loadingRef: React.MutableRefObject<boolean>
  loadOlder: () => Promise<void>
  loadNewer: () => Promise<void>
}

interface UseChatScrollParams {
  scrollRef: React.RefObject<HTMLDivElement | null>
  searchRef: React.RefObject<string>
  thread: string
  deviceId: React.MutableRefObject<string>
  currentUserRef: React.MutableRefObject<string>
  loader: LoaderScrollApi
}

/** Infinite scroll + debounced bookmark persistence for the chat pane. */
export function useChatScroll({
  scrollRef, searchRef, thread, deviceId, currentUserRef, loader,
}: UseChatScrollParams) {
  const bookmarkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const queuedLoad = useRef<'older' | 'newer' | null>(null)

  return useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const chatTop = el.getBoundingClientRect().top
    const id = deviceId.current
    if (id && !searchRef.current) {
      clearTimeout(bookmarkTimer.current)
      bookmarkTimer.current = setTimeout(() => {
        for (const g of el.querySelectorAll<HTMLElement>('.msg-group')) {
          const rect = g.getBoundingClientRect()
          if (rect.bottom > chatTop) {
            fetch('/api/bookmark', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                msgId: g.dataset.id,
                offset: Math.max(0, rect.top - chatTop),
                deviceId: id,
                ns: `${currentUserRef.current ? currentUserRef.current + '-' : ''}${thread}`,
              }),
            }).catch(() => {})
            break
          }
        }
      }, 1500)
    }
    const nearTop    = el.scrollTop < LOAD_THRESHOLD && loader.lowerOffset.current > 0
    const nearBottom = el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && loader.hasMoreRef.current
    if (loader.loadingRef.current || searchRef.current) {
      if (nearTop)    queuedLoad.current = 'older'
      if (nearBottom) queuedLoad.current = 'newer'
      return
    }
    const run = (fn: () => Promise<void>) => {
      loader.loadingRef.current = true
      fn().finally(async () => {
        const queued = queuedLoad.current; queuedLoad.current = null
        const qel = scrollRef.current
        const stillNearTop    = qel && qel.scrollTop < LOAD_THRESHOLD && loader.lowerOffset.current > 0
        const stillNearBottom = qel && qel.scrollTop + qel.clientHeight > qel.scrollHeight - LOAD_THRESHOLD && loader.hasMoreRef.current
        if (queued === 'older' && stillNearTop) await loader.loadOlder().catch(() => {})
        else if (queued === 'newer' && stillNearBottom) await loader.loadNewer().catch(() => {})
        loader.loadingRef.current = false
      })
    }
    if (nearTop) run(loader.loadOlder)
    else if (nearBottom) run(loader.loadNewer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
