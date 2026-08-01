import { useRef, useState, useCallback, useEffect } from 'react'
import { Hashtag } from '@/types'
import { apiFetch } from '@/lib/utils'

export function useHashtagPaneState() {
  const [hashtags, setHashtags]               = useState<Hashtag[]>([])
  const [hashtagFilter, setHashtagFilter]     = useState('')
  const [hashtagCreating, setHashtagCreating] = useState(false)
  const [pendingHashtag, setPendingHashtag]   = useState<Hashtag | null>(null)
  const [activeHashtagName, setActiveHashtagName] = useState<string | null>(null)
  const [hashtagActiveTab, setHashtagActiveTab]   = useState<'context' | 'messages'>('context')
  const [hashtagMsgFilter, setHashtagMsgFilter]   = useState('')
  /** Keep URL `h` alive across refresh until HashtagsPane finishes restore. */
  const [pendingUrlHashtagId, setPendingUrlHashtagId] = useState<string | null>(null)
  const [hashtagRestoreDone, setHashtagRestoreDone] = useState(false)

  const hashtagActionsRef = useRef<{ back: () => void; delete: () => void; rename: (name: string) => Promise<void> } | null>(null)

  // Read deep-link params after mount so SSR HTML matches the client.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const id = p.get('h')
    if (id) setPendingUrlHashtagId(id)
    else setHashtagRestoreDone(true)
    if (p.get('tab') === 'messages') setHashtagActiveTab('messages')
  }, [])

  const reloadHashtags = useCallback(async () => {
    const d = await apiFetch<{ docs: Hashtag[] }>('/api/hashtags?limit=200&sort=firstMsgTs&depth=0')
    setHashtags(d.docs ?? [])
  }, [])

  const selectActiveHashtag = useCallback((name: string | null) => {
    setActiveHashtagName(name)
    if (!name) {
      setPendingUrlHashtagId(null)
      setHashtagRestoreDone(true)
    }
  }, [])

  const resolveUrlHashtag = useCallback((id: string | null) => {
    setPendingUrlHashtagId(id)
    setHashtagRestoreDone(true)
  }, [])

  return {
    hashtags, setHashtags,
    hashtagFilter, setHashtagFilter,
    hashtagCreating, setHashtagCreating,
    pendingHashtag, setPendingHashtag,
    activeHashtagName, setActiveHashtagName,
    hashtagActiveTab, setHashtagActiveTab,
    hashtagMsgFilter, setHashtagMsgFilter,
    pendingUrlHashtagId,
    hashtagRestoreDone,
    resolveUrlHashtag,
    hashtagActionsRef,
    reloadHashtags,
    selectActiveHashtag,
  }
}
