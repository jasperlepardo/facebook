import { useRef, useState, useCallback } from 'react'
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
  const [showHashtagMenu, setShowHashtagMenu]     = useState(false)
  const [editingHashtagTitle, setEditingHashtagTitle] = useState(false)
  const [hashtagTitleInput, setHashtagTitleInput]     = useState('')

  const hashtagActionsRef     = useRef<{ back: () => void; delete: () => void; rename: (name: string) => Promise<void> } | null>(null)
  const hashtagTitleInputRef  = useRef<HTMLInputElement>(null)

  const reloadHashtags = useCallback(async () => {
    const d = await apiFetch<{ docs: Hashtag[] }>('/api/hashtags?limit=200&sort=firstMsgTs&depth=0')
    setHashtags(d.docs ?? [])
  }, [])

  const selectActiveHashtag = useCallback((name: string | null) => {
    setActiveHashtagName(name)
    if (name) {
      setHashtagActiveTab('context')
      setHashtagMsgFilter('')
    }
  }, [])

  return {
    hashtags, setHashtags,
    hashtagFilter, setHashtagFilter,
    hashtagCreating, setHashtagCreating,
    pendingHashtag, setPendingHashtag,
    activeHashtagName, setActiveHashtagName,
    hashtagActiveTab, setHashtagActiveTab,
    hashtagMsgFilter, setHashtagMsgFilter,
    showHashtagMenu, setShowHashtagMenu,
    editingHashtagTitle, setEditingHashtagTitle,
    hashtagTitleInput, setHashtagTitleInput,
    hashtagActionsRef,
    hashtagTitleInputRef,
    reloadHashtags,
    selectActiveHashtag,
  }
}
