import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'
import { getMessages, getHiddenItems, getUserSettings } from '@/lib/db'

const SINGULAR_MATCH: Record<string, Record<string, unknown>> = {
  stickers: { sticker:        { $exists: true } },
  links:    { 'share.link':   { $exists: true } },
  calls:    { call_duration:  { $exists: true } },
}

const ARRAY_FIELD: Record<string, string> = {
  photos: 'photos', videos: 'videos', gifs: 'gifs', files: 'files', audio: 'audio_files',
}

const MEDIA_TYPES = ['photos', 'videos', 'gifs', 'stickers', 'audio', 'files', 'links', 'calls']

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [msgs, payload] = await Promise.all([getMessages(), getPayloadClient()])

    const user = await payload.findByID({ collection: 'users', id: session.userId, overrideAccess: true })
    const isSuperAdmin = !!(user as any)?.superAdmin
    const userId = session.userId

    const lastMsgP   = msgs.find({}).sort({ timestamp_ms: -1 }).limit(1).toArray()
    const hiddenP    = isSuperAdmin
      ? getHiddenItems().then(col => col.find().sort({ createdAt: -1 }).toArray())
      : Promise.resolve([] as any[])
    const hashtagsP  = payload.find({ collection: 'hashtags', limit: 200, sort: 'firstMsgTs', depth: 0, overrideAccess: true })
    const settingsP  = getUserSettings().then(col => col.findOne({ userId }, { projection: { _id: 0 } }))
    const mediaPs    = MEDIA_TYPES.map(async type => {
      if (type in SINGULAR_MATCH) return msgs.countDocuments(SINGULAR_MATCH[type])
      const field = ARRAY_FIELD[type] ?? type
      const filt = { [field]: { $exists: true, $not: { $size: 0 } } }
      const res = await msgs.aggregate([
        { $match: filt }, { $unwind: `$${field}` }, { $count: 'total' },
      ]).toArray()
      return (res[0] as any)?.total ?? 0
    })

    const [[lastMsgs, hiddenItems, hashtagResult, settingsDoc], mediaCountValues] = await Promise.all([
      Promise.all([lastMsgP, hiddenP, hashtagsP, settingsP]),
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
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
