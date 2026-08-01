import { useCallback, useEffect, useRef, useState } from 'react'
import { Message, MessageBlock, Hashtag } from '@/types'
import { apiFetch } from '@/lib/utils'
import { groupMessages } from '@/lib/groupMessages'
import { toast } from '@/lib/toast'

export type SelectedMsg = { ts: number }

interface UseMessageSelectionParams {
  thread: string
  withThread: (url: string) => string
  hashtags: Hashtag[]
  onReloadHashtags: () => void
  messagesRef: React.RefObject<Message[]>
  blocksRef: React.RefObject<MessageBlock[]>
}

export function useMessageSelection({ thread, withThread, hashtags, onReloadHashtags, messagesRef: _messagesRef, blocksRef }: UseMessageSelectionParams) {
  const [selectedMsgs, setSelectedMsgs]           = useState(new Map<string, SelectedMsg>())
  const lastSelectedAnchor                         = useRef<{ id: string; ts: number } | null>(null)
  const [preloadedHashtagIds, setPreloadedHashtagIds] = useState<Set<string> | null>(null)
  const preloadTimer                               = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [hashtagPicker, setHashtagPicker]          = useState<{ msgIds: string[] } | null>(null)

  useEffect(() => {
    clearTimeout(preloadTimer.current)
    if (selectedMsgs.size === 0) { setPreloadedHashtagIds(null); return }
    const msgIds = [...selectedMsgs.keys()]
    preloadTimer.current = setTimeout(() => {
      fetch(`/api/hashtag-groups?messageIds=${msgIds.join(',')}&thread=${thread}`)
        .then(r => r.json())
        .then(d => setPreloadedHashtagIds(new Set<string>(d.hashtagIds ?? [])))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(preloadTimer.current)
  }, [selectedMsgs, thread])

  const handleToggle = useCallback(async (id: string, ts: number, _tsEnd: number, _allIds: string[], shiftKey?: boolean) => {
    if (shiftKey && lastSelectedAnchor.current) {
      const anchor = lastSelectedAnchor.current
      const findMsgIndex = (msgId: string) => {
        for (let bi = 0; bi < blocksRef.current.length; bi++) {
          if (blocksRef.current[bi].msgs.some(m => m._id === msgId)) return true
        }
        return false
      }
      const a = findMsgIndex(anchor.id)
      const c = findMsgIndex(id)
      if (a && c) {
        const flat: Message[] = []
        for (const b of blocksRef.current) flat.push(...b.msgs)
        const aIdx = flat.findIndex(m => m._id === anchor.id)
        const cIdx = flat.findIndex(m => m._id === id)
        if (aIdx !== -1 && cIdx !== -1) {
          const [start, end] = aIdx < cIdx ? [aIdx, cIdx] : [cIdx, aIdx]
          setSelectedMsgs(prev => {
            const next = new Map(prev)
            for (let i = start; i <= end; i++) {
              const m = flat[i]
              next.set(m._id, { ts: m.timestamp_ms })
            }
            return next
          })
          return
        }
      }
      try {
        const minTs = Math.min(anchor.ts, ts)
        const maxTs = Math.max(anchor.ts, ts)
        const data = await apiFetch<{ messages: Message[] }>(withThread(`/api/messages?tsFrom=${minTs}&tsTo=${maxTs}`))
        const rangeBlocks = groupMessages(data.messages)
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (const b of rangeBlocks) {
            for (const m of b.msgs) next.set(m._id, { ts: m.timestamp_ms })
          }
          return next
        })
      } catch { toast('Failed to load message range') }
      return
    }
    lastSelectedAnchor.current = { id, ts }
    setSelectedMsgs(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, { ts })
      return next
    })
  }, [withThread]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearSelection() {
    setSelectedMsgs(new Map())
    lastSelectedAnchor.current = null
    setPreloadedHashtagIds(null)
  }

  function openNoteFromSelection() {
    setHashtagPicker({ msgIds: [...selectedMsgs.keys()] })
  }

  function applyHashtags(hashtagIds: string[], newNames: string[]) {
    const messageIds = hashtagPicker?.msgIds ?? []
    const snapHashtags = hashtags
    setHashtagPicker(null); clearSelection()

    const tagMessages = (hashtagId: string) =>
      fetch('/api/hashtag-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtagId, messageIds, thread }),
      })

    Promise.all(newNames.map(name => {
      const existing = snapHashtags.find(h => h.name === name)
      if (existing) return Promise.resolve(existing.id as string | undefined)
      return fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, thread }) })
        .then(r => r.json()).then(d => d.doc?.id as string | undefined)
    }))
      .then(ids => Promise.all([...hashtagIds, ...ids.filter((id): id is string => !!id)].map(tagMessages)))
      .then(() => onReloadHashtags())
      .catch(() => toast('Failed to apply hashtags'))
  }

  return {
    selectedMsgs, setSelectedMsgs,
    preloadedHashtagIds,
    hashtagPicker, setHashtagPicker,
    handleToggle, clearSelection, openNoteFromSelection, applyHashtags,
  }
}
