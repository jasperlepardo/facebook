'use client'

import { useEffect, useRef } from 'react'

export type HiddenSnapshot = {
  version: number
  messageIds: string[]
  uris: string[]
}

type Options = {
  enabled?: boolean
  onSnapshot: (snap: HiddenSnapshot) => void
}

/** Keep clients in sync with global hidden messageIds/uris via snapshot + SSE. */
export function useHiddenSync({ enabled = true, onSnapshot }: Options) {
  const onSnapshotRef = useRef(onSnapshot)
  useEffect(() => { onSnapshotRef.current = onSnapshot }, [onSnapshot])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let backoffMs = 1000

    const apply = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return
      const snap = raw as HiddenSnapshot
      if (!Array.isArray(snap.messageIds) || !Array.isArray(snap.uris)) return
      onSnapshotRef.current(snap)
    }

    const connect = () => {
      if (cancelled) return
      es = new EventSource('/api/hidden-items/stream')
      es.onmessage = (ev) => {
        try {
          apply(JSON.parse(ev.data))
          backoffMs = 1000
        } catch { /* ignore bad payloads */ }
      }
      es.onerror = () => {
        es?.close()
        es = null
        if (cancelled) return
        reconnectTimer = setTimeout(connect, backoffMs)
        backoffMs = Math.min(backoffMs * 2, 30_000)
      }
    }

    ;(async () => {
      try {
        const res = await fetch('/api/hidden-items/snapshot')
        if (res.ok && !cancelled) apply(await res.json())
      } catch { /* SSE will hydrate */ }
      if (!cancelled) connect()
    })()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [enabled])
}
