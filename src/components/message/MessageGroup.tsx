'use client'
import { memo, useRef } from 'react'
import { Message, MessageBlock, LightboxState } from '@/types'
import { fmtTime, fmtTimeShort } from '@/lib/format'
import { ContentTypeKey } from '@/lib/contentTypes'
import ThreadAvatar from '@/components/ThreadAvatar'
import { rowBase, rowSel, rowUnsel, timeCls, actionsCls } from './MessageStyles'
import { renderContent } from './MessageContent'
import { renderMedia } from './MessageMedia'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MessageGroupProps {
  block: MessageBlock
  selectedMsgIds?: ReadonlyMap<string, unknown>
  onToggle: (id: string, ts: number, tsEnd: number, allIds: string[], shiftKey?: boolean) => void
  onLightbox: (s: LightboxState) => void
  onContextMenu?: (e: React.MouseEvent, msgIds: string[]) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  hiddenMsgIds?: Set<string>
  onHideMessage?: (msgId: string) => void
  onUnhideMessage?: (msgId: string) => void
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  enabledTypes?: Set<ContentTypeKey>
  renderRowActions?: (msg: Message) => React.ReactNode
  senderColor?: string
}

interface RowSharedProps {
  block: MessageBlock
  isFirst: boolean
  isSel: boolean
  isSuperAdmin?: boolean
  hiddenMsgIds?: Set<string>
  hideImages?: boolean
  hiddenUris?: Set<string>
  enabledTypes?: Set<ContentTypeKey>
  onToggle: MessageGroupProps['onToggle']
  onLightbox: MessageGroupProps['onLightbox']
  onContextMenu?: MessageGroupProps['onContextMenu']
  onHideMessage?: (id: string) => void
  onUnhideMessage?: (id: string) => void
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  renderRowActions?: (msg: Message) => React.ReactNode
  senderColor?: string
  longPressTimer: React.RefObject<ReturnType<typeof setTimeout> | undefined>
  touchPos: React.RefObject<{ x: number; y: number }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isBlankMsg(m: Message): boolean {
  if (m.media_failed || m.content_unavailable || m.is_unsent || m.is_unsent_image_by_messenger_kid_parent) return false
  if (m.call_duration != null) return false
  const hasMedia = !!(m.photos?.length || m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share?.link)
  if (hasMedia || m.reactions?.length) return false
  if (m.ip && !m.content) return false
  if (!m.content) return true
  if (/sent (a link|a group)\.$/.test(m.content)) return true
  return false
}

function isPhotoOnlyMsg(m: Message): boolean {
  if (!m.photos?.length) return false
  if (m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share?.link) return false
  if (m.call_duration != null || m.media_failed || m.content_unavailable || m.is_unsent || m.is_unsent_image_by_messenger_kid_parent) return false
  if (m.content && !/^sent an attachment\.$/.test(m.content)) return false
  return true
}

// ─── MessageRow ───────────────────────────────────────────────────────────────

const MessageRow = memo(function MessageRow({
  m, block, isFirst, isSel, isSuperAdmin, hiddenMsgIds, hideImages, hiddenUris,
  enabledTypes, onToggle, onLightbox, onContextMenu,
  onHideMessage, onUnhideMessage, onHideUri, onUnhideUri, renderRowActions, senderColor,
  longPressTimer, touchPos,
}: RowSharedProps & { m: Message }) {
  const show = (k: ContentTypeKey) => !enabledTypes || enabledTypes.has(k)
  const isHidden = !!isSuperAdmin && !!m._id && !!hiddenMsgIds?.has(m._id)
  const hasMedia = !!(m.photos?.length || m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share?.link)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button,audio,video,img')) return
    if (e.shiftKey) e.preventDefault()
    onToggle(m._id, m.timestamp_ms, m.timestamp_ms, [m._id], e.shiftKey)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onContextMenu || e.touches.length !== 1) return
    const t = e.touches[0]
    touchPos.current = { x: t.clientX, y: t.clientY }
    longPressTimer.current = setTimeout(() => {
      onContextMenu({ clientX: touchPos.current.x, clientY: touchPos.current.y, preventDefault: () => {}, _fromTouch: true } as unknown as React.MouseEvent, [m._id])
    }, 500)
  }

