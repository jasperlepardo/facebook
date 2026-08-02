import { useEffect, Dispatch, SetStateAction } from 'react'
import { Thread, Hashtag } from '@/types'
import { apiFetch } from '@/lib/utils'
import { relTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { ContentTypeKey } from '@/lib/contentTypes'

type HiddenItem = { _id: string; type: 'message' | 'uri'; value: string }

interface UseViewerInitParams {
  activeThread: string
  /** Lazy-load media tab counts when the media child of the 3rd pane is open. */
  mediaPaneOpen: boolean
  setCurrentUser: Dispatch<SetStateAction<string>>
  setIsSuperAdmin: Dispatch<SetStateAction<boolean>>
  setShowHidden: Dispatch<SetStateAction<boolean>>
  setHideImages: Dispatch<SetStateAction<boolean>>
  setThreadMeta: Dispatch<SetStateAction<Record<string, { subtitle: string; badge: string }>>>
  setDbHiddenItems: Dispatch<SetStateAction<HiddenItem[]>>
  setHashtags: Dispatch<SetStateAction<Hashtag[]>>
  setEnabledTypes: Dispatch<SetStateAction<Set<ContentTypeKey>>>
  setInitialized: Dispatch<SetStateAction<boolean>>
  setThreads: Dispatch<SetStateAction<Thread[]>>
  setActiveThread: Dispatch<SetStateAction<string>>
  setMediaCounts: Dispatch<SetStateAction<Record<string, number>>>
}

/** Mount init, active-thread reload, and lazy media counts. */
export function useViewerInit({
  activeThread,
  mediaPaneOpen,
  setCurrentUser,
  setIsSuperAdmin,
  setShowHidden,
  setHideImages,
  setThreadMeta,
  setDbHiddenItems,
  setHashtags,
  setEnabledTypes,
  setInitialized,
  setThreads,
  setActiveThread,
  setMediaCounts,
}: UseViewerInitParams) {
  // ─── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const d = await fetch('/api/init').then(r => r.ok ? r.json() : null)
        if (!d) return

        if (d.user?.name) setCurrentUser(d.user.name)
        const isAdmin = !!d.user?.superAdmin
        if (isAdmin) setIsSuperAdmin(true)

        if (d.threadLastMsg && activeThread) {
          setThreadMeta(prev => ({
            ...prev,
            [activeThread]: { subtitle: d.threadLastMsg.subtitle, badge: relTime(d.threadLastMsg.ts) },
          }))
        }

        if (d.hiddenItems?.length) {
          setDbHiddenItems(d.hiddenItems)
        }

        if (Array.isArray(d.hashtags)) {
          setHashtags(d.hashtags.map((h: { id: string; name: string; thread?: string; context?: string; isPrivate?: boolean; createdBy?: string; createdById?: string; firstMsgTs?: number; groupCount?: number }) => ({
            id: h.id,
            name: h.name,
            thread: h.thread,
            context: h.context,
            isPrivate: h.isPrivate,
            createdBy: h.createdBy,
            createdById: h.createdById,
            firstMsgTs: h.firstMsgTs,
            groupCount: h.groupCount,
          })))
        }

        const settings = d.userSettings as {
          chatContentTypes?: ContentTypeKey[]
          hideImages?: boolean
          showHidden?: boolean
        } | undefined
        if (settings?.chatContentTypes) {
          setEnabledTypes(new Set<ContentTypeKey>(settings.chatContentTypes))
        }
        if (typeof settings?.hideImages === 'boolean') {
          setHideImages(settings.hideImages)
        }
        if (isAdmin) {
          setShowHidden(typeof settings?.showHidden === 'boolean' ? settings.showHidden : true)
        }
      } catch { toast('Failed to load app data') }
      finally { setInitialized(true) }
    }
    async function loadThreads() {
      try {
        const d = await apiFetch<{ threads: Thread[] }>('/api/threads')
        if (d.threads?.length) {
          const mapped = d.threads.map((t: Thread) => ({ ...t, id: t.collection }))
          setThreads(mapped)
          const urlThread = new URLSearchParams(window.location.search).get('thread')
          if (!urlThread) setActiveThread(mapped[0].id)
        }
      } catch { toast('Failed to load conversations') }
    }
    init()
    loadThreads()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reload thread-specific data when active thread changes ─────────────────

  useEffect(() => {
    if (!activeThread) return
    async function loadThreadData() {
      try {
        const d = await fetch(`/api/init?thread=${activeThread}`).then(r => r.ok ? r.json() : null)
        if (!d) return
        if (d.threadLastMsg) {
          setThreadMeta(prev => ({
            ...prev,
            [activeThread]: { subtitle: d.threadLastMsg.subtitle, badge: relTime(d.threadLastMsg.ts) },
          }))
        }
      } catch { toast('Failed to load conversation') }
    }
    loadThreadData()
    setMediaCounts({}) // reset until MediaPane asks for counts
  }, [activeThread])

  // Lazy media counts — only when MediaPane is open
  useEffect(() => {
    if (!mediaPaneOpen || !activeThread) return
    let cancelled = false
    fetch(`/api/init?thread=${activeThread}&mediaOnly=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled && d?.mediaCounts) setMediaCounts(d.mediaCounts)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [mediaPaneOpen, activeThread])
}
