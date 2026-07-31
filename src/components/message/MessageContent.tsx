import { Message } from '@/types'
import { mapFbEmoji } from '@/lib/fbEmoji'
import { ContentTypeKey } from '@/lib/contentTypes'
import OgLinkCard from '@/components/OgLinkCard'
import { StatusPill } from './MessageStyles'
import { renderCallPill } from './MessageCallPill'

export function renderContent(
  m: Message,
  isHidden: boolean,
  hasMedia: boolean,
  show: (k: ContentTypeKey) => boolean,
): React.ReactNode {
  if (m.call_duration != null) return null

  if (m.media_failed) return !show('unavailable') ? null : (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><line x1="2" y1="2" x2="22" y2="22"/></svg>}
      label="Photo or video unavailable"
    />
  )

  if (m.is_unsent_image_by_messenger_kid_parent || m.is_unsent) return !show('removed') ? null : (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>}
      label={`${m.sender_name} deleted a message`}
    />
  )

  if (m.content_unavailable) return !show('unavailable') ? null : (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="2" y1="2" x2="22" y2="22"/></svg>}
      label="Content unavailable"
    />
  )

  if (m.ip && !hasMedia && !m.content) return !show('location') ? null : (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
      label={`${m.sender_name} shared their location`}
    />
  )

  if (!m.content) return null

  if (/sent an attachment\.$/.test(m.content)) return hasMedia ? null : (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>}
      label="Attachment unavailable"
    />
  )

  if (/sent (a link|a group)\.$/.test(m.content)) return null

  if (/sent a live location\.$/.test(m.content)) return (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
      label={m.content}
    />
  )

  if (/started a plan\.$/.test(m.content)) return (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
      label="Sent a Messenger plan"
      sublabel="Event planning feature"
    />
  )

  if (/started a (video )?call\.$/.test(m.content) || /^The (video )?call ended\.$/.test(m.content)) {
    if (!show('calls')) return null
    const isVideo = m.content.toLowerCase().includes('video')
    const phoneIcon = isVideo
      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="13" height="10" rx="2"/><path d="M15 9l6-3v12l-6-3V9z"/></svg>
      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.71a16 16 0 0 0 5.38 5.38l1.81-1.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    return <StatusPill icon={phoneIcon} label={mapFbEmoji(m.content.replace(/\.$/, ''))} />
  }

  if (m.content === '[Link]') return (
    <StatusPill
      icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>}
      label="Link not saved"
      sublabel="URL was not captured in export"
    />
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
