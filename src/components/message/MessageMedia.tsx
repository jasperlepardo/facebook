/* Archive media is served via same-origin /api/media — next/image is intentionally unused. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { Message, LightboxState } from '@/types'
import { r2 } from '@/lib/format'
import { ContentTypeKey } from '@/lib/contentTypes'
import OgLinkCard from '@/components/OgLinkCard'
import { pill, pillIcon, pillLabel, pillSub, iconWell, card } from './MessageStyles'
import { renderCallPill } from './MessageCallPill'
import { mapFbEmoji } from '@/lib/fbEmoji'

export function imgCtx(e: React.MouseEvent, uri: string) {
  e.preventDefault(); e.stopPropagation()
  window.dispatchEvent(new CustomEvent('media-ctx', { detail: { x: e.clientX, y: e.clientY, uri } }))
}

export function VideoThumb({ src, onClick }: { src: string; onClick: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true; video.playsInline = true; video.preload = 'metadata'; video.src = src
    video.onloadedmetadata = () => { video.currentTime = 0.5 }
    video.onseeked = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        canvas.getContext('2d')?.drawImage(video, 0, 0)
        setThumb(canvas.toDataURL('image/jpeg', 0.8))
      } catch {}
      video.src = ''
    }
    return () => { cancelled = true; video.src = '' }
  }, [src])

  return (
    <div className="relative max-w-[360px] mt-1 cursor-pointer group bg-black rounded-sm overflow-hidden min-h-[120px]" onClick={onClick}>
      {thumb ? <img src={thumb} alt="" className="w-full rounded-sm block" /> : <div className="w-full min-h-[120px] bg-gray-900 rounded-sm" />}
      <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-sm group-hover:bg-black/40 transition-colors">
        <span className="text-white text-4xl drop-shadow-sm">▶</span>
      </div>
    </div>
  )
}

interface RenderMediaProps {
  m: Message
  show: (k: ContentTypeKey) => boolean
  onLightbox: (s: LightboxState) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
}

export function renderMedia({
  m, show, onLightbox, hideImages, hiddenUris, isSuperAdmin, onHideUri, onUnhideUri,
}: RenderMediaProps): React.ReactNode {
  return (
    <>
      {m.photos && show('photos') && !hideImages && (() => {
        const photos = m.photos!
        const visibleCount = photos.filter(p => !hiddenUris?.has(p.uri) || isSuperAdmin).length
        const gridCols = visibleCount >= 5 ? 'grid-cols-3' : visibleCount >= 2 ? 'grid-cols-2' : 'grid-cols-1'
        const cellSize = visibleCount === 1 ? 'w-[160px] aspect-square' : 'aspect-square'
        return (
          <div className={`mt-1 grid ${gridCols} gap-1 max-w-[300px]`}>
            {photos.map((p, i) => {
              const hidden = hiddenUris?.has(p.uri)
              if (hidden && !isSuperAdmin) return null
              if (hidden && isSuperAdmin) return (
                <div key={i} className={`relative group/img ${cellSize} overflow-hidden rounded-sm`}>
                  <div className="w-full h-full rounded-sm bg-gray-200 dark:bg-mist-700 flex flex-col items-center justify-center gap-1 border border-dashed border-gray-400 dark:border-mist-600">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Hidden</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onUnhideUri?.(p.uri) }} className="absolute bottom-1.5 right-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity text-[11px] bg-mist-600 hover:bg-mist-700 text-white px-2 py-0.5 rounded-full">Unhide</button>
                </div>
              )
              return (
                <div key={i} className={`relative group/img ${cellSize} overflow-hidden rounded-sm`}>
                  <img src={r2(p.uri)} alt="" loading="lazy"
                    className="w-full h-full object-cover block cursor-pointer hover:opacity-90"
                    onClick={() => onLightbox({ src: r2(p.uri), uri: p.uri, type: 'photo', mediaType: 'photos', caption: '', msgId: m._id, ts: m.timestamp_ms })}
                    onContextMenu={e => imgCtx(e, p.uri)}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  {isSuperAdmin && onHideUri && (
                    <button onClick={e => { e.stopPropagation(); onHideUri(p.uri) }} className="absolute bottom-1.5 right-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity text-[11px] bg-black/60 hover:bg-black/80 text-white px-2 py-0.5 rounded-full">Hide</button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {m.videos?.map((v, i) =>
        !show('videos') || hideImages || hiddenUris?.has(v.uri) ? null
          : <VideoThumb key={i} src={r2(v.uri)} onClick={() => onLightbox({ src: r2(v.uri), type: 'video', mediaType: 'videos', caption: '', msgId: m._id, ts: m.timestamp_ms })} />
      )}

      {m.audio_files?.map((a, i) =>
        !show('audio') ? null : <audio key={i} src={r2(a.uri)} controls preload="none" className="w-[280px] my-1 block" />
      )}

      {m.gifs?.map((g, i) =>
        !show('gifs') || hideImages || hiddenUris?.has(g.uri) ? null
          : <img key={i} src={r2(g.uri)} alt="" loading="lazy"
              className="max-w-[360px] max-h-[280px] rounded-sm block cursor-pointer mt-1"
              onClick={() => onLightbox({ src: r2(g.uri), type: 'gif', mediaType: 'gifs', caption: '', msgId: m._id, ts: m.timestamp_ms })}
              onContextMenu={e => imgCtx(e, g.uri)}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      )}

      {m.sticker && (!show('stickers') || hideImages || hiddenUris?.has(m.sticker.uri) ? null
        : <img src={r2(m.sticker.uri)} alt="" loading="lazy" className="max-w-[72px] max-h-[72px]"
            onContextMenu={e => imgCtx(e, m.sticker!.uri)}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      )}

      {m.files?.map((f, i) => {
        if (!show('files')) return null
        const name = f.uri.split('/').pop() ?? ''
        const ext = (name.split('.').pop() ?? '').toLowerCase()
        const date = f.creation_timestamp
          ? new Date(f.creation_timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null
        const previewable = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)
        const fileIcon = ext === 'xlsx' || ext === 'csv'
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
          : ext === 'zip' || ext === 'rar'
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>
        return (
          <button key={i} onClick={() => onLightbox({ src: r2(f.uri), type: 'file', caption: name, msgId: m._id, ts: m.timestamp_ms })}
            className={`mt-1 max-w-[260px] hover:opacity-80 transition-opacity ${pill}`}
          >
            <span className={iconWell}>{fileIcon}</span>
            <span className="min-w-0 flex-1 text-left">
              <span className={`block truncate ${pillLabel}`}>{name}</span>
              <span className={pillSub}>{ext.toUpperCase() || 'FILE'}{date ? ` · ${date}` : ''}</span>
            </span>
            {previewable
              ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pillIcon}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pillIcon}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            }
          </button>
        )
      })}

      {m.share?.link && (() => {
        if (!show('links')) return null
        const url = m.share.link
        const isFacebook = /^https?:\/\/(www\.)?facebook\.com/i.test(url)
        const isDirectImage = /\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(url)
        let host = ''
        try { host = new URL(url).hostname.replace(/^www\./, '') } catch {}
        if (isFacebook) return <OgLinkCard url={url} />
        if (isDirectImage) return (
          <div className="mt-1">
            <img src={url} alt="" loading="lazy"
              className="max-w-[320px] max-h-[240px] rounded-sm block cursor-pointer hover:opacity-90"
              onClick={() => onLightbox({ src: url, type: 'photo', caption: host, msgId: m._id, ts: m.timestamp_ms })}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            {host && <p className="text-[10px] text-mist-300 dark:text-mist-600 mt-0.5">{host}</p>}
          </div>
        )
        return (
          <a href={url} target="_blank" rel="noopener"
            className={`mt-1.5 flex flex-col max-w-[300px] overflow-hidden hover:opacity-80 transition-opacity ${card}`}
            style={{ textDecoration: 'none' }}
          >
            <div className="px-3 pt-3 pb-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" className="w-4 h-4 rounded-sm shrink-0"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                <span className="text-[10px] font-medium text-mist-400 dark:text-mist-500 uppercase tracking-wide truncate">{host}</span>
              </div>
              {m.share.share_text && <p className="text-[12px] font-semibold text-gray-800 dark:text-mist-100 line-clamp-2 leading-snug mb-1">{m.share.share_text}</p>}
              <p className="text-[11px] text-mist-400 dark:text-mist-500 truncate">{url.replace(/^https?:\/\//, '')}</p>
            </div>
          </a>
        )
      })()}

      {m.call_duration != null && show('calls') && renderCallPill(m.call_duration, !!m.missed, m.content)}

      {show('reactions') && !!m.reactions?.length && (
        <div className="flex gap-1 flex-wrap mt-1">
          {Object.entries(
            m.reactions.reduce((c, r) => {
              const key = mapFbEmoji(r.reaction)
              return { ...c, [key]: (c[key] ?? 0) + 1 }
            }, {} as Record<string, number>)
          ).map(([r, n]) => (
            <span key={r} className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-1.5 py-0.5 text-xs">{r}{n > 1 ? ` ${n}` : ''}</span>
          ))}
        </div>
      )}
    </>
  )
}
