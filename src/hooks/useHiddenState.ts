import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { toast } from '@/lib/toast'

type HiddenItem = { _id: string; type: 'message' | 'uri'; value: string }

export function useHiddenState() {
  const [hiddenUris, setHiddenUris] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('hiddenUris') ?? '[]')) } catch { return new Set() }
  })
  const [dbHiddenItems, setDbHiddenItems] = useState<HiddenItem[]>([])

  const dbHiddenUris   = useMemo(() => new Set(dbHiddenItems.filter(i => i.type === 'uri').map(i => i.value)), [dbHiddenItems])
  const dbHiddenMsgIds = useMemo(() => new Set(dbHiddenItems.filter(i => i.type === 'message').map(i => i.value)), [dbHiddenItems])
  const allHiddenUris  = useMemo(() => new Set([...dbHiddenUris, ...hiddenUris]), [dbHiddenUris, hiddenUris])

  const dbHiddenItemsRef = useRef(dbHiddenItems)
  useEffect(() => { dbHiddenItemsRef.current = dbHiddenItems }, [dbHiddenItems])

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
      if (item) setDbHiddenItems(prev => [...prev.filter(i => !(i.type === 'message' && i.value === msgId)), { _id: item._id, type: 'message', value: msgId }])
    } catch { toast('Failed to hide message') }
  }, [])

  const handleUnhideMessage = useCallback(async (msgId: string) => {
    const item = dbHiddenItemsRef.current.find(i => i.type === 'message' && i.value === msgId)
    if (!item) return
    try {
      await fetch(`/api/hidden-items?id=${item._id}`, { method: 'DELETE' })
      setDbHiddenItems(prev => prev.filter(i => i._id !== item._id))
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
      if (item) setDbHiddenItems(prev => [...prev.filter(i => !(i.type === 'uri' && i.value === uri)), { _id: item._id, type: 'uri', value: uri }])
    } catch { toast('Failed to hide image') }
  }, [])

  const handleUnhideDbUri = useCallback(async (uri: string) => {
    const item = dbHiddenItemsRef.current.find(i => i.type === 'uri' && i.value === uri)
    if (!item) return
    try {
      await fetch(`/api/hidden-items?id=${item._id}`, { method: 'DELETE' })
      setDbHiddenItems(prev => prev.filter(i => i._id !== item._id))
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
    allHiddenUris,
    hideUri,
    handleHideMessage,
    handleUnhideMessage,
    handleHideDbUri,
    handleUnhideDbUri,
    clearHiddenUris,
  }
}
