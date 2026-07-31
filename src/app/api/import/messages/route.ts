import { NextRequest, NextResponse } from 'next/server'
import { ObjectId, Long } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getPayloadClient } from '@/lib/payload-access'
import { getSession } from '@/lib/session'

export const maxDuration = 300
export const dynamic     = 'force-dynamic'

const CORS  = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const BATCH = 500

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  try {
    const {
      collection:       collectionName,
      messages:         incoming,
      threadName,
      participants,
      facebookThreadId,
      initials,
      color,
      skipBlockIds = false,
    } = await req.json()

    if (!collectionName || !Array.isArray(incoming) || incoming.length === 0) {
      return NextResponse.json({ error: 'collection and messages[] required' }, { status: 400, headers: CORS })
    }

    const col = await getCollection(collectionName)

    // ── skipBlockIds: upsert per message (dedup by sender+ts), no recompute ───
    if (skipBlockIds) {
      let inserted = 0
      const MEDIA_FIELDS = ['photos', 'videos', 'gifs', 'audio_files', 'files'] as const
      for (let i = 0; i < incoming.length; i += BATCH) {
        const docs = incoming.slice(i, i + BATCH).map(m => mapToDbSchema(m))
        const ops = docs.map(doc => {
          // Non-empty media fields go into $set so they're restored on existing docs
          // that had their URIs stripped by a failed upload.
          const mediaSet: Record<string, unknown> = {}
          for (const field of MEDIA_FIELDS) {
            const arr = (doc as Record<string, unknown>)[field]
            if (Array.isArray(arr) && arr.length > 0) mediaSet[field] = arr
          }
          const insertDoc = { ...doc }
          for (const f of Object.keys(mediaSet)) delete (insertDoc as Record<string, unknown>)[f]

          return {
            updateOne: {
              filter: { sender_name: doc.sender_name, timestamp_ms: doc.timestamp_ms },
              update: {
                $setOnInsert: insertDoc,
                ...(Object.keys(mediaSet).length > 0 ? { $set: mediaSet } : {}),
              },
              upsert: true,
            },
          }
        })
        const result = await col.bulkWrite(ops as Parameters<typeof col.bulkWrite>[0], { ordered: false })
        inserted += result.upsertedCount + (result.modifiedCount ?? 0)
      }
      return NextResponse.json({ inserted }, { headers: CORS })
    }

    // ── Dedup for streaming path: find max existing timestamp ─────────────────
    const newest = await col.find({}, { projection: { timestamp_ms: 1 } })
      .sort({ timestamp_ms: -1 }).limit(1).toArray()
    const maxTs = newest.length > 0 ? Number(newest[0].timestamp_ms) : 0

    const toInsert = incoming
      .filter(m => {
        const ts = m.timestamp_ms ?? m.timestamp
        return typeof ts === 'number' && ts > maxTs
      })
      .map(m => mapToDbSchema(m))
      .sort((a, b) => Number(a.timestamp_ms) - Number(b.timestamp_ms))

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0, total: await col.countDocuments(), alreadyUpToDate: true }, { headers: CORS })
    }

    const enc = new TextEncoder()
    const stream = new ReadableStream({
      async start(ctrl) {
        const send = (data: object) =>
          ctrl.enqueue(enc.encode(JSON.stringify(data) + '\n'))

        try {
          // ── Insert in batches ───────────────────────────────────────────────
          let inserted = 0
          for (let i = 0; i < toInsert.length; i += BATCH) {
            const result = await col.insertMany(toInsert.slice(i, i + BATCH), { ordered: false })
            inserted += result.insertedCount
            send({ type: 'insert', current: Math.min(i + BATCH, toInsert.length), total: toInsert.length })
          }

          // ── Recompute blockIds ──────────────────────────────────────────────
          await recomputeBlockIds(col, (current, total) =>
            send({ type: 'blockids', current, total })
          )

          // ── Upsert thread ───────────────────────────────────────────────────
          const total = await col.countDocuments()
          await upsertThread({ collectionName, threadName, participants, facebookThreadId, initials, color, total })

          send({ type: 'done', inserted, total })
        } catch (e) {
          send({ type: 'error', error: String(e) })
        } finally {
          ctrl.close()
        }
      },
    })

    return new Response(stream, {
      headers: { ...CORS, 'Content-Type': 'application/x-ndjson' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapToDbSchema(m: Record<string, unknown>) {
  // Handle both native FB format and scraped format
  const isScraped = 'senderName' in m

  const base: Record<string, unknown> = {
    sender_name:                       isScraped ? m.senderName  : m.sender_name,
    timestamp_ms:                      Long.fromNumber(Number(isScraped ? m.timestamp : m.timestamp_ms)),
    content:                           isScraped ? (m.text ?? '') : (m.content ?? ''),
    is_geoblocked_for_viewer:          m.is_geoblocked_for_viewer ?? false,
    is_unsent_image_by_messenger_kid_parent: isScraped ? !!(m.isUnsent) : !!(m.is_unsent_image_by_messenger_kid_parent),
  }

  if (isScraped) {
    // Map media[] → split by extension into photos/videos/gifs/audio_files/files
    const media = Array.isArray(m.media) ? m.media as { uri?: string }[] : []
    if (media.length > 0) {
      const photos: unknown[] = [], videos: unknown[] = [], gifs: unknown[] = [], audio: unknown[] = [], files: unknown[] = []
      for (const item of media) {
        if (!item.uri) continue
        const ext = item.uri.split('.').pop()?.toLowerCase() ?? ''
        const mapped = { uri: item.uri, creation_timestamp: null }
        if (['jpg','jpeg','png','webp','heic'].includes(ext))    photos.push(mapped)
        else if (['mp4','mov','avi','mkv'].includes(ext))        videos.push(mapped)
        else if (ext === 'gif')                                  gifs.push(mapped)
        else if (['aac','mp3','m4a','ogg','opus'].includes(ext)) audio.push(mapped)
        else                                                     files.push(mapped)
      }
      if (photos.length) base.photos      = photos
      if (videos.length) base.videos      = videos
      if (gifs.length)   base.gifs        = gifs
      if (audio.length)  base.audio_files = audio
      if (files.length)  base.files       = files
    }
  } else {
    // Native FB format — pass through non-empty media fields only
    if (Array.isArray(m.photos)      && (m.photos      as unknown[]).length) base.photos      = m.photos
    if (Array.isArray(m.videos)      && (m.videos      as unknown[]).length) base.videos      = m.videos
    if (Array.isArray(m.gifs)        && (m.gifs        as unknown[]).length) base.gifs        = m.gifs
    if (Array.isArray(m.audio_files) && (m.audio_files as unknown[]).length) base.audio_files = m.audio_files
    if (Array.isArray(m.files)       && (m.files       as unknown[]).length) base.files       = m.files
    if (m.sticker)     base.sticker     = m.sticker
    if (m.share)       base.share       = m.share
    if (m.call_duration !== undefined) base.call_duration = m.call_duration
    if (m.missed      !== undefined)   base.missed        = m.missed
    if (m.ip)          base.ip          = m.ip
  }

  // Reactions — same shape in both formats: [{ reaction, actor, timestamp? }]
  if (Array.isArray(m.reactions) && (m.reactions as unknown[]).length > 0) {
    base.reactions = m.reactions
  }

  if (m.type) base.type = m.type

  return base
}

function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

async function recomputeBlockIds(
  col: Awaited<ReturnType<typeof getCollection>>,
  onProgress?: (current: number, total: number) => void,
) {
  const all = await col
    .find({}, { projection: { timestamp_ms: 1, sender_name: 1 } })
    .sort({ timestamp_ms: 1 })
    .toArray()

  const ops: unknown[] = []
  let lastDay: string | null = null, lastSender: string | null = null, blockId: ObjectId | null = null

  for (const m of all) {
    const d = dayKey(Number(m.timestamp_ms))
    const grouped = d === lastDay && m.sender_name === lastSender
    if (!grouped) blockId = m._id as ObjectId
    lastDay = d; lastSender = m.sender_name as string
    ops.push({ updateOne: { filter: { _id: m._id }, update: { $set: { blockId } } } })
  }

  for (let i = 0; i < ops.length; i += BATCH) {
    await col.bulkWrite(ops.slice(i, i + BATCH) as Parameters<typeof col.bulkWrite>[0], { ordered: false })
    onProgress?.(Math.min(i + BATCH, ops.length), ops.length)
  }
}

async function upsertThread({
  collectionName, threadName, participants, facebookThreadId, initials, color, total,
}: {
  collectionName: string, threadName: string, participants: string[],
  facebookThreadId?: string, initials?: string, color?: string, total: number,
}) {
  try {
    const payload = await getPayloadClient()

    // Check if thread already exists
    const existing = await payload.find({
      collection: 'threads',
      where: { collection: { equals: collectionName } },
      limit: 1, depth: 0, overrideAccess: true,
    })

    const data = {
      name:             threadName,
      collection:       collectionName,
      initials:         initials ?? threadName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      color:            (color ?? 'bg-rose-400') as 'bg-rose-400' | 'bg-violet-400' | 'bg-amber-400' | 'bg-sky-400' | 'bg-pink-400' | 'bg-indigo-400' | 'bg-emerald-400' | 'bg-orange-400',
      facebookThreadId: facebookThreadId ?? '',
      participants:     participants.map(name => ({ name })),
      messageCount:     total,
    }

    if (existing.totalDocs > 0) {
      // Update first, delete any duplicates
      await payload.update({ collection: 'threads', id: existing.docs[0].id, data: { messageCount: total }, overrideAccess: true })
      for (const dup of existing.docs.slice(1)) {
        await payload.delete({ collection: 'threads', id: dup.id, overrideAccess: true }).catch(() => {})
      }
    } else {
      await payload.create({ collection: 'threads', data, overrideAccess: true })
    }
  } catch (e) {
    console.error('upsertThread error:', e)
  }
}
