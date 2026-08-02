import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getCollection, getHiddenItems, isSafeCollectionName } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'private, no-store',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const payload = await getPayloadClient()
  const user = await payload.findByID({ collection: 'users', id: session.userId })
  if (!(user as { superAdmin?: boolean })?.superAdmin) return null
  return user
}

function clean(doc: Record<string, unknown>) {
  const d = { ...doc }
  if (d._id) d._id = String(d._id)
  if (d.blockId) d.blockId = String(d.blockId)
  return d
}

/** Expand legacy `media/photos/x.jpg` and thread-prefixed forms so URI hides still resolve after remount. */
function expandUri(uri: string, collections: string[]): string[] {
  const out = new Set<string>([uri])
  const parts = uri.split('/')
  const file = parts[parts.length - 1]
  const kind = parts.length >= 2 ? parts[parts.length - 2] : 'photos'
  if (file) {
    out.add(file)
    out.add(`${kind}/${file}`)
    out.add(`media/${kind}/${file}`)
    for (const c of collections) out.add(`${c}/${kind}/${file}`)
  }
  return [...out]
}

function collectDocUris(cleaned: Record<string, unknown>): string[] {
  const uris: string[] = []
  for (const p of (cleaned.photos as { uri?: string }[] | undefined) ?? []) if (p.uri) uris.push(p.uri)
  for (const v of (cleaned.videos as { uri?: string }[] | undefined) ?? []) if (v.uri) uris.push(v.uri)
  for (const g of (cleaned.gifs as { uri?: string }[] | undefined) ?? []) if (g.uri) uris.push(g.uri)
  const sticker = cleaned.sticker as { uri?: string } | undefined
  if (sticker?.uri) uris.push(sticker.uri)
  return uris
}

function uriBasename(uri: string) {
  return uri.split('/').pop() || uri
}

function uriAllowed(uri: string | undefined, allowed: Set<string>, allowedBases: Set<string>): boolean {
  if (!uri) return false
  return allowed.has(uri) || allowedBases.has(uriBasename(uri))
}

/** Keep only media that matches the stored hidden URI values (legacy path forms included). */
function filterToHiddenMedia(
  doc: Record<string, unknown>,
  storedUris: string[],
  collections: string[],
): Record<string, unknown> {
  const allowed = new Set<string>()
  const allowedBases = new Set<string>()
  for (const stored of storedUris) {
    for (const v of expandUri(stored, collections)) {
      allowed.add(v)
      allowedBases.add(uriBasename(v))
    }
  }

  const photos = ((doc.photos as { uri?: string }[] | undefined) ?? [])
    .filter(p => uriAllowed(p.uri, allowed, allowedBases))
  const videos = ((doc.videos as { uri?: string }[] | undefined) ?? [])
    .filter(v => uriAllowed(v.uri, allowed, allowedBases))
  const gifs = ((doc.gifs as { uri?: string }[] | undefined) ?? [])
    .filter(g => uriAllowed(g.uri, allowed, allowedBases))
  const sticker = doc.sticker as { uri?: string } | undefined
  const keepSticker = sticker && uriAllowed(sticker.uri, allowed, allowedBases)

  const next: Record<string, unknown> = {
    _id: doc._id,
    timestamp_ms: doc.timestamp_ms,
    sender_name: doc.sender_name,
    senderId: doc.senderId,
    blockId: doc.blockId,
    is_unsent_image_by_messenger_kid_parent: false,
    is_geoblocked_for_viewer: false,
  }
  if (photos.length) next.photos = photos
  if (videos.length) next.videos = videos
  if (gifs.length) next.gifs = gifs
  if (keepSticker) next.sticker = sticker
  return next
}

async function listThreadCollections(preferred: string): Promise<string[]> {
  const names = new Set<string>()
  if (isSafeCollectionName(preferred)) names.add(preferred)
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'threads',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of result.docs) {
      const c = (doc as { collection?: string }).collection ?? ''
      if (isSafeCollectionName(c)) names.add(c)
    }
  } catch { /* prefer at least the requested thread */ }
  if (isSafeCollectionName('messages')) names.add('messages')
  const rest = [...names].filter(n => n !== preferred)
  return isSafeCollectionName(preferred) ? [preferred, ...rest] : rest
}

