'use client'
import { memo, useEffect, useRef, useState } from 'react'
import { Message, MessageBlock, LightboxState } from '@/types'
import { r2, fmtTime } from '@/lib/format'
import { mapFbEmoji } from '@/lib/fbEmoji'

function VideoThumb({ src, onClick }: { src: string; onClick: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = src
    video.onloadedmetadata = () => { video.currentTime = 0.5 }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      setThumb(canvas.toDataURL('image/jpeg', 0.8))
      video.src = ''
    }
  }, [src])

  return (
    <div className="relative max-w-[360px] mt-1 cursor-pointer group bg-black rounded overflow-hidden min-h-[120px]" onClick={onClick}>
      {thumb
        ? <img src={thumb} className="w-full rounded block" />
        : <div className="w-full min-h-[120px] bg-gray-900 rounded" />
      }
      <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded group-hover:bg-black/40 transition-colors">
        <span className="text-white text-4xl drop-shadow">▶</span>
      </div>
    </div>
  )
}

function Media({ m, onLightbox }: { m: Message; onLightbox: (s: LightboxState) => void }) {
  return (
    <>
      {m.photos?.map((p, i) => (
        <img key={i} src={r2(p.uri)} loading="lazy"
          className="max-w-[360px] max-h-[280px] rounded block cursor-pointer mt-1 hover:opacity-90"
          onClick={() => onLightbox({ src: r2(p.uri), type: 'photo', mediaType: 'photos', caption: '', msgId: m._id, ts: m.timestamp_ms })}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      ))}
      {m.videos?.map((v, i) => (
        <VideoThumb key={i} src={r2(v.uri)}
          onClick={() => onLightbox({ src: r2(v.uri), type: 'video', mediaType: 'videos', caption: '', msgId: m._id, ts: m.timestamp_ms })} />
      ))}
      {m.audio_files?.map((a, i) => (
        <audio key={i} src={r2(a.uri)} controls preload="none" className="w-[280px] my-1 block" />
      ))}
      {m.gifs?.map((g, i) => (
        <img key={i} src={r2(g.uri)} loading="lazy"
          className="max-w-[360px] max-h-[280px] rounded block cursor-pointer mt-1"
          onClick={() => onLightbox({ src: r2(g.uri), type: 'gif', mediaType: 'gifs', caption: '', msgId: m._id, ts: m.timestamp_ms })}
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

export function DateMenu({ date, ts, onJumpTo }: { date: string; ts?: number; onJumpTo: (target: string) => void }) {
  const [open, setOpen] = useState(false)
  const [showDateInput, setShowDateInput] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = () => { setSticky(''); setOpen(false); setShowDateInput(false) }
    const clickHandler = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', clickHandler)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', clickHandler)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  const setSticky = (z: string) => {
    const el = btnRef.current?.closest<HTMLElement>('.dsep')
    if (el) el.style.zIndex = z
  }

  const openMenu = () => {
    setOpen(o => { if (!o) setSticky('50'); return !o })
    setShowDateInput(false)
  }

  const select = (target: string) => { setSticky(''); setOpen(false); setShowDateInput(false); onJumpTo(target) }

  const localISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const iso = (offset: number) => {
    const d = new Date(ts ?? Date.now())
    d.setDate(d.getDate() + offset)
    return localISO(d)
  }
  const isoMonth = (offset: number) => {
    const d = new Date(ts ?? Date.now())
    d.setMonth(d.getMonth() + offset, 1)
    return localISO(d)
  }

  const options = [
    { label: 'Start from the beginning', val: 'beginning' },
    { label: 'Previous month',           val: isoMonth(-1) },
    { label: 'Previous week',            val: iso(-7) },
    { label: 'Previous day',             val: iso(-1) },
    { label: 'Next day',                 val: iso(1) },
    { label: 'Next week',                val: iso(7) },
    { label: 'Next month',               val: isoMonth(1) },
    { label: 'Most recent',              val: 'recent' },
  ]

  return (
    <div className="relative">
      <button ref={btnRef} onClick={openMenu}
        className="flex items-center gap-1 px-4 py-0.5 rounded-full font-semibold bg-white/93 border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap"
      >
        {date} <span className="text-[10px] opacity-60">▾</span>
      </button>

      {open && (
        <div ref={dropRef}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-56 py-2 text-left text-[13px]">
          <div className="px-4 py-1 text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Jump to…</div>
          {options.map(o => (
            <button key={o.label} onClick={() => select(o.val)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors">
              {o.label}
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            {showDateInput
              ? <input type="date" autoFocus className="mx-4 my-1 text-[13px] border border-gray-300 rounded px-2 py-1 outline-none"
                  onChange={e => { if (e.target.value) select(e.target.value) }} />
              : <button onClick={() => setShowDateInput(true)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors">
                  Jump to a specific date
                </button>
            }
          </div>
        </div>
      )}
    </div>
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
            <span className={`text-sm font-semibold ${block.mine ? 'text-blue-600' : 'text-gray-900'}`}>{block.sender}</span>
          </div>
          {block.msgs.map((m, i) => (
            <div key={m._id ?? i} className="flex items-baseline gap-2">
              <div className="flex-1 min-w-0">
                <span id={`msg-${m._id}`} className="hidden" />
                {m.media_failed
                  ? <div className="text-[12px] text-gray-400 italic flex items-center gap-1.5">
                      <span>🖼️</span><span>Media unavailable — Facebook could not export this file</span>
                    </div>
                  : m.content_unavailable
                  ? <div className="text-[12px] text-gray-400 italic flex items-center gap-1.5">
                      <span>📎</span><span>Content unavailable — legacy format not exported</span>
                    </div>
                  : m.ip
                  ? <div className="text-[12px] text-gray-400 italic flex items-center gap-1.5">
                      <span>📍</span><span>IP address logged: {m.ip}</span>
                    </div>
                  : m.is_unsent_image_by_messenger_kid_parent
                  ? <div className="text-[13px] text-gray-400 italic">Message removed</div>
                  : m.is_unsent
                  ? <div className="text-[13px] text-gray-400 italic">Message removed</div>
                  : m.call_duration != null
                    ? null
                    : (() => {
                        if (m.content !== 'You sent an attachment.') {
                          if (!m.content) return null
                          if (m.content === '[Link]') return (
                            <div className="text-[12px] text-gray-400 italic">🔗 Link (URL not captured)</div>
                          )
                          if (m.type === 'link' || /^https?:\/\/\S+$/.test(m.content)) return (
                            <div className="text-base leading-relaxed break-all">
                              <a href={m.content} target="_blank" rel="noopener" className="text-blue-500 hover:underline">
                                {m.content}
                              </a>
                            </div>
                          )
                          return <div className="text-base leading-relaxed text-gray-900 break-words whitespace-pre-wrap">{mapFbEmoji(m.content)}</div>
                        }
                        const hasMedia = !!(m.photos?.length || m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share?.link)
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
