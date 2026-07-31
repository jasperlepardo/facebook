import type { DateBoundary, DateIndex } from '@/types'
import { getCollection, getDateIndexCollection } from './db'
import { getThreadMessageCount } from './threadCount'

function weekStartIso(ts: number): string {
  const d = new Date(ts)
  const dow = d.getUTCDay()
  const monday = new Date(ts - (dow === 0 ? 6 : dow - 1) * 86400000)
  return monday.toISOString().split('T')[0]
}

function monthStartIso(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

const fmtDay   = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmtWeek  = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmtMonth = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

interface DateIndexDoc {
  thread: string
  messageCount: number
  index: DateIndex
  builtAt: string
}

export async function invalidateDateIndex(thread: string) {
  const col = await getDateIndexCollection()
  await col.deleteOne({ thread })
}

export async function buildDateIndex(thread: string): Promise<DateIndex> {
  const col = await getCollection(thread)

  const docs = await col.aggregate<{ _id: string; count: number; firstTs: number }>([
    { $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$timestamp_ms' } } },
      count:   { $sum: 1 },
      firstTs: { $min: '$timestamp_ms' },
    }},
    { $sort: { _id: 1 } },
  ]).toArray()

  const days: DateBoundary[] = []
  const weeks  = new Map<string, DateBoundary>()
  const months = new Map<string, DateBoundary>()

  let offset = 0
  for (const { _id: iso, count, firstTs } of docs) {
    if (!iso) { offset += count; continue }
    days.push({ iso, label: fmtDay(iso), offset })

    const wiso = weekStartIso(firstTs)
    if (!weeks.has(wiso)) weeks.set(wiso, { iso: wiso, label: fmtWeek(wiso), offset })

    const miso = monthStartIso(firstTs)
    if (!months.has(miso)) months.set(miso, { iso: miso, label: fmtMonth(miso), offset })

    offset += count
  }

  return { days, weeks: [...weeks.values()], months: [...months.values()] }
}

export async function getOrBuildDateIndex(thread: string): Promise<DateIndex> {
  const messageCount = await getThreadMessageCount(thread)
  const store = await getDateIndexCollection()

  const cached = await store.findOne({ thread }) as DateIndexDoc | null
  if (cached && cached.messageCount === messageCount && cached.index?.days) {
    return cached.index
  }

  const index = await buildDateIndex(thread)
  await store.updateOne(
    { thread },
    { $set: { thread, messageCount, index, builtAt: new Date().toISOString() } },
    { upsert: true },
  )
  return index
}

/**
 * Count of messages with timestamp_ms < targetTs.
 * Uses persisted date-index day offset + a small within-day countDocuments
 * instead of counting the entire prefix of the archive.
 */
export async function indexBeforeTimestamp(thread: string, targetTs: number): Promise<number> {
  const index = await getOrBuildDateIndex(thread)
  const dayIso = new Date(targetTs).toISOString().slice(0, 10)
  const day = index.days.find(d => d.iso === dayIso)

  if (day) {
    const col = await getCollection(thread)
    const dayStart = Date.parse(day.iso + 'T00:00:00Z')
    const within = await col.countDocuments({
      timestamp_ms: { $gte: dayStart, $lt: targetTs },
    })
    return day.offset + within
  }

  // Before first day or after last — fall back to full prefix count
  const col = await getCollection(thread)
  return col.countDocuments({ timestamp_ms: { $lt: targetTs } })
}
