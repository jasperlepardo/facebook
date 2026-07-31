import { useCallback, useEffect, useRef, useState } from 'react'
import { Message, MessageBlock, Hashtag } from '@/types'
import { apiFetch } from '@/lib/utils'
import { groupMessages } from '@/lib/groupMessages'
import { toast } from '@/lib/toast'

interface UseMessageSelectionParams {
  thread: string
  withThread: (url: string) => string
  hashtags: Hashtag[]
  onReloadHashtags: () => void
  messagesRef: React.RefObject<Message[]>
  blocksRef: React.RefObject<MessageBlock[]>
}

export function useMessageSelection({ thread, withThread, hashtags, onReloadHashtags, messagesRef, blocksRef }: UseMessageSelectionParams) {
  const [selectedMsgs, setSelectedMsgs]           = useState(new Map<string, { ts: number; tsEnd: number; allIds: string[] }>())
  const lastSelectedAnchor                         = useRef<{ id: string; ts: number; tsEnd: number } | null>(null)
  const [preloadedHashtagIds, setPreloadedHashtagIds] = useState<Set<string> | null>(null)
  const preloadTimer                               = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [hashtagPicker, setHashtagPicker]          = useState<{ msgIds: string[] } | null>(null)

  // Preload hashtag assignments for selected messages
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

  const handleToggle = useCallback(async (id: string, ts: number, tsEnd: number, allIds: string[], shiftKey?: boolean) => {
    if (shiftKey && lastSelectedAnchor.current) {
      const anchor = lastSelectedAnchor.current
      const anchorIdx = blocksRef.current.findIndex(b => b.msgs[0]._id === anchor.id)
      const clickedIdx = blocksRef.current.findIndex(b => b.msgs[0]._id === id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [start, end] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (let i = start; i <= end; i++) {
            const b = blocksRef.current[i]; const f = b.msgs[0]; const l = b.msgs[b.msgs.length - 1]
            next.set(f._id, { ts: f.timestamp_ms, tsEnd: l.timestamp_ms, allIds: b.msgs.map((m: Message) => m._id) })
          }
          return next
        })
      } else {
        try {
          const minTs = Math.min(anchor.ts, ts); const maxTs = Math.max(anchor.tsEnd, tsEnd)
          const data = await apiFetch<{ messages: Message[] }>(withThread(`/api/messages?tsFrom=${minTs}&tsTo=${maxTs}`))
          const rangeBlocks = groupMessages(data.messages)
          setSelectedMsgs(prev => {
            const next = new Map(prev)
            for (const b of rangeBlocks) {
              const f = b.msgs[0]; const l = b.msgs[b.msgs.length - 1]
              next.set(f._id, { ts: f.timestamp_ms, tsEnd: l.timestamp_ms, allIds: b.msgs.map((m: Message) => m._id) })
            }
            return next
          })
        } catch { toast('Failed to load message range') }
      }
      return
    }
    lastSelectedAnchor.current = { id, ts, tsEnd }
    setSelectedMsgs(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, { ts, tsEnd, allIds })
      return next
    })
  }, [withThread]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearSelection() {
    setSelectedMsgs(new Map())
    lastSelectedAnchor.current = null
    setPreloadedHashtagIds(null)
  }

  function openNoteFromSelection() {
    const msgIds = [...new Set([...selectedMsgs.values()].flatMap(v => v.allIds))]
    setHashtagPicker({ msgIds })
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
