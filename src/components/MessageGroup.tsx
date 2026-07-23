'use client'
import { memo } from 'react'
import { Message, MessageBlock, LightboxState } from '@/types'
import { r2, fmtTime } from '@/lib/format'

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
        <div className="text-[13px] text-gray-600 mt-0.5">
          🔗 <a href={m.share.link} target="_blank" rel="noopener" className="text-blue-600">
            {m.share.link.slice(0, 80)}{m.share.link.length > 80 ? '…' : ''}
          </a>
        </div>
      )}
      {m.call_duration != null && (
        <div className="text-[13px] text-gray-500 italic mt-0.5">
          📞 {m.missed ? 'Missed call' : `Call${m.call_duration ? ` · ${Math.floor(m.call_duration / 60)}m ${m.call_duration % 60}s` : ''}`}
        </div>
      )}
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

interface Props {
  block: MessageBlock
  isSelected: boolean
  onToggle: (id: string, ts: number, tsEnd: number) => void
  onLightbox: (s: LightboxState) => void
}

const MessageGroup = memo(function MessageGroup({ block, isSelected, onToggle, onLightbox }: Props) {
  const first = block.msgs[0]
  const last  = block.msgs[block.msgs.length - 1]

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button,audio,video,img')) return
    onToggle(first._id, first.timestamp_ms, last.timestamp_ms)
  }

  return (
    <>
      {block.newDate && (
        <div className="dsep text-center my-5 mb-2 text-xs text-[#616061] relative">
          <span className="relative z-10 bg-gray-100 px-2.5 font-semibold">{block.date}</span>
          <span className="absolute top-1/2 left-0 right-0 border-t border-gray-200 -z-0" />
        </div>
      )}
      <div
        data-id={first._id}
        className={`msg-group flex py-2 px-5 gap-3 items-start relative cursor-pointer group transition-colors ${isSelected ? '!bg-blue-50' : 'hover:bg-gray-50'}`}
        onClick={handleClick}
      >
        <div className={`w-9 h-9 rounded flex-shrink-0 flex items-center justify-center font-black text-[15px] text-white mt-px ${block.mine ? 'bg-blue-600' : 'bg-purple-600'}`}>
          {(block.sender || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`font-bold text-sm ${block.mine ? 'text-blue-600' : 'text-gray-900'}`}>{block.sender}</span>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtTime(first.timestamp_ms)}</span>
          </div>
          {block.msgs.map((m, i) => (
            <div key={m._id ?? i}>
              <span id={`msg-${m._id}`} className="hidden" />
              {m.is_unsent
                ? <div className="text-[13px] text-gray-400 italic">Message removed</div>
                : m.content && <div className="text-sm leading-relaxed text-gray-900 break-words">{m.content}</div>
              }
              <Media m={m} onLightbox={onLightbox} />
            </div>
          ))}
        </div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={e => { e.stopPropagation(); onToggle(first._id, first.timestamp_ms, last.timestamp_ms) }}
          className="self-start mt-0.5 w-4 h-4 cursor-pointer opacity-0 group-hover:opacity-100 accent-blue-600 flex-shrink-0 transition-opacity"
          style={isSelected ? { opacity: 1 } : {}}
        />
      </div>
    </>
  )
})

export default MessageGroup
