import { NextRequest, NextResponse } from 'next/server'
import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getCollection } from '@/lib/db'
import { getPayloadClient } from '@/lib/payload-access'
import { requireSuperAdmin } from '@/lib/auth'
import { getS3, R2_BUCKET } from '@/lib/r2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'DELETE, OPTIONS' }

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS })

  try {
    const { collection } = await req.json()
    if (!collection)
      return NextResponse.json({ error: 'collection required' }, { status: 400, headers: CORS })
    if (collection === 'messages')
      return NextResponse.json({ error: 'Cannot delete the default collection' }, { status: 400, headers: CORS })

    const results = { mongoDropped: false, payloadDeleted: false, r2Deleted: 0, r2Failed: 0 }

    // ── 1. Drop MongoDB collection ─────────────────────────────────────────────
    try {
      const col = await getCollection(collection)
      await col.drop()
    } catch {}
    results.mongoDropped = true

    // ── 2. Delete Payload thread entry ─────────────────────────────────────────
    try {
      const payload = await getPayloadClient()
      const found = await payload.find({
        collection: 'threads',
        where: { collection: { equals: collection } },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of found.docs) {
        await payload.delete({ collection: 'threads', id: doc.id, overrideAccess: true })
      }
      results.payloadDeleted = true
    } catch {}

    // ── 3. Delete R2 media objects via S3-compatible API ──────────────────────
    if (!process.env.R2_ACCESS_KEY_ID) {
      return NextResponse.json(
        { ...results, error: 'R2_ACCESS_KEY_ID not set — MongoDB and thread entry deleted but R2 media was NOT cleaned up' },
        { status: 500, headers: CORS },
      )
    }

    const keys = await listR2Objects(`${collection}/`)
    const CHUNK = 1000
    for (let i = 0; i < keys.length; i += CHUNK) {
      try {
        const res = await getS3().send(new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: { Objects: keys.slice(i, i + CHUNK).map(Key => ({ Key })) },
        }))
        results.r2Deleted += res.Deleted?.length ?? 0
        results.r2Failed  += res.Errors?.length  ?? 0
      } catch {
        results.r2Failed += keys.slice(i, i + CHUNK).length
      }
    }

    return NextResponse.json(results, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

async function listR2Objects(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined

  do {
    const res = await getS3().send(new ListObjectsV2Command({
      Bucket:            R2_BUCKET,
      Prefix:            prefix,
      MaxKeys:           1000,
      ContinuationToken: token,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)

  return keys
}
