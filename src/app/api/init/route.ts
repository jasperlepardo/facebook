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

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // superAdmin comes from JWT — no DB round trip required
  const isSuperAdmin = session.superAdmin
  const userId       = session.userId
  const thread       = new URL(req.url).searchParams.get('thread') ?? 'messages'

  if (!isSafeCollectionName(thread)) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400 })
  }

  try {
    const [msgs, payload] = await Promise.all([getCollection(thread), getPayloadClient()])

    // User fetch (for name) now runs in parallel with all other queries
    const userP      = payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const lastMsgP   = msgs.find({}).sort({ timestamp_ms: -1 }).limit(1).toArray()
    const hiddenP    = isSuperAdmin
      ? getHiddenItems().then(col => col.find().sort({ createdAt: -1 }).toArray())
      : Promise.resolve([] as any[])
    const hashtagsP  = payload.find({ collection: 'hashtags', limit: 200, sort: 'firstMsgTs', depth: 0, overrideAccess: true })
    const settingsP  = getUserSettings().then(col => col.findOne({ userId }, { projection: { _id: 0 } }))
    const mediaPs    = MEDIA_TYPES.map(async type => {
      if (type in SINGULAR_MATCH) return msgs.countDocuments(SINGULAR_MATCH[type])
      const field = ARRAY_FIELD[type] ?? type
      const filt  = { [field]: { $exists: true, $not: { $size: 0 } } }
      const res   = await msgs.aggregate([
        { $match: filt }, { $unwind: `$${field}` }, { $count: 'total' },
      ]).toArray()
      return (res[0] as any)?.total ?? 0
    })

    const [[user, lastMsgs, hiddenItems, hashtagResult, settingsDoc], mediaCountValues] = await Promise.all([
      Promise.all([userP, lastMsgP, hiddenP, hashtagsP, settingsP]),
      Promise.all(mediaPs),
    ])

    const visibleHashtags = (hashtagResult.docs as any[]).filter(h =>
      !h.isPrivate || isSuperAdmin || h.createdById === userId
    )

    const lastMsg = (lastMsgs as any[])[0]
    const threadLastMsg = lastMsg ? {
      ts: lastMsg.timestamp_ms,
      subtitle: lastMsg.content
        ?? (lastMsg.photos?.length ? 'Sent a photo'
          : lastMsg.videos?.length ? 'Sent a video'
          : 'Sent an attachment'),
    } : null

    return NextResponse.json({
      user: { name: (user as any).name ?? '', superAdmin: isSuperAdmin },
      threadLastMsg,
      hiddenItems: (hiddenItems as any[]).map(i => ({ _id: String(i._id), type: i.type, value: i.value })),
      hashtags: visibleHashtags,
      userSettings: settingsDoc ?? {},
      mediaCounts: Object.fromEntries(MEDIA_TYPES.map((t, i) => [t, mediaCountValues[i]])),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
