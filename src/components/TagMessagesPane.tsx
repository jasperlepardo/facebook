'use client'
import { useEffect, useRef, useState } from 'react'
import AppHeader from './AppHeader'
import HashtagPicker from './HashtagPicker'
import { Hashtag } from '@/types'
import { applyMessageHashtags } from '@/lib/applyHashtags'
import { isAbortError } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { pbSafe } from '@/lib/ui'

interface Props {
  hashtags: Hashtag[]
  thread: string
  messageIds: string[]
  messageCount: number
  onClose: () => void
  onApplied: () => void
  onReloadHashtags: () => void
}

function headerTitle(label: string) {
  return <span className="text-sm font-bold truncate">{label}</span>
}

export default function TagMessagesPane({
  hashtags, thread, messageIds, messageCount, onClose, onApplied, onReloadHashtags,
}: Props) {
  const [initialSelected, setInitialSelected] = useState<Set<string>>(() => new Set())
  const [selectionReady, setSelectionReady] = useState(false)
  const loadAbortRef = useRef<AbortController | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const ctrl = new AbortController()
    loadAbortRef.current = ctrl
    setSelectionReady(false)
    setInitialSelected(new Set())
    if (!messageIds.length) {
      setSelectionReady(true)
      return () => { ctrl.abort() }
    }
    fetch(`/api/hashtag-groups?messageIds=${messageIds.join(',')}&thread=${encodeURIComponent(thread)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        if (ctrl.signal.aborted) return
        setInitialSelected(new Set<string>(d.hashtagIds ?? []))
        setSelectionReady(true)
      })
      .catch(err => {
        if (isAbortError(err) || ctrl.signal.aborted) return
        setInitialSelected(new Set())
        setSelectionReady(true)
      })
    return () => { ctrl.abort() }
  }, [messageIds, thread])

  function handleClose() {
    loadAbortRef.current?.abort()
    onCloseRef.current()
  }

  const title = messageCount === 1 ? 'Tag message' : `Tag ${messageCount} messages`

  return (
    <div className={`flex-1 flex flex-col min-h-0 liquid-glass-atmosphere ${pbSafe} md:pb-0`}>
      <AppHeader title={headerTitle(title)} onBack={handleClose} embedded />
      <HashtagPicker
        hashtags={hashtags}
        initialSelected={initialSelected}
        ready={selectionReady}
        listClassName="flex-1"
        onClose={handleClose}
        onApply={async (hashtagIds, newNames, signal) => {
          try {
            await applyMessageHashtags({
              thread,
              messageIds,
              hashtagIds,
              newNames,
              hashtags,
              signal,
            })
            if (signal.aborted) return
            onReloadHashtags()
            onApplied()
          } catch (err) {
            if (isAbortError(err) || signal.aborted) return
            toast('Failed to apply hashtags')
          }
        }}
      />
    </div>
  )
}
