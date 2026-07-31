import { NextRequest, NextResponse } from 'next/server'
import { getCollection, isSafeCollectionName } from '@/lib/db'
import type { DateBoundary, DateIndex } from '@/types'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'private, no-store',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

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

const cache = new Map<string, DateIndex>()

export async function GET(req: NextRequest) {
  const thread = new URL(req.url).searchParams.get('thread') ?? 'messages'
  if (!isSafeCollectionName(thread)) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400, headers: CORS })
  }
  const cached = cache.get(thread)
  if (cached) return NextResponse.json(cached, { headers: CORS })

  try {
    const col = await getCollection(thread)

    // One aggregation: count of messages per calendar day + first timestamp
    const docs = await col.aggregate<{ _id: string; count: number; firstTs: number }>([
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$timestamp_ms' } } },
        count:   { $sum: 1 },
        firstTs: { $min: '$timestamp_ms' },
      }},
      { $sort: { _id: 1 } },
    ]).toArray()

    const days:   DateBoundary[] = []
    const weeks   = new Map<string, DateBoundary>()
    const months  = new Map<string, DateBoundary>()

    let offset = 0
    for (const { _id: iso, count, firstTs } of docs) {
      if (!iso) { offset += count; continue }  // skip docs with unparseable timestamps
      days.push({ iso, label: fmtDay(iso), offset })

      const wiso = weekStartIso(firstTs)
      if (!weeks.has(wiso)) weeks.set(wiso, { iso: wiso, label: fmtWeek(wiso), offset })

      const miso = monthStartIso(firstTs)
      if (!months.has(miso)) months.set(miso, { iso: miso, label: fmtMonth(miso), offset })

      offset += count
    }

    const index: DateIndex = { days, weeks: [...weeks.values()], months: [...months.values()] }
    cache.set(thread, index)
    return NextResponse.json(index satisfies DateIndex, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
