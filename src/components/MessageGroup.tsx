'use client'
import { memo, useEffect, useRef, useState } from 'react'
import { Message, MessageBlock, LightboxState } from '@/types'
import { fmtTime, fmtTimeShort, r2 } from '@/lib/format'
import { mapFbEmoji } from '@/lib/fbEmoji'
import { ContentTypeKey } from '@/lib/contentTypes'
import OgLinkCard from '@/components/OgLinkCard'
import ThreadAvatar from '@/components/ThreadAvatar'

// ─── VideoThumb ──────────────────────────────────────────────────────────────

function VideoThumb({ src, onClick }: { src: string; onClick: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const video = document.createElement('video')
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
      {thumb ? <img src={thumb} className="w-full rounded-sm block" /> : <div className="w-full min-h-[120px] bg-gray-900 rounded-sm" />}
      <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-sm group-hover:bg-black/40 transition-colors">
        <span className="text-white text-4xl drop-shadow-sm">▶</span>
      </div>
    </div>
  )
}

function imgCtx(e: React.MouseEvent, uri: string) {
  e.preventDefault(); e.stopPropagation()
  window.dispatchEvent(new CustomEvent('media-ctx', { detail: { x: e.clientX, y: e.clientY, uri } }))
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const pill = 'flex w-fit items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border border-mist-100 dark:border-mist-700/50 bg-mist-50 dark:bg-mist-800/60 select-none'
const card = 'rounded-xl border border-mist-100 dark:border-mist-700/50 bg-mist-50/50 dark:bg-mist-800/30'
const pillIcon = 'shrink-0 text-mist-300 dark:text-mist-600'
const pillLabel = 'text-mist-500 dark:text-mist-400 font-medium'
const pillSub = 'text-mist-300 dark:text-mist-600'
const iconWell = 'w-7 h-7 rounded-lg bg-mist-100 dark:bg-mist-800 flex items-center justify-center shrink-0 text-mist-400 dark:text-mist-500'

const rowBase = 'group/row flex items-start px-4 py-1 gap-3 cursor-pointer select-none transition-colors'
const rowSel = 'bg-mist-100! dark:bg-mist-800/40!'
const rowUnsel = '[@media(hover:hover)]:hover:bg-mist-50 dark:[@media(hover:hover)]:hover:bg-mist-800 active:bg-mist-100 dark:active:bg-mist-800/60'
const timeCls = 'text-[11px] text-gray-400 dark:text-gray-500 leading-6 opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 transition-opacity'
const actionsCls = (sel: boolean) => `flex items-center gap-1 self-start pt-0.5 transition-opacity ${sel ? 'opacity-100' : 'opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100'}`

// ─── Shared components ───────────────────────────────────────────────────────

function StatusPill({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
  return (
    <span className={pill}>
      <span className={pillIcon}>{icon}</span>
      <span>
        <span className={pillLabel}>{label}</span>
        {sublabel && <span className={`${pillSub} ml-1`}>· {sublabel}</span>}
      </span>
    </span>
  )
}


// ─── Types ───────────────────────────────────────────────────────────────────

interface MessageGroupProps {
  block: MessageBlock
  selectedMsgIds?: ReadonlyMap<string, unknown>
  onToggle: (id: string, ts: number, tsEnd: number, allIds: string[], blockId: string, shiftKey?: boolean) => void
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
  return !m.content
}

function isPhotoOnlyMsg(m: Message): boolean {
  if (!m.photos?.length) return false
  if (m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share?.link) return false
  if (m.call_duration != null || m.media_failed || m.content_unavailable || m.is_unsent || m.is_unsent_image_by_messenger_kid_parent) return false
  if (m.content && !/^sent an attachment\.$/.test(m.content)) return false
  return true
}


// ─── Content renderers ───────────────────────────────────────────────────────

function renderContent(m: Message, isHidden: boolean, hasMedia: boolean, show: (k: ContentTypeKey) => boolean): React.ReactNode {
  if (m.call_duration != null) return null
  if (m.media_failed) return !show('unavailable') ? null : (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><line x1="2" y1="2" x2="22" y2="22"/></svg>} label="Photo or video unavailable" />
  )
  if (m.is_unsent_image_by_messenger_kid_parent || m.is_unsent) return !show('removed') ? null : (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>} label={`${m.sender_name} deleted a message`} />
  )
  if (m.content_unavailable) return !show('unavailable') ? null : (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="2" y1="2" x2="22" y2="22"/></svg>} label="Content unavailable" />
  )
  if (m.ip && !hasMedia && !m.content) return !show('location') ? null : (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>} label={`${m.sender_name} shared their location`} />
  )
  if (!m.content) return null
  if (/sent an attachment\.$/.test(m.content)) return hasMedia ? null : (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>} label="Attachment unavailable" />
  )
  if (/sent (a link|a group)\.$/.test(m.content)) return null
  if (/sent a live location\.$/.test(m.content)) return (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>} label={m.content} />
  )
  if (/started a plan\.$/.test(m.content)) return (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Sent a Messenger plan" sublabel="Event planning feature" />
  )
  if (m.content === '[Link]') return (
    <StatusPill icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>} label="Link not saved" sublabel="URL was not captured in export" />
  )
  if (m.type === 'link' || /^https?:\/\/\S+$/.test(m.content)) {
    if (m.share?.link && m.content.trim() === m.share.link.trim()) return null
    return <OgLinkCard url={m.content} />
  }
  return (
    <div className={`text-base leading-6 text-gray-900 dark:text-gray-100 break-words${isHidden ? ' line-through' : ''}`}>
      {mapFbEmoji(m.content).split('\n').flatMap((line, i, arr) =>
        i < arr.length - 1 ? [line, <br key={i} />] : [line]
      )}
    </div>
  )
}

