import { Message, MessageBlock } from '@/types'
import { ME } from './constants'
import { fmtDate } from './format'

export function buildHashtagBlocks(messages: Message[]): MessageBlock[] {
  const groupMap = new Map<string, Message[]>()
  for (const m of messages) {
    if (!m.blockId) continue
    const key = m.blockId
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(m)
  }
  const groups = [...groupMap.values()]
    .sort((a, b) => a[0].timestamp_ms - b[0].timestamp_ms)
  return groups.map((msgs, i) => ({
    date: fmtDate(msgs[0].timestamp_ms),
    newDate: i === 0 || fmtDate(msgs[0].timestamp_ms) !== fmtDate(groups[i - 1][0].timestamp_ms),
    sender: msgs[0].sender_name,
    mine: msgs[0].sender_name === ME,
    msgs,
  }))
}
