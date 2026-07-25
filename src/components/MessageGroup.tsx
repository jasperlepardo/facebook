'use client'
import { memo } from 'react'
import { Message, MessageBlock, LightboxState } from '@/types'
import { r2, fmtTime } from '@/lib/format'
import { mapFbEmoji } from '@/lib/fbEmoji'

function Media({ m, onLightbox }: { m: Message; onLightbox: (s: LightboxState) => void }) {
  return (
    <>
      {m.photos?.map((p, i) => (
        <img key={i} src={r2(p.uri)} loading="lazy"
          className="max-w-[360px] max-h-[280px] rounded block cursor-pointer mt-1 hover:opacity-90"
          onClick={() => onLightbox({ src: r2(p.uri), type: 'photo', caption: '' })}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      ))}
      {m.videos?.map((v, i) => (
        <video key={i} src={r2(v.uri)} controls preload="none" className="max-w-[360px] rounded block mt-1" />
      ))}
      {m.audio_files?.map((a, i) => (
        <audio key={i} src={r2(a.uri)} controls preload="none" className="w-[280px] my-1 block" />
      ))}
      {m.gifs?.map((g, i) => (
        <img key={i} src={r2(g.uri)} loading="lazy"
          className="max-w-[360px] max-h-[280px] rounded block cursor-pointer mt-1"
          onClick={() => onLightbox({ src: r2(g.uri), type: 'gif', caption: '' })}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      ))}
      {m.sticker && (
        <img src={r2(m.sticker.uri)} loading="lazy" className="max-w-[72px] max-h-[72px]"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      )}
      {m.files?.map((f, i) => {
        const name = f.uri.split('/').pop() ?? ''
        return (
          <div key={i} className="text-[13px] mt-0.5">
            📎 <a href={r2(f.uri)} target="_blank" rel="noopener" className="text-blue-600">{name}</a>
          </div>
        )
      })}
      {m.share?.link && (
        <div className="mt-1 border-l-2 border-gray-200 pl-2">
          {m.share.share_text && (
            <div className="text-[12px] text-gray-700 font-medium mb-0.5 line-clamp-2">{m.share.share_text}</div>
          )}
          <a href={m.share.link} target="_blank" rel="noopener" className="text-[12px] text-blue-500 break-all hover:underline">
            {m.share.link.slice(0, 80)}{m.share.link.length > 80 ? '…' : ''}
          </a>
        </div>
      )}
      {m.call_duration != null && (() => {
        const isVideo   = (m.content ?? '').toLowerCase().includes('video')
        const icon      = isVideo ? '📹' : '📞'
        const callType  = isVideo ? 'Video call' : 'Call'
        if (m.missed) return (
          <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-red-400">
            {icon} Missed {callType.toLowerCase()}
          </div>
        )
        const mins = Math.floor(m.call_duration / 60)
        const secs = m.call_duration % 60
        const dur  = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
        return (
          <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-gray-500">
            {icon} {callType} · {dur}
          </div>
        )
      })()}
      {!!m.reactions?.length && (
        <div className="flex gap-1 flex-wrap mt-1">
          {Object.entries(m.reactions.reduce((c, r) => ({ ...c, [r.reaction]: (c[r.reaction] ?? 0) + 1 }), {} as Record<string, number>)).map(([r, n]) => (
            <span key={r} className="bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5 text-xs">{r}{n > 1 ? ` ${n}` : ''}</span>
          ))}
        </div>
      )}
    </>
  )
}

interface MessageGroupProps {
  block: MessageBlock
  isSelected: boolean
  onToggle: (id: string, ts: number, tsEnd: number, allIds: string[], blockId: string, shiftKey?: boolean) => void
  onLightbox: (s: LightboxState) => void
  onContextMenu?: (e: React.MouseEvent, msgIds: string[]) => void
}

const MessageGroup = memo(function MessageGroup({ block, isSelected, onToggle, onLightbox, onContextMenu }: MessageGroupProps) {
  const first = block.msgs[0]
  const last  = block.msgs[block.msgs.length - 1]

  const allIds = block.msgs.map(m => m._id)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button,audio,video,img')) return
    if (e.shiftKey) e.preventDefault()
    onToggle(first._id, first.timestamp_ms, last.timestamp_ms, allIds, first.blockId ?? first._id, e.shiftKey)
  }

  return (
    <>
      {block.newDate && (
        <div className="dsep text-center my-5 mb-2 text-xs text-[#616061] relative flex items-center">
          <span className="flex-1 border-t border-gray-200" />
          <span className="px-2.5 font-semibold bg-gray-50 whitespace-nowrap">{block.date}</span>
          <span className="flex-1 border-t border-gray-200" />
        </div>
      )}
      <div
        data-id={first._id}
        className={`msg-group flex py-2 px-5 gap-3 items-start relative cursor-pointer group transition-colors ${isSelected ? '!bg-blue-50' : 'hover:bg-gray-50'}`}
        onClick={handleClick}
        onContextMenu={e => onContextMenu?.(e, block.msgs.map(m => m._id))}
      >
        <div className={`w-9 h-9 rounded flex-shrink-0 flex items-center justify-center font-black text-[15px] text-white mt-px ${block.mine ? 'bg-blue-600' : 'bg-purple-600'}`}>
          {(block.sender || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`font-bold text-sm ${block.mine ? 'text-blue-600' : 'text-gray-900'}`}>{block.sender}</span>
          </div>
          {block.msgs.map((m, i) => (
            <div key={m._id ?? i} className="flex items-baseline gap-2">
              <div className="flex-1 min-w-0">
                <span id={`msg-${m._id}`} className="hidden" />
                {m.is_unsent
                  ? <div className="text-[13px] text-gray-400 italic">Message removed</div>
                  : m.call_duration != null
                    ? null
                    : (() => {
                        if (m.content !== 'You sent an attachment.') {
                          return m.content ? <div className="text-sm leading-relaxed text-gray-900 break-words">{mapFbEmoji(m.content)}</div> : null
                        }
                        const hasMedia = !!(m.photos?.length || m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share)
                        return hasMedia ? null : <div className="text-[12px] text-gray-300 italic">Attachment unavailable</div>
                      })()
                }
                <Media m={m} onLightbox={onLightbox} />
              </div>
              <span className="text-[11px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
          className="self-start mt-0.5 w-4 h-4 cursor-pointer opacity-0 group-hover:opacity-100 accent-blue-600 flex-shrink-0 transition-opacity"
          style={isSelected ? { opacity: 1 } : {}}
        />
      </div>
    </>
  )
})

export default MessageGroup
