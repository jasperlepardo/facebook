import { Message } from '@/types'
import { fmtDate, fmtTime } from '@/lib/format'

export function buildMessageLink(msgId: string, thread = 'messages'): string {
  const params = new URLSearchParams({ s: 'chat', msg: msgId })
  if (thread) params.set('thread', thread)
  return `${window.location.origin}${window.location.pathname}?${params}`
}

export function formatMessagesText(msgs: Message[]): string {
  if (!msgs.length) return ''
  const first = msgs[0]
  const header = `${first.sender_name} · ${fmtDate(first.timestamp_ms)} at ${fmtTime(first.timestamp_ms)}`
  const lines = msgs.flatMap(m => {
    const parts: string[] = []
    if (m.content) parts.push(m.content)
    if (m.photos?.length) parts.push('[photo]')
    if (m.videos?.length) parts.push('[video]')
    if (m.audio_files?.length) parts.push('[audio]')
    if (m.gifs?.length) parts.push('[GIF]')
    if (m.sticker) parts.push('[sticker]')
    if (m.files?.length) parts.push('[file]')
    if (m.share?.link) parts.push(m.share.share_text ? `${m.share.share_text} ${m.share.link}` : m.share.link)
    if (m.call_duration != null) parts.push(m.missed ? 'Missed call' : `Call (${m.call_duration}s)`)
    return parts
  })
  return [header, ...lines].join('\n')
}
