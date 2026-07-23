import { Message, MessageBlock } from '../types'
import { ME } from './constants'
import { fmtDate } from './format'

export function groupMessages(messages: Message[]): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let lastDate: string | null = null, lastSender: string | null = null, lastTs = 0

  for (const m of messages) {
    const d = fmtDate(m.timestamp_ms)
    const newDate = d !== lastDate
    const grouped = !newDate && m.sender_name === lastSender && m.timestamp_ms - lastTs < 5 * 60_000
    if (newDate) lastDate = d
    lastSender = m.sender_name
    lastTs = m.timestamp_ms
    if (grouped && blocks.length) blocks[blocks.length - 1].msgs.push(m)
    else blocks.push({ date: d, newDate, sender: m.sender_name, mine: m.sender_name === ME, msgs: [m] })
  }
  return blocks
}
