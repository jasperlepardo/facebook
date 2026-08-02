import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'
import { getCollection, isSafeCollectionName } from '@/lib/db'
import { getThreadMessageCount } from '@/lib/threadCount'

interface Stats {
  threads: number
  messages: number
  firstTs: number | null
  lastTs: number | null
}

const TTL = 60_000
let cache: { data: Stats; at: number } | null = null

/** Oldest / newest message timestamp — an index hit at each end, not a scan. */
async function threadRange(collectionName: string) {
  const col = await getCollection(collectionName)
  const opts = { projection: { timestamp_ms: 1 as const } }
  const [oldest, newest] = await Promise.all([
    col.find({}, { ...opts, sort: { timestamp_ms: 1 }, limit: 1 }).toArray(),
    col.find({}, { ...opts, sort: { timestamp_ms: -1 }, limit: 1 }).toArray(),
  ])
  return {
    first: (oldest[0]?.timestamp_ms as number | undefined) ?? null,
    last:  (newest[0]?.timestamp_ms as number | undefined) ?? null,
  }
}

async function computeStats(): Promise<Stats> {
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'threads',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  const names = found.docs
    .map(t => t.collection ?? '')
    .filter(name => isSafeCollectionName(name))

  const counts = await Promise.all(names.map(name => getThreadMessageCount(name)))
  const ranges = await Promise.all(names.map(name => threadRange(name).catch(() => ({ first: null, last: null }))))

  const firsts = ranges.map(r => r.first).filter((t): t is number => typeof t === 'number')
  const lasts  = ranges.map(r => r.last).filter((t): t is number => typeof t === 'number')

  return {
    threads:  names.length,
    messages: counts.reduce((sum, n) => sum + n, 0),
    firstTs:  firsts.length ? Math.min(...firsts) : null,
    lastTs:   lasts.length  ? Math.max(...lasts)  : null,
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.data)

  try {
    const data = await computeStats()
    cache = { data, at: Date.now() }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
