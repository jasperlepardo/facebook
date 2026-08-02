import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { toast } from '@/lib/toast'
import type { HiddenSnapshot } from '@/hooks/useHiddenSync'

type HiddenItem = { _id: string; type: 'message' | 'uri'; value: string }

export function useHiddenState() {
  const [hiddenUris, setHiddenUris] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('hiddenUris') ?? '[]')) } catch { return new Set() }
  })
  const [dbHiddenItems, setDbHiddenItems] = useState<HiddenItem[]>([])
  const [syncedMsgIds, setSyncedMsgIds] = useState<Set<string>>(() => new Set())
  const [syncedUris, setSyncedUris] = useState<Set<string>>(() => new Set())

  const dbHiddenUris   = useMemo(() => new Set(dbHiddenItems.filter(i => i.type === 'uri').map(i => i.value)), [dbHiddenItems])
  const dbHiddenMsgIds = useMemo(() => new Set(dbHiddenItems.filter(i => i.type === 'message').map(i => i.value)), [dbHiddenItems])
  /** Global hidden message IDs — union of SSE snapshot + admin local CRUD. */
  const effectiveHiddenMsgIds = useMemo(
    () => new Set([...syncedMsgIds, ...dbHiddenMsgIds]),
    [syncedMsgIds, dbHiddenMsgIds],
  )
  const allHiddenUris  = useMemo(
    () => new Set([...dbHiddenUris, ...syncedUris, ...hiddenUris]),
    [dbHiddenUris, syncedUris, hiddenUris],
  )

  const dbHiddenItemsRef = useRef(dbHiddenItems)
  useEffect(() => { dbHiddenItemsRef.current = dbHiddenItems }, [dbHiddenItems])

  const applyHiddenSnapshot = useCallback((snap: HiddenSnapshot) => {
    setSyncedMsgIds(new Set(snap.messageIds))
    setSyncedUris(new Set(snap.uris))
  }, [])

  const hideUri = useCallback((uri: string) => {
    setHiddenUris(prev => {
      const next = new Set(prev)
      next.add(uri)
      localStorage.setItem('hiddenUris', JSON.stringify([...next]))
      return next
    })
  }, [])

  const handleHideMessage = useCallback(async (msgId: string) => {
    try {
      const res = await fetch('/api/hidden-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', value: msgId }),
      })
      const { item } = await res.json()
      if (item) {
        setDbHiddenItems(prev => [...prev.filter(i => !(i.type === 'message' && i.value === msgId)), { _id: item._id, type: 'message', value: msgId }])
        setSyncedMsgIds(prev => new Set(prev).add(msgId))
      }
    } catch { toast('Failed to hide message') }
  }, [])

  const handleUnhideMessage = useCallback(async (msgId: string) => {
    const item = dbHiddenItemsRef.current.find(i => i.type === 'message' && i.value === msgId)
    if (!item) return
    try {
      await fetch(`/api/hidden-items?id=${item._id}`, { method: 'DELETE' })
      setDbHiddenItems(prev => prev.filter(i => i._id !== item._id))
      setSyncedMsgIds(prev => {
        const next = new Set(prev)
        next.delete(msgId)
        return next
      })
    } catch { toast('Failed to unhide message') }
  }, [])

  const handleHideDbUri = useCallback(async (uri: string) => {
    try {
      const res = await fetch('/api/hidden-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'uri', value: uri }),
      })
      const { item } = await res.json()
      if (item) {
        setDbHiddenItems(prev => [...prev.filter(i => !(i.type === 'uri' && i.value === uri)), { _id: item._id, type: 'uri', value: uri }])
        setSyncedUris(prev => new Set(prev).add(uri))
      }
    } catch { toast('Failed to hide image') }
  }, [])

  const handleUnhideDbUri = useCallback(async (uri: string) => {
    const item = dbHiddenItemsRef.current.find(i => i.type === 'uri' && i.value === uri)
    if (!item) return
    try {
      await fetch(`/api/hidden-items?id=${item._id}`, { method: 'DELETE' })
      setDbHiddenItems(prev => prev.filter(i => i._id !== item._id))
      setSyncedUris(prev => {
        const next = new Set(prev)
        next.delete(uri)
        return next
      })
    } catch { toast('Failed to unhide image') }
  }, [])

  const clearHiddenUris = useCallback(() => {
    setHiddenUris(new Set())
    localStorage.removeItem('hiddenUris')
  }, [])

  return {
    hiddenUris,
    dbHiddenItems, setDbHiddenItems,
    dbHiddenMsgIds,
    effectiveHiddenMsgIds,
    allHiddenUris,
    applyHiddenSnapshot,
    hideUri,
    handleHideMessage,
    handleUnhideMessage,
    handleHideDbUri,
    handleUnhideDbUri,
    clearHiddenUris,
  }
}
