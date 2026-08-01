import { useRef, useEffect, Dispatch, SetStateAction } from 'react'
import { Section } from '@/types'

interface UseViewerUrlSyncParams {
  section: Section
  setSection: Dispatch<SetStateAction<Section>>
  activeThread: string
  setActiveThread: Dispatch<SetStateAction<string>>
  chatDetailOpen: boolean
  setChatDetailOpen: Dispatch<SetStateAction<boolean>>
  /** Resolved hashtag id (active or pending from URL). */
  hashtagId?: string | null
  hashtagTab?: 'context' | 'messages'
  /** False until URL hashtag restore finished (success or miss). */
  hashtagRestoreDone?: boolean
}

/** Sync section, chat thread/msg, and hashtag id/tab to/from the URL query string. */
export function useViewerUrlSync({
  section, setSection,
  activeThread, setActiveThread,
  chatDetailOpen, setChatDetailOpen,
  hashtagId = null,
  hashtagTab = 'context',
  hashtagRestoreDone = true,
}: UseViewerUrlSyncParams) {
  const mountedRef = useRef(false)
  /** Deep-link `h` captured on first mount — kept until restore completes. */
  const pendingHRef = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!mountedRef.current) {
      mountedRef.current = true
      const s = params.get('s')
      if (s === 'chat' || s === 'hashtags' || s === 'settings' || s === 'story') setSection(s)
      else if (params.get('h')) setSection('hashtags')
      if (params.get('msg')) setChatDetailOpen(true)
      const thread = params.get('thread')
      if (thread) {
        setActiveThread(thread)
        if ((!params.get('s') || params.get('s') === 'chat') && !params.get('h')) {
          setChatDetailOpen(true)
        }
      }
      pendingHRef.current = params.get('h')
      return
    }

    params.set('s', section)
    if (section !== 'chat') params.delete('msg')

    if (section === 'chat' && chatDetailOpen && activeThread) params.set('thread', activeThread)
    else params.delete('thread')

    const effectiveH = section === 'hashtags'
      ? (hashtagId ?? (hashtagRestoreDone ? null : pendingHRef.current))
      : null

    if (hashtagId) pendingHRef.current = hashtagId
    if (section !== 'hashtags' || (hashtagRestoreDone && !hashtagId)) pendingHRef.current = null

    if (effectiveH) {
      params.set('h', effectiveH)
      if (hashtagTab === 'messages') params.set('tab', 'messages')
      else params.delete('tab')
    } else {
      params.delete('h')
      params.delete('tab')
    }

    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [section, activeThread, chatDetailOpen, hashtagId, hashtagTab, hashtagRestoreDone])
}