  return (
    <div
      id={`msg-${m._id}`}
      data-id={isFirst ? m._id : undefined}
      className={`${rowBase} ${isSel ? rowSel : rowUnsel}`}
      style={{ WebkitTouchCallout: 'none' }}
      onClick={handleClick}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, [m._id]) }}
      onTouchStart={handleTouchStart}
      onTouchEnd={() => clearTimeout(longPressTimer.current)}
      onTouchMove={() => clearTimeout(longPressTimer.current)}
    >
      <div className="w-8 shrink-0 flex items-center justify-end">
        {isFirst
          ? <ThreadAvatar color={block.mine ? 'bg-mist-600' : (senderColor ?? 'bg-purple-600')} initials={(block.sender || '?')[0].toUpperCase()} />
          : <span className={timeCls}>{fmtTimeShort(m.timestamp_ms)}</span>
        }
      </div>

      <div className={`flex-1 min-w-0${isHidden ? ' opacity-40' : ''}`}>
        {isFirst && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-sm font-semibold ${block.mine ? 'text-mist-600 dark:text-mist-400' : 'text-gray-900 dark:text-gray-100'}`}>{block.sender}</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{fmtTime(m.timestamp_ms)}</span>
          </div>
        )}
        {renderContent(m, isHidden, hasMedia, show)}
        {renderMedia({ m, show, onLightbox, hideImages, hiddenUris, isSuperAdmin, onHideUri, onUnhideUri })}
      </div>

      <div className={actionsCls(isSel)} onClick={e => e.stopPropagation()}>
        {renderRowActions ? renderRowActions(m) : (
          <>
            {isSuperAdmin && m._id && (
              <button
                onClick={e => { e.stopPropagation(); isHidden ? onUnhideMessage?.(m._id) : onHideMessage?.(m._id) }}
                className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${isHidden ? 'text-mist-400 hover:text-mist-600' : 'text-red-400 hover:text-red-600'}`}
              >
                {isHidden ? 'Unhide' : 'Hide'}
              </button>
            )}
            <input
              type="checkbox"
              checked={isSel}
              onChange={() => {}}
              onClick={e => { e.stopPropagation(); onToggle(m._id, m.timestamp_ms, m.timestamp_ms, [m._id], e.shiftKey) }}
              className="w-4 h-4 cursor-pointer accent-mist-600 shrink-0"
            />
          </>
        )}
      </div>
    </div>
  )
})

// ─── MessageGroup ─────────────────────────────────────────────────────────────

const MessageGroup = memo(function MessageGroup({
  block, selectedMsgIds, onToggle, onLightbox, onContextMenu,
  hideImages, hiddenUris, isSuperAdmin, hiddenMsgIds,
  onHideMessage, onUnhideMessage, onHideUri, onUnhideUri, enabledTypes, renderRowActions, senderColor,
}: MessageGroupProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const touchPos = useRef({ x: 0, y: 0 })

  if (block.msgs.every(isBlankMsg)) return null

  const canGroup = (!enabledTypes || enabledTypes.has('photos')) && !hideImages

  // Merge consecutive photo-only messages into one augmented message for compact grid display
  const msgs: Message[] = []
  let i = 0
  while (i < block.msgs.length) {
    const m = block.msgs[i]
    if (canGroup && isPhotoOnlyMsg(m)) {
      const photos = [...(m.photos ?? [])]
      while (i + 1 < block.msgs.length && isPhotoOnlyMsg(block.msgs[i + 1])) {
        i++
        photos.push(...(block.msgs[i].photos ?? []))
      }
      msgs.push({ ...m, photos })
    } else {
      msgs.push(m)
    }
    i++
  }

  const shared: Omit<RowSharedProps, 'isFirst' | 'isSel'> = {
    block, isSuperAdmin, hiddenMsgIds, hideImages, hiddenUris, enabledTypes,
    onToggle, onLightbox, onContextMenu,
    onHideMessage, onUnhideMessage, onHideUri, onUnhideUri, renderRowActions, senderColor,
    longPressTimer, touchPos,
  }

  return (
    <div data-id={block.msgs[0]._id} className="msg-group flex flex-col">
      {msgs.map((m, idx) => {
        if (isBlankMsg(m)) return null
        return (
          <MessageRow
            key={m._id ?? idx}
            m={m}
            isFirst={idx === 0}
            isSel={!!selectedMsgIds?.has(m._id)}
            {...shared}
          />
        )
      })}
    </div>
  )
})

export default MessageGroup
