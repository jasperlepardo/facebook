import { useRef, useEffect, Dispatch, SetStateAction } from 'react'
import { Section } from '@/types'

export function initialSection(): Section {
  if (typeof window === 'undefined') return 'chat'
  const s = new URLSearchParams(window.location.search).get('s')
  return (s === 'hashtags' || s === 'settings' || s === 'story') ? s as Section : 'chat'
}

export function initialActiveThread(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('thread') ?? ''
}

export function initialChatDetailOpen(): boolean {
  if (typeof window === 'undefined') return false
  const p = new URLSearchParams(window.location.search)
  return !!(p.get('msg') || p.get('thread'))
}

interface UseViewerUrlSyncParams {
  section: Section
  setSection: Dispatch<SetStateAction<Section>>
  activeThread: string
  setActiveThread: Dispatch<SetStateAction<string>>
  chatDetailOpen: boolean
  setChatDetailOpen: Dispatch<SetStateAction<boolean>>
}

/** Sync section + open-chat thread (+ msg) to/from the URL query string. */
export function useViewerUrlSync({
  section, setSection,
  activeThread, setActiveThread,
  chatDetailOpen, setChatDetailOpen,
}: UseViewerUrlSyncParams) {
  const mountedRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!mountedRef.current) {
      mountedRef.current = true
      const s = params.get('s')
      if (s === 'hashtags' || s === 'settings' || s === 'story') setSection(s)
      if (params.get('msg')) setChatDetailOpen(true)
      const thread = params.get('thread')
      if (thread) {
        setActiveThread(thread)
        if (!params.get('s')) setChatDetailOpen(true)
      }
      return
    }
    if (section === 'chat') {
      params.delete('s')
    } else {
      params.set('s', section)
      params.delete('msg')
    }
    // Only put thread in the URL when the user opened a chat (or a deep link restored it).
    // Auto-selecting the first conversation on load must not rewrite `/` → `/?thread=…`.
    if (chatDetailOpen && activeThread) params.set('thread', activeThread)
    else params.delete('thread')
    if (section !== 'chat') params.delete('msg')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [section, activeThread, chatDetailOpen])
}
