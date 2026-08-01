'use client'
import { memo, useId } from 'react'
import { Message, MessageBlock, LightboxState, DateIndex } from '@/types'
import { ContentTypeKey } from '@/lib/contentTypes'
import MessageGroup from './MessageGroup'
import DateMenu from '@/components/DateMenu'
import StickyFrostedBar from '@/components/StickyFrostedBar'

interface MessageListProps {
  blocks: MessageBlock[]
  onLightbox: (s: LightboxState) => void
  selectedMsgIds?: ReadonlyMap<string, unknown>
  onToggle?: (id: string, ts: number, tsEnd: number, allIds: string[], shiftKey?: boolean) => void
  onContextMenu?: (e: React.MouseEvent, msgIds: string[]) => void
  dateIndex?: DateIndex | null
  onJumpTo?: (target: string) => void
  onOpenDatePicker?: () => void
  renderRowActions?: (msg: import('@/types').Message) => React.ReactNode
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  hiddenMsgIds?: Set<string>
  onHideMessage?: (msgId: string) => void
  onUnhideMessage?: (msgId: string) => void
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  enabledTypes?: Set<ContentTypeKey>
  senderStyles?: Record<string, { initials: string; color: string }>
}

const noop = () => {}

const MessageList = memo(function MessageList({
  blocks, onLightbox, selectedMsgIds, onToggle, onContextMenu,
  dateIndex, onJumpTo, onOpenDatePicker, renderRowActions,
  hideImages, hiddenUris, isSuperAdmin, hiddenMsgIds,
  onHideMessage, onUnhideMessage, onHideUri, onUnhideUri, enabledTypes, senderStyles,
}: MessageListProps) {
  const uid = useId()

  const days: { date: string; blocks: MessageBlock[] }[] = []
  for (const b of blocks) {
    if (b.newDate) days.push({ date: b.date, blocks: [] })
    days[days.length - 1]?.blocks.push(b)
  }

  return (
    <>
      {days.map((day, dayIdx) => {
        const iso = new Date(day.blocks[0].msgs[0].timestamp_ms).toISOString().split('T')[0]
        return (
          <div key={day.date + day.blocks[0].msgs[0]._id} id={`${uid}-${iso}`} data-day-iso={iso} className="flex flex-col">
            <StickyFrostedBar className="dsep flex items-center justify-center py-2.5 px-4 !border-b-0">
              <span className="flex-1 border-t border-black/8 dark:border-white/10" />
              <span className="mx-3 flex-shrink-0">
                {onJumpTo ? (
                  <DateMenu
                    date={day.date}
                    ts={day.blocks[0].msgs[0].timestamp_ms}
                    prevDayTs={dayIdx > 0 ? days[dayIdx - 1].blocks[0].msgs[0].timestamp_ms : undefined}
                    nextDayTs={dayIdx < days.length - 1 ? days[dayIdx + 1].blocks[0].msgs[0].timestamp_ms : undefined}
                    dateIndex={dateIndex}
                    onJumpTo={onJumpTo}
                    onOpenDatePicker={onOpenDatePicker}
                  />
                ) : (
                  <span className="liquid-glass text-[11px] font-semibold text-mist-500 dark:text-mist-400 px-3 py-1 rounded-full">
                    {day.date}
                  </span>
                )}
              </span>
              <span className="flex-1 border-t border-black/8 dark:border-white/10" />
            </StickyFrostedBar>
            {day.blocks.map((block, i) => (
              <MessageGroup
                key={block.msgs[0]._id ?? i}
                block={block}
                selectedMsgIds={selectedMsgIds}
                onToggle={onToggle ?? noop}
                onLightbox={onLightbox}
                onContextMenu={onContextMenu}
                hideImages={hideImages}
                hiddenUris={hiddenUris}
                isSuperAdmin={isSuperAdmin}
                hiddenMsgIds={hiddenMsgIds}
                onHideMessage={onHideMessage}
                onUnhideMessage={onUnhideMessage}
                onHideUri={onHideUri}
                onUnhideUri={onUnhideUri}
                enabledTypes={enabledTypes}
                renderRowActions={renderRowActions}
                senderStyles={senderStyles}
              />
            ))}
          </div>
        )
      })}
    </>
  )
})

export default MessageList
