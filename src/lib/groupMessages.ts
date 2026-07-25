import { Message, MessageBlock } from '@/types'
import { ME } from './constants'
import { fmtDate } from './format'

function hasRenderableContent(m: Message): boolean {
  if (m.media_failed || m.content_unavailable || m.ip || m.is_unsent_image_by_messenger_kid_parent) return true
  const hasMedia = !!(m.photos?.length || m.videos?.length || m.audio_files?.length || m.gifs?.length || m.sticker || m.files?.length || m.share)
  return !!(m.is_unsent || m.call_duration != null || m.content || hasMedia || m.reactions?.length)
}

export function groupMessages(messages: Message[]): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let lastDate: string | null = null, lastSender: string | null = null

  for (const m of messages) {
    if (!hasRenderableContent(m)) continue
    const d = fmtDate(m.timestamp_ms)
    const newDate = d !== lastDate
    const grouped = !newDate && m.sender_name === lastSender
    if (newDate) lastDate = d
    lastSender = m.sender_name
    if (grouped && blocks.length) blocks[blocks.length - 1].msgs.push(m)
    else blocks.push({ date: d, newDate, sender: m.sender_name, mine: m.sender_name === ME, msgs: [m] })
  }
  return blocks
}
