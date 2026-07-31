import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getS3, R2_BUCKET } from '@/lib/r2'

export const runtime = 'nodejs'

/** Auth required via middleware. Streams R2 objects so the client never depends on r2.dev. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }
  if (!R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 500 })
  }

  try {
    const obj = await getS3().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    if (!obj.Body) return new NextResponse(null, { status: 404 })

    const headers = new Headers()
    headers.set('Content-Type', obj.ContentType ?? 'application/octet-stream')
    if (obj.ContentLength != null) headers.set('Content-Length', String(obj.ContentLength))
    if (obj.ETag) headers.set('ETag', obj.ETag)
    headers.set('Cache-Control', 'private, max-age=31536000, immutable')

    return new NextResponse(obj.Body.transformToWebStream(), { status: 200, headers })
  } catch (e: unknown) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } }
    const status = err.$metadata?.httpStatusCode
    if (err.name === 'NoSuchKey' || status === 404) return new NextResponse(null, { status: 404 })
    console.error('[api/media]', key, e)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 502 })
  }
}
