import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'
import { getCollection, getHiddenItems, getUserSettings, isSafeCollectionName } from '@/lib/db'

const SINGULAR_MATCH: Record<string, Record<string, unknown>> = {
  stickers: { sticker:        { $exists: true } },
  links:    { 'share.link':   { $exists: true } },
  calls:    { call_duration:  { $exists: true } },
}

const ARRAY_FIELD: Record<string, string> = {
  photos: 'photos', videos: 'videos', gifs: 'gifs', files: 'files', audio: 'audio_files',
}

const MEDIA_TYPES = ['photos', 'videos', 'gifs', 'stickers', 'audio', 'files', 'links', 'calls']

// Media counts are stable between imports — cache for 10 minutes per thread
const mediaCache = new Map<string, { data: Record<string, number>; at: number }>()
const MEDIA_TTL = 10 * 60_000

// Main init payload is safe to cache briefly per user+thread
const initCache = new Map<string, { data: Record<string, unknown>; at: number }>()
const INIT_TTL = 30_000

export function invalidateInitCache(userId?: string) {
  if (userId) {
    for (const key of initCache.keys()) {
      if (key.startsWith(`${userId}:`)) initCache.delete(key)
    }
  } else {
    initCache.clear()
  }
}

export function invalidateMediaCache(thread?: string) {
  if (thread) mediaCache.delete(thread)
  else mediaCache.clear()
}

async function mediaCountsFor(msgs: Awaited<ReturnType<typeof getCollection>>, thread: string) {
  const now = Date.now()
  const hit = mediaCache.get(thread)
  if (hit && now - hit.at < MEDIA_TTL) return hit.data

  const values = await Promise.all(MEDIA_TYPES.map(async type => {
    if (type in SINGULAR_MATCH) return msgs.countDocuments(SINGULAR_MATCH[type])
    const field = ARRAY_FIELD[type] ?? type
    const filt  = { [field]: { $exists: true, $not: { $size: 0 } } }
    const res   = await msgs.aggregate([
      { $match: filt }, { $unwind: `$${field}` }, { $count: 'total' },
    ]).toArray()
    return (res[0] as { total?: number } | undefined)?.total ?? 0
  }))

  const data = Object.fromEntries(MEDIA_TYPES.map((t, i) => [t, values[i]])) as Record<string, number>
  mediaCache.set(thread, { data, at: now })
  return data
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isSuperAdmin = session.superAdmin
  const userId       = session.userId
  const url          = new URL(req.url)
  const thread       = url.searchParams.get('thread') ?? 'messages'
  const includeMedia = url.searchParams.get('media') === '1'
  const mediaOnly    = url.searchParams.get('mediaOnly') === '1'

  if (!isSafeCollectionName(thread)) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400 })
  }

  try {
    const msgs = await getCollection(thread)

    // Cheap path: only media tab counts (when MediaPane opens)
    if (mediaOnly) {
      return NextResponse.json({ mediaCounts: await mediaCountsFor(msgs, thread) })
    }

    const cacheKey = `${userId}:${thread}`
    const now = Date.now()
    const hit = initCache.get(cacheKey)
    if (hit && now - hit.at < INIT_TTL) {
      return NextResponse.json(hit.data)
    }

    const payload = await getPayloadClient()

    const userP      = payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const lastMsgP   = msgs.find({}).sort({ timestamp_ms: -1 }).limit(1).toArray()
    const hiddenP    = isSuperAdmin
      ? getHiddenItems().then(col => col.find().sort({ createdAt: -1 }).toArray())
      : Promise.resolve([] as Array<{ _id: unknown; type: string; value: string }>)
    const hashtagsP  = payload.find({ collection: 'hashtags', limit: 200, sort: 'firstMsgTs', depth: 0, overrideAccess: true })
    const settingsP  = getUserSettings().then(col => col.findOne({ userId }, { projection: { _id: 0 } }))

    const [user, lastMsgs, hiddenItems, hashtagResult, settingsDoc] = await Promise.all([
      userP, lastMsgP, hiddenP, hashtagsP, settingsP,
    ])

    const visibleHashtags = (hashtagResult.docs as Array<{ isPrivate?: boolean; createdById?: string }>).filter(h =>
      !h.isPrivate || isSuperAdmin || h.createdById === userId
    )

    const lastMsg = lastMsgs[0] as unknown as {
      timestamp_ms: number
      content?: string
      photos?: unknown[]
      videos?: unknown[]
    } | undefined
    const threadLastMsg = lastMsg ? {
      ts: lastMsg.timestamp_ms,
      subtitle: lastMsg.content
        ?? (lastMsg.photos?.length ? 'Sent a photo'
          : lastMsg.videos?.length ? 'Sent a video'
          : 'Sent an attachment'),
    } : null

    const body: Record<string, unknown> = {
      user: { name: (user as { name?: string }).name ?? '', superAdmin: isSuperAdmin },
      threadLastMsg,
      hiddenItems: hiddenItems.map(i => ({
        _id: String(i._id), type: i.type, value: i.value,
      })),
      hashtags: visibleHashtags,
      userSettings: settingsDoc ?? {},
    }

    if (includeMedia) {
      body.mediaCounts = await mediaCountsFor(msgs, thread)
    }

    initCache.set(cacheKey, { data: body, at: now })
    return NextResponse.json(body)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
