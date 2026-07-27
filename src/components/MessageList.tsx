'use client'
import { useId } from 'react'
import { MessageBlock, LightboxState, DateIndex } from '@/types'
import MessageGroup from './MessageGroup'
import DateMenu from './DateMenu'

interface MessageListProps {
  blocks: MessageBlock[]
  onLightbox: (s: LightboxState) => void
  isSelected?: (firstMsgId: string) => boolean
  onToggle?: (id: string, ts: number, tsEnd: number, allIds: string[], blockId: string, shiftKey?: boolean) => void
  onContextMenu?: (e: React.MouseEvent, msgIds: string[]) => void
  dateIndex?: DateIndex | null
  onJumpTo?: (target: string) => void
  onOpenDatePicker?: () => void
  renderBlockActions?: (block: MessageBlock) => React.ReactNode
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  hiddenMsgIds?: Set<string>
  onHideMessage?: (msgId: string) => void
  onUnhideMessage?: (msgId: string) => void
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
}

export default function MessageList({
  blocks,
  onLightbox,
  isSelected,
  onToggle,
  onContextMenu,
  dateIndex,
  onJumpTo,
  onOpenDatePicker,
  renderBlockActions,
  hideImages,
  hiddenUris,
  isSuperAdmin,
  hiddenMsgIds,
  onHideMessage,
  onUnhideMessage,
  onHideUri,
  onUnhideUri,
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
        <div
          key={day.date + day.blocks[0].msgs[0]._id}
          id={`${uid}-${iso}`}
          data-day-iso={iso}
          className="flex flex-col"
        >
          <div className="dsep sticky top-0 z-10 flex items-center py-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-xs text-[#616061] dark:text-gray-400">
            <span className="flex-1 border-t border-gray-200 dark:border-gray-700" />
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
              <span className="px-3 font-semibold dark:text-gray-300">{day.date}</span>
            )}
            <span className="flex-1 border-t border-gray-200 dark:border-gray-700" />
          </div>
          {day.blocks.map((block, i) => (
            <div
              key={block.msgs[0]._id ?? i}
              className={renderBlockActions ? 'relative group/block' : undefined}
            >
              <MessageGroup
                block={block}
                isSelected={isSelected?.(block.msgs[0]._id) ?? false}
                onToggle={onToggle ?? (() => {})}
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
              />
              {renderBlockActions && (
                <div className="absolute top-2 right-2 opacity-0 group-hover/block:opacity-100 transition-opacity flex gap-1 z-10">
                  {renderBlockActions(block)}
                </div>
              )}
            </div>
          ))}
        </div>
        )
      })}
    </>
  )
}
