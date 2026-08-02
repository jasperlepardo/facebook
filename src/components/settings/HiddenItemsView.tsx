'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LightboxState, Message } from '@/types'
import MessageList from '@/components/message/MessageList'
import MessageSelectionBar from '@/components/message/MessageSelectionBar'
import Lightbox from '@/components/Lightbox'
import ActionSheet from '@/components/ActionSheet'
import { SettingsRowsSkeleton } from '@/components/skeletons'
import { groupMessages } from '@/lib/groupMessages'
import { MessageActionDesc, actionsToSheet } from '@/lib/messageActions'
import { pbNav, toastPill, btnSecondaryInline } from '@/lib/ui'
import { toast } from '@/lib/toast'

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

interface OrphanItem {
  _id: string
  value: string
}

interface Props {
  onBack: () => void
  thread: string
  senderStyles?: Record<string, { initials: string; color: string }>
  onUnhideMessage: (id: string) => void
  onUnhideUri: (uri: string) => void
  onJumpToMessage?: (ts: number, msgId: string, thread?: string) => void
}

export default function HiddenItemsView({
  onBack, thread, senderStyles, onUnhideMessage, onJumpToMessage,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [hiddenMsgIds, setHiddenMsgIds] = useState<Set<string>>(new Set())
  const [orphans, setOrphans] = useState<OrphanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [sheetMsgIds, setSheetMsgIds] = useState<string[] | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [selectedMsgs, setSelectedMsgs] = useState(new Map<string, { ts: number }>())
  const lastAnchor = useRef<{ id: string; ts: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hidden-items/messages?thread=${encodeURIComponent(thread || 'messages')}`)
      if (!res.ok) { toast('Failed to load hidden items'); setMessages([]); return }
      const data = await res.json()
      setMessages(data.messages ?? [])
      setHiddenMsgIds(new Set(data.hiddenMsgIds ?? []))
      setOrphans(data.orphanedMessageItems ?? [])
      setSelectedMsgs(new Map())
      lastAnchor.current = null
    } catch {
      toast('Failed to load hidden items')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [thread])

  useEffect(() => { void load() }, [load])

  const blocks = useMemo(() => groupMessages(messages), [messages])

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2000)
  }, [])

  const handleToggle = useCallback((id: string, ts: number, _tsEnd: number, _allIds: string[], shiftKey?: boolean) => {
    if (shiftKey && lastAnchor.current) {
      const flat = blocks.flatMap(b => b.msgs)
      const aIdx = flat.findIndex(m => m._id === lastAnchor.current!.id)
      const cIdx = flat.findIndex(m => m._id === id)
      if (aIdx !== -1 && cIdx !== -1) {
        const [start, end] = aIdx < cIdx ? [aIdx, cIdx] : [cIdx, aIdx]
        setSelectedMsgs(prev => {
          const next = new Map(prev)
          for (let i = start; i <= end; i++) next.set(flat[i]._id, { ts: flat[i].timestamp_ms })
          return next
        })
        return
      }
    }
    lastAnchor.current = { id, ts }
    setSelectedMsgs(prev => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, { ts })
      return next
    })
  }, [blocks])

  const clearSelection = useCallback(() => {
    setSelectedMsgs(new Map())
    lastAnchor.current = null
  }, [])

  const clearOrphans = useCallback(async () => {
    if (!orphans.length) return
    setClearing(true)
    try {
      for (const o of orphans) onUnhideMessage(o.value)
      setOrphans([])
      showToast('Cleared orphaned entries')
    } catch {
      toast('Failed to clear orphaned entries')
    } finally {
      setClearing(false)
    }
  }, [orphans, onUnhideMessage, showToast])

  const makeActions = useCallback((msgIds: string[]): MessageActionDesc[] => {
    const msgs = messages.filter(m => msgIds.includes(m._id))
    const first = msgs.find(m => !m._id.startsWith('uri:')) ?? msgs[0]
    if (!first || first._id.startsWith('uri:') || !onJumpToMessage) return []
    return [{
      id: 'goToMessage',
      label: 'Go to message',
      iconKey: 'goToMessage',
      onPress: () => {
        clearSelection()
        onJumpToMessage(first.timestamp_ms, first._id, thread)
      },
    }]
  }, [messages, onJumpToMessage, thread, clearSelection])

  const selectedIds = useMemo(() => [...selectedMsgs.keys()], [selectedMsgs])
  const barActions = useMemo(() => makeActions(selectedIds), [makeActions, selectedIds])
  const sheetActions = useMemo(
    () => (sheetMsgIds ? makeActions(sheetMsgIds) : []),
    [sheetMsgIds, makeActions],
  )

  return (
    <div className={`relative flex flex-col flex-1 min-h-0 ${pbNav} md:pb-0`}>
      <div className={`flex-1 min-h-0 overflow-y-auto${selectedMsgs.size > 0 ? ' select-none' : ''}`}>
        <div className="mx-auto w-full max-w-2xl px-5 pt-8 pb-24 md:px-10 md:pt-12 [animation:fade-up_280ms_ease-out]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-mist-500 dark:text-mist-400 hover:text-mist-700 dark:hover:text-mist-200 mb-8"
          >
            <BackIcon /> Back
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500 dark:text-mist-400 mb-2">
            Super Admin
          </p>
          <h1 className="font-display text-3xl font-medium tracking-tight text-gray-900 dark:text-white mb-2">
            Hidden items
          </h1>
          <p className="text-sm text-mist-500 dark:text-mist-400 mb-6">
            Review hidden messages and media. Select a row, then Go to message.
          </p>

          {orphans.length > 0 && (
            <div className="liquid-glass rounded-2xl px-4 py-3 mb-6 flex items-center justify-between gap-3">
              <p className="text-sm text-mist-600 dark:text-mist-300">
                {orphans.length} hidden message{orphans.length === 1 ? '' : 's'} no longer in the archive
                <span className="text-mist-400 dark:text-mist-500"> (likely from a re-import)</span>
              </p>
              <button
                type="button"
                disabled={clearing}
                onClick={() => { void clearOrphans() }}
                className={btnSecondaryInline}
              >
                {clearing ? 'Clearing…' : 'Clear'}
              </button>
            </div>
          )}

          {loading ? (
            <SettingsRowsSkeleton />
          ) : messages.length === 0 ? (
            <p className="text-sm text-mist-400 text-center py-12">
              {orphans.length ? 'No resolvable hidden items left.' : 'No hidden items yet.'}
            </p>
          ) : (
            <MessageList
              blocks={blocks}
              onLightbox={setLightbox}
              selectedMsgIds={selectedMsgs}
              onToggle={handleToggle}
              isSuperAdmin
              hiddenMsgIds={hiddenMsgIds}
              onContextMenu={(e, msgIds) => {
                e.preventDefault()
                setSheetMsgIds(msgIds)
              }}
              senderStyles={senderStyles}
            />
          )}
        </div>
      </div>

      {selectedMsgs.size > 0 && barActions.length > 0 && (
        <MessageSelectionBar
          count={selectedMsgs.size}
          actions={barActions}
          onClear={clearSelection}
        />
      )}

      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
      {sheetMsgIds && sheetActions.length > 0 && (
        <ActionSheet
          onClose={() => setSheetMsgIds(null)}
          actions={actionsToSheet(sheetActions.map(a => ({
            ...a,
            onPress: () => { a.onPress(); setSheetMsgIds(null) },
          })))}
        />
      )}
      {toastMsg && (
        <div className={toastPill}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
