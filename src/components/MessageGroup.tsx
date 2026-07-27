'use client'
import { memo } from 'react'
import { Message, MessageBlock, LightboxState } from '@/types'
import { fmtTime } from '@/lib/format'
import { mapFbEmoji } from '@/lib/fbEmoji'
import Media from './Media'

interface MessageGroupProps {
  block: MessageBlock
  isSelected: boolean
  onToggle: (id: string, ts: number, tsEnd: number, allIds: string[], blockId: string, shiftKey?: boolean) => void
  onLightbox: (s: LightboxState) => void
  onContextMenu?: (e: React.MouseEvent, msgIds: string[]) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
}

const MessageGroup = memo(function MessageGroup({ block, isSelected, onToggle, onLightbox, onContextMenu, hideImages, hiddenUris }: MessageGroupProps) {
  const first = block.msgs[0]
  const last  = block.msgs[block.msgs.length - 1]
  const allIds = block.msgs.map(m => m._id)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button,audio,video,img')) return
    if (e.shiftKey) e.preventDefault()
    onToggle(first._id, first.timestamp_ms, last.timestamp_ms, allIds, first.blockId ?? first._id, e.shiftKey)
  }

  return (
    <div
      data-id={first._id}
      className={`msg-group flex py-2 px-5 gap-3 items-start relative cursor-pointer group transition-colors ${isSelected ? '!bg-blue-50 dark:!bg-blue-900/20' : '[@media(hover:hover)]:hover:bg-gray-50 dark:[@media(hover:hover)]:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-800/60'}`}
      onClick={handleClick}
      onContextMenu={e => onContextMenu?.(e, block.msgs.map(m => m._id))}
    >
      <div className={`w-9 h-9 rounded flex-shrink-0 flex items-center justify-center font-black text-[15px] text-white mt-px ${block.mine ? 'bg-blue-600' : 'bg-purple-600'}`}>
        {(block.sender || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-sm font-semibold ${block.mine ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>{block.sender}</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{fmtTime(first.timestamp_ms)}</span>
        </div>
        {block.msgs.map((m, i) => (
          <div key={m._id ?? i} className="[@media(hover:hover)]:flex [@media(hover:hover)]:items-end [@media(hover:hover)]:gap-3">
            <div className="min-w-0 flex-1">
              <span id={`msg-${m._id}`} className="hidden" />
              {m.media_failed
                ? <div className="text-[12px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5">
                    <span>🖼️</span><span>Media unavailable — Facebook could not export this file</span>
                  </div>
                : m.content_unavailable
                ? <div className="text-[12px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5">
                    <span>📎</span><span>Content unavailable — legacy format not exported</span>
                  </div>
                : m.ip
                ? <div className="text-[12px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5">
                    <span>📍</span><span>IP address logged: {m.ip}</span>
                  </div>
                : m.is_unsent_image_by_messenger_kid_parent
                ? <div className="text-[13px] text-gray-400 dark:text-gray-500 italic">Message removed</div>
                : m.is_unsent
                ? <div className="text-[13px] text-gray-400 dark:text-gray-500 italic">Message removed</div>
                : m.call_duration != null
                  ? null
                  : (() => {
                      if (m.content !== 'You sent an attachment.') {
                        if (!m.content) return null
                        if (m.content === '[Link]') return (
                          <div className="text-[12px] text-gray-400 dark:text-gray-500 italic">🔗 Link (URL not captured)</div>
                        )
                        if (m.type === 'link' || /^https?:\/\/\S+$/.test(m.content)) return (
                          <div className="text-base leading-relaxed break-all">
                            <a href={m.content} target="_blank" rel="noopener" className="text-blue-500 dark:text-blue-400 hover:underline">
                              {m.content}
                            </a>
                          </div>
                        )
                        return <div className="text-base leading-relaxed text-gray-900 dark:text-gray-100 break-words whitespace-pre-wrap">{mapFbEmoji(m.content)}</div>
                      }
                      const hasMedia = !!(m.photos?.length || m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share?.link)
                      return hasMedia ? null : <div className="text-[12px] text-gray-400 dark:text-gray-600 italic">Attachment unavailable</div>
                    })()
              }
              <Media m={m} onLightbox={onLightbox} hideImages={hideImages} hiddenUris={hiddenUris} />
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:pb-0.5">
              {fmtTime(m.timestamp_ms)}
            </span>
          </div>
        ))}
      </div>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => {}}
        onClick={e => { e.stopPropagation(); onToggle(first._id, first.timestamp_ms, last.timestamp_ms, allIds, first.blockId ?? first._id, e.shiftKey) }}
        className="self-start mt-0.5 w-4 h-4 cursor-pointer opacity-0 [@media(hover:hover)]:group-hover:opacity-100 accent-blue-600 flex-shrink-0 transition-opacity"
        style={isSelected ? { opacity: 1 } : {}}
      />
    </div>
  )
})

export default MessageGroup
