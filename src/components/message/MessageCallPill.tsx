import { mapFbEmoji } from '@/lib/fbEmoji'
import { StatusPill } from './MessageStyles'

export function renderCallPill(duration: number, missed: boolean, content?: string | null) {
  const isVideo = (content ?? '').toLowerCase().includes('video')
  const phoneIcon = isVideo
    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="13" height="10" rx="2"/><path d="M15 9l6-3v12l-6-3V9z"/></svg>
    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.71a16 16 0 0 0 5.38 5.38l1.81-1.81a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  const callLabel = content ? mapFbEmoji(content.replace(/\.$/, '')) : (isVideo ? 'Video call' : 'Call')
  if (missed) return <StatusPill icon={phoneIcon} label={callLabel} />
  const mins = Math.floor(duration / 60), secs = duration % 60
  return <StatusPill icon={phoneIcon} label={`${callLabel} · ${mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}`} />
}
