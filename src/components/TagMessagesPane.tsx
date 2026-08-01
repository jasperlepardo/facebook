'use client'
import { useEffect, useState } from 'react'
import AppHeader from './AppHeader'
import HashtagPicker from './HashtagPicker'
import { Hashtag } from '@/types'
import { applyMessageHashtags } from '@/lib/applyHashtags'
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
  const [initialSelected, setInitialSelected] = useState<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    setInitialSelected(null)
    if (!messageIds.length) {
      setInitialSelected(new Set())
      return
    }
    fetch(`/api/hashtag-groups?messageIds=${messageIds.join(',')}&thread=${thread}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setInitialSelected(new Set<string>(d.hashtagIds ?? []))
      })
      .catch(() => {
        if (!cancelled) setInitialSelected(new Set())
      })
    return () => { cancelled = true }
  }, [messageIds, thread])

  const title = messageCount === 1 ? 'Tag message' : `Tag ${messageCount} messages`

  return (
    <div className={`flex-1 flex flex-col min-h-0 bg-white dark:bg-mist-900 ${pbSafe} md:pb-0`}>
      <AppHeader title={headerTitle(title)} onBack={onClose} embedded />
      {initialSelected ? (
        <HashtagPicker
          key={[...messageIds].sort().join(',') + [...initialSelected].sort().join(',')}
          hashtags={hashtags}
          initialSelected={initialSelected}
          listClassName="flex-1"
          onClose={onClose}
          onApply={async (hashtagIds, newNames) => {
            try {
              await applyMessageHashtags({
                thread,
                messageIds,
                hashtagIds,
                newNames,
                hashtags,
              })
              onReloadHashtags()
              onApplied()
            } catch {
              toast('Failed to apply hashtags')
            }
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-mist-400">Loading…</div>
      )}
    </div>
  )
}