function renderMedia(
  m: Message, show: (k: ContentTypeKey) => boolean, onLightbox: (s: LightboxState) => void,
  hideImages?: boolean, hiddenUris?: Set<string>, isSuperAdmin?: boolean,
  onHideUri?: (uri: string) => void, onUnhideUri?: (uri: string) => void,
): React.ReactNode {
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
                  <img src={r2(p.uri)} loading="lazy"
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
          : <img key={i} src={r2(g.uri)} loading="lazy"
              className="max-w-[360px] max-h-[280px] rounded-sm block cursor-pointer mt-1"
              onClick={() => onLightbox({ src: r2(g.uri), type: 'gif', mediaType: 'gifs', caption: '', msgId: m._id, ts: m.timestamp_ms })}
              onContextMenu={e => imgCtx(e, g.uri)}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      )}

      {m.sticker && (!show('stickers') || hideImages || hiddenUris?.has(m.sticker.uri) ? null
        : <img src={r2(m.sticker.uri)} loading="lazy" className="max-w-[72px] max-h-[72px]"
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
            <img src={url} loading="lazy"
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
                <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} className="w-4 h-4 rounded-sm shrink-0"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                <span className="text-[10px] font-medium text-mist-400 dark:text-mist-500 uppercase tracking-wide truncate">{host}</span>
              </div>
              {m.share.share_text && <p className="text-[12px] font-semibold text-gray-800 dark:text-mist-100 line-clamp-2 leading-snug mb-1">{m.share.share_text}</p>}
              <p className="text-[11px] text-mist-400 dark:text-mist-500 truncate">{url.replace(/^https?:\/\//, '')}</p>
            </div>
          </a>
        )
      })()}

      {m.call_duration != null && (() => {
        if (!show('calls')) return null
        const isVideo = (m.content ?? '').toLowerCase().includes('video')
        const phoneIcon = isVideo
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="13" height="10" rx="2"/><path d="M15 9l6-3v12l-6-3V9z"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.71a16 16 0 0 0 5.38 5.38l1.81-1.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        const callLabel = m.content?.replace(/\.$/, '') ?? (isVideo ? 'Video call' : 'Call')
        if (m.missed) return <StatusPill icon={phoneIcon} label={callLabel} />
        const mins = Math.floor(m.call_duration / 60), secs = m.call_duration % 60
        return <StatusPill icon={phoneIcon} label={`${callLabel} · ${mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}`} />
      })()}


      {show('reactions') && !!m.reactions?.length && (
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
    onToggle(m._id, m.timestamp_ms, m.timestamp_ms, [m._id], m.blockId ?? m._id, e.shiftKey)
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
        {isFirst ? <ThreadAvatar color={block.mine ? 'bg-mist-600' : (senderColor ?? 'bg-purple-600')} initials={(block.sender || '?')[0].toUpperCase()} /> : <span className={timeCls}>{fmtTimeShort(m.timestamp_ms)}</span>}
      </div>
      <div className={`flex-1 min-w-0${isHidden ? ' opacity-40' : ''}`}>
        {isFirst && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-sm font-semibold ${block.mine ? 'text-mist-600 dark:text-mist-400' : 'text-gray-900 dark:text-gray-100'}`}>{block.sender}</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{fmtTime(m.timestamp_ms)}</span>
          </div>
        )}
        {renderContent(m, isHidden, hasMedia, show)}
        {renderMedia(m, show, onLightbox, hideImages, hiddenUris, isSuperAdmin, onHideUri, onUnhideUri)}
      </div>
      <div className={actionsCls(isSel)} onClick={e => e.stopPropagation()}>
        {renderRowActions ? renderRowActions(m) : (
          <>
            {isSuperAdmin && m._id && (
              <button onClick={e => { e.stopPropagation(); isHidden ? onUnhideMessage?.(m._id) : onHideMessage?.(m._id) }}
                className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${isHidden ? 'text-mist-400 hover:text-mist-600' : 'text-red-400 hover:text-red-600'}`}>
                {isHidden ? 'Unhide' : 'Hide'}
              </button>
            )}
            <input type="checkbox" checked={isSel} onChange={() => {}}
              onClick={e => { e.stopPropagation(); onToggle(m._id, m.timestamp_ms, m.timestamp_ms, [m._id], m.blockId ?? m._id, e.shiftKey) }}
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

  // Merge consecutive photo-only messages into one augmented message
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
