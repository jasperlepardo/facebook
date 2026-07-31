'use client'
import { useEffect, useState } from 'react'
import { mapFbEmoji } from '@/lib/fbEmoji'
import { fmtTime } from '@/lib/format'
import ThreadAvatar from '@/components/ThreadAvatar'
import { renderCallPill } from '@/components/message/MessageCallPill'
import { MessageListSkeleton } from '@/components/skeletons'

interface CallItem { duration: number; missed: boolean; content?: string; ts: number; sender: string; msgId: string }

type CallType = 'answered-audio' | 'answered-video' | 'missed-audio' | 'missed-video'

const TYPE_LABELS: Record<CallType, string> = {
  'answered-audio': 'CALL — ANSWERED AUDIO',
  'answered-video': 'CALL — ANSWERED VIDEO',
  'missed-audio':   'CALL — MISSED',
  'missed-video':   'CALL — MISSED VIDEO',
}
const TYPE_ORDER: CallType[] = ['answered-audio', 'answered-video', 'missed-audio', 'missed-video']

function classifyCall(item: CallItem): CallType {
  const isVideo = (item.content ?? '').toLowerCase().includes('video')
  if (item.missed) return isVideo ? 'missed-video' : 'missed-audio'
  return isVideo ? 'answered-video' : 'answered-audio'
}

export default function CallsView({ thread = 'messages' }: { thread?: string }) {
  const [items, setItems] = useState<CallItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/attachments?type=calls&offset=0&limit=500&thread=${thread}`)
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .finally(() => setLoading(false))
  }, [thread])

  if (loading) return (
    <div className="flex-1 overflow-hidden bg-white dark:bg-mist-900">
      <MessageListSkeleton rows={6} />
    </div>
  )

  if (!items.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white dark:bg-mist-900 pb-12">
      <div className="w-14 h-14 rounded-2xl bg-mist-100 dark:bg-mist-800 flex items-center justify-center text-mist-400 dark:text-mist-500">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.71a16 16 0 0 0 5.38 5.38l1.81-1.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </div>
      <p className="text-sm text-mist-400 dark:text-mist-500">No calls yet</p>
    </div>
  )

  const groups = TYPE_ORDER
    .map(type => ({
      type,
      label: TYPE_LABELS[type],
      items: items.filter(i => classifyCall(i) === type).sort((a, b) => a.ts - b.ts),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-mist-900">
      {groups.map(group => (
        <div key={group.type}>
          <div className="flex items-center gap-3 px-4 pt-5 pb-3">
            <span className="text-[10px] font-semibold tracking-widest text-gray-400 dark:text-mist-500 whitespace-nowrap">{group.label}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-mist-700" />
          </div>

          {group.items.map((item, i) => {
            const sender = mapFbEmoji(item.sender)
            return (
              <div key={item.msgId || i} className="flex items-start gap-2 px-4 py-2">
                <div className="w-8 shrink-0 flex items-center justify-end mt-0.5">
                  <ThreadAvatar color="bg-gray-600 dark:bg-mist-600" initials={sender[0]?.toUpperCase() ?? '?'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sender}</span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">{fmtTime(item.ts)}</span>
                  </div>
                  {renderCallPill(item.duration, item.missed, item.content)}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
