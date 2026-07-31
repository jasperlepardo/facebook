import { NextRequest, NextResponse } from 'next/server'
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { getCollection } from '@/lib/db'
import { getSession } from '@/lib/session'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

const BUCKET = process.env.R2_BUCKET ?? 'jasper-ciara-media'

let _s3: S3Client | null = null
function getS3() {
  if (!_s3) _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID ?? '793d45ff21c7d79b82f3fdfe10971466'}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
    requestHandler: new NodeHttpHandler({ connectionTimeout: 10_000, socketTimeout: 30_000 }),
  })
  return _s3
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  try {
    const { collection, r2Keys } = await req.json()
    if (!collection || !Array.isArray(r2Keys) || r2Keys.length === 0) {
      return NextResponse.json({ stripped: 0 }, { headers: CORS })
    }

    const col = await getCollection(collection)

    // ── 1. Remove URI references from MongoDB ─────────────────────────────────
    await Promise.all(
      (['photos', 'videos', 'gifs', 'audio_files', 'files'] as const).map(field =>
        col.updateMany(
          { [`${field}.uri`]: { $in: r2Keys } },
          { $pull: { [field]: { uri: { $in: r2Keys } } } } as any,
        )
      )
    )

    // ── 2. Delete the actual R2 objects ───────────────────────────────────────
    if (process.env.R2_ACCESS_KEY_ID) {
      const CHUNK = 1000
      for (let i = 0; i < r2Keys.length; i += CHUNK) {
        await getS3().send(new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: r2Keys.slice(i, i + CHUNK).map(Key => ({ Key })) },
        })).catch(() => {})
      }
    }

    return NextResponse.json({ stripped: r2Keys.length }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
