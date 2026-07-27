'use client'
import { useEffect, useState } from 'react'
import { Message, LightboxState } from '@/types'
import { r2 } from '@/lib/format'

function VideoThumb({ src, onClick }: { src: string; onClick: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = src
    video.onloadedmetadata = () => { video.currentTime = 0.5 }
    video.onseeked = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      setThumb(canvas.toDataURL('image/jpeg', 0.8))
      video.src = ''
    }
    return () => { cancelled = true; video.src = '' }
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

export default function Media({ m, onLightbox }: { m: Message; onLightbox: (s: LightboxState) => void }) {
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
        <div className="mt-1 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
          {m.share.share_text && (
            <div className="text-[12px] text-gray-700 dark:text-gray-200 font-medium mb-0.5 line-clamp-2">{m.share.share_text}</div>
          )}
          <a href={m.share.link} target="_blank" rel="noopener" className="text-[12px] text-blue-500 dark:text-blue-400 break-all hover:underline">
            {m.share.link.slice(0, 80)}{m.share.link.length > 80 ? '…' : ''}
          </a>
        </div>
      )}
      {m.call_duration != null && (() => {
        const isVideo  = (m.content ?? '').toLowerCase().includes('video')
        const icon     = isVideo ? '📹' : '📞'
        const callType = isVideo ? 'Video call' : 'Call'
        if (m.missed) return (
          <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-red-400 dark:text-red-400">
            {icon} Missed {callType.toLowerCase()}
          </div>
        )
        const mins = Math.floor(m.call_duration / 60)
        const secs = m.call_duration % 60
        const dur  = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
        return (
          <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
            {icon} {callType} · {dur}
          </div>
        )
      })()}
      {!!m.reactions?.length && (
        <div className="flex gap-1 flex-wrap mt-1">
          {Object.entries(
            m.reactions.reduce((c, r) => ({ ...c, [r.reaction]: (c[r.reaction] ?? 0) + 1 }), {} as Record<string, number>)
          ).map(([r, n]) => (
            <span key={r} className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-1.5 py-0.5 text-xs">{r}{n > 1 ? ` ${n}` : ''}</span>
          ))}
        </div>
      )}
    </>
  )
}