/** GET ?thread=xxx — hydrate hidden message + uri items into Message docs. */
export async function GET(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: CORS })

  const thread = new URL(req.url).searchParams.get('thread') ?? 'messages'
  if (!isSafeCollectionName(thread)) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400, headers: CORS })
  }

  try {
    const hiddenCol = await getHiddenItems()
    const items = await hiddenCol.find().sort({ createdAt: -1 }).toArray()

    const messageItems = items.filter(i => i.type === 'message')
    const uriItems = items.filter(i => i.type === 'uri')
    const messageIds = messageItems.map(i => i.value)
    const uris = uriItems.map(i => i.value)

    const byId = new Map<string, Record<string, unknown>>()
    const matchedMsgIds = new Set<string>()
    const matchedStoredUris = new Set<string>()
    /** messageId → original hidden_items uri values (for unhide) */
    const storedUrisByMsgId: Record<string, string[]> = {}

    const oids = messageIds
      .map(id => { try { return new ObjectId(id) } catch { return null } })
      .filter((id): id is ObjectId => id !== null)

    const collections = await listThreadCollections(thread)

    for (const colName of collections) {
      const remainingIds = oids.filter(id => !matchedMsgIds.has(String(id)))
      const remainingUris = uris.filter(u => !matchedStoredUris.has(u))
      if (!remainingIds.length && !remainingUris.length) break

      const msgs = await getCollection(colName)

      if (remainingIds.length) {
        const docs = await msgs.find({ _id: { $in: remainingIds } }).toArray()
        for (const doc of docs) {
          const cleaned = clean(doc as Record<string, unknown>)
          const id = String(cleaned._id)
          matchedMsgIds.add(id)
          if (!byId.has(id)) byId.set(id, cleaned)
        }
      }

      if (remainingUris.length) {
        const variantToStored = new Map<string, string>()
        const allVariants: string[] = []
        for (const stored of remainingUris) {
          for (const v of expandUri(stored, collections)) {
            if (!variantToStored.has(v)) variantToStored.set(v, stored)
            allVariants.push(v)
          }
        }
        const uniqueVariants = [...new Set(allVariants)]

        const found = await msgs.find({
          $or: [
            { 'photos.uri': { $in: uniqueVariants } },
            { 'videos.uri': { $in: uniqueVariants } },
            { 'gifs.uri': { $in: uniqueVariants } },
            { 'sticker.uri': { $in: uniqueVariants } },
          ],
        }).toArray()

        for (const doc of found) {
          const cleaned = clean(doc as Record<string, unknown>)
          const id = String(cleaned._id)
          const docUris = collectDocUris(cleaned)
          const bases = new Map(docUris.map(u => [uriBasename(u), u]))

          for (const stored of remainingUris) {
            if (matchedStoredUris.has(stored)) continue
            const variants = expandUri(stored, collections)
            const hit = docUris.some(u => variants.includes(u))
              || variants.some(v => bases.has(uriBasename(v)))
            if (!hit) continue
            matchedStoredUris.add(stored)
            const list = storedUrisByMsgId[id] ?? (storedUrisByMsgId[id] = [])
            if (!list.includes(stored)) list.push(stored)
          }

          if (!byId.has(id)) byId.set(id, cleaned)
        }
      }
    }

    const orphanedMessageIds = messageIds.filter(id => !matchedMsgIds.has(id))
    const orphanedUris = uris.filter(u => !matchedStoredUris.has(u))

    // URI-only hits: strip sibling media/text so the row shows only the hidden image(s)
    for (const [id, doc] of [...byId.entries()]) {
      if (matchedMsgIds.has(id)) continue
      const stored = storedUrisByMsgId[id]
      if (!stored?.length) continue
      byId.set(id, filterToHiddenMedia(doc, stored, collections))
    }

    // Synthetic rows only for unresolved URIs (so media can still be previewed by path)
    for (const uri of orphanedUris) {
      const item = uriItems.find(i => i.value === uri)
      const ts = item?.createdAt ? Date.parse(item.createdAt) : Date.now()
      byId.set(`uri:${uri}`, {
        _id: `uri:${uri}`,
        timestamp_ms: Number.isFinite(ts) ? ts : Date.now(),
        sender_name: 'Hidden media',
        photos: [{ uri, creation_timestamp: null }],
        is_unsent_image_by_messenger_kid_parent: false,
        is_geoblocked_for_viewer: false,
      })
      storedUrisByMsgId[`uri:${uri}`] = [uri]
    }

    const messages = [...byId.values()].sort(
      (a, b) => (a.timestamp_ms as number) - (b.timestamp_ms as number),
    )

    return NextResponse.json({
      messages,
      hiddenMsgIds: [...matchedMsgIds],
      hiddenUris: uris,
      storedUrisByMsgId,
      orphanedMessageIds,
      orphanedMessageItems: orphanedMessageIds.map(id => {
        const item = messageItems.find(i => i.value === id)
        return { _id: String(item?._id ?? ''), value: id }
      }).filter(i => i._id),
    }, { headers: CORS })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
