import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'

const CORS       = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? ''
const BUCKET     = process.env.R2_BUCKET             ?? ''
const R2_PUBLIC  = process.env.R2_PUBLIC_URL         ?? ''

// Any URI still carrying a media/ prefix is old format
const OLD_URI_RE = /^media\//

const MEDIA_FIELDS = ['photos', 'videos', 'gifs', 'audio_files', 'files', 'sticker'] as const

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS })

  const { collection = 'messages' } = await req.json().catch(() => ({}))
  const token = process.env.CLOUDFLARE_API_TOKEN

  const col = await getCollection(collection)

  // ── 1. Collect unique old-format URIs (anything starting with media/) ───────
  const oldUris = new Set<string>()

  for (const field of MEDIA_FIELDS) {
    const dbField = field === 'audio_files' ? 'audio_files' : field

    if (field === 'sticker') {
      const docs = await col.find(
        { sticker: { $exists: true } },
        { projection: { 'sticker.uri': 1 } },
      ).toArray()
      for (const d of docs) {
        const uri = (d.sticker as any)?.uri
        if (uri && OLD_URI_RE.test(uri)) oldUris.add(uri)
      }
    } else {
      const docs = await col.aggregate([
        { $match: { [dbField]: { $exists: true } } },
        { $unwind: `$${dbField}` },
        { $match: { [`${dbField}.uri`]: { $regex: '^media/' } } },
        { $group: { _id: `$${dbField}.uri` } },
      ]).toArray()
      for (const d of docs) oldUris.add(d._id as string)
    }
  }

  if (oldUris.size === 0) {
    return NextResponse.json({ message: 'Nothing to migrate', collection }, { headers: CORS })
  }

  const results = { collection, total: oldUris.size, copied: 0, skipped: 0, copyErrors: 0, deleted: 0, deleteErrors: 0 }

  // ── 2. Copy R2 objects: strip media/ prefix ────────────────────────────────
  if (token) {
    const uriList = [...oldUris]
    const CONCURRENCY = 10

    for (let i = 0; i < uriList.length; i += CONCURRENCY) {
      await Promise.all(uriList.slice(i, i + CONCURRENCY).map(async oldUri => {
        // Strip leading media/ — if it was media/photos/file.jpg (no collection) add collection
        let newUri = oldUri.replace(/^media\//, '')
        // If newUri still starts with a type folder (no collection prefix), prepend collection
        if (/^(photos|videos|audio|files|gifs)\//.test(newUri)) {
          newUri = `${collection}/${newUri}`
        }

        const publicUrl = `${R2_PUBLIC}/${oldUri.split('/').map(encodeURIComponent).join('/')}`
        const newKey    = newUri.split('/').map(encodeURIComponent).join('/')

        try {
          const dl = await fetch(publicUrl)
          if (!dl.ok) { results.copyErrors++; return }
          const body = await dl.arrayBuffer()
          const up   = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${newKey}`,
            { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body },
          )
          if (up.ok) results.copied++
          else       results.copyErrors++
        } catch { results.copyErrors++ }
      }))
    }
  } else {
    results.skipped = oldUris.size
  }

  // ── 3. Bulk update MongoDB URIs ────────────────────────────────────────────
  const mapUri = (expr: string) => ({
    $cond: {
      if: { $regexMatch: { input: expr, regex: '^media/' } },
      then: {
        $let: {
          vars: { stripped: { $replaceOne: { input: expr, find: 'media/', replacement: '' } } },
          in: {
            $cond: {
              // If after stripping media/ it starts with a type (old format), prepend collection
              if: { $regexMatch: { input: '$$stripped', regex: '^(photos|videos|audio|files|gifs)/' } },
              then: { $concat: [`${collection}/`, '$$stripped'] },
              else: '$$stripped',
            },
          },
        },
      },
      else: expr,
    },
  })

  const $setFields: Record<string, unknown> = {}
  for (const field of ['photos', 'videos', 'gifs', 'audio_files', 'files'] as const) {
    $setFields[field] = {
      $cond: {
        if: { $isArray: `$${field}` },
        then: { $map: { input: `$${field}`, as: 'item', in: { $mergeObjects: ['$$item', { uri: mapUri('$$item.uri') }] } } },
        else: `$${field}`,
      },
    }
  }
  $setFields.sticker = {
    $cond: {
      if: { $ifNull: ['$sticker', false] },
      then: { $mergeObjects: ['$sticker', { uri: mapUri('$sticker.uri') }] },
      else: '$sticker',
    },
  }

  await col.updateMany({}, [{ $set: $setFields }])

  // ── 4. Delete old R2 keys ──────────────────────────────────────────────────
  if (token && results.copied > 0) {
    const uriList = [...oldUris]
    const CONCURRENCY = 10
    for (let i = 0; i < uriList.length; i += CONCURRENCY) {
      await Promise.all(uriList.slice(i, i + CONCURRENCY).map(async oldUri => {
        const oldKey = oldUri.split('/').map(encodeURIComponent).join('/')
        try {
          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${oldKey}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
          )
          if (res.ok) results.deleted++
          else        results.deleteErrors++
        } catch { results.deleteErrors++ }
      }))
    }
  }

  return NextResponse.json(results, { headers: CORS })
}
