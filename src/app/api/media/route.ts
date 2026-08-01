import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { getS3, R2_BUCKET } from '@/lib/r2'

export const runtime = 'nodejs'

const RESIZEABLE = /^(image\/(jpeg|jpg|png|webp|gif|tiff|avif))$/i
const W_MIN = 48
const W_MAX = 1280

function parseWidth(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return null
  return Math.min(W_MAX, Math.max(W_MIN, n))
}

async function streamOriginal(obj: {
  Body?: { transformToWebStream: () => ReadableStream }
  ContentType?: string
  ContentLength?: number
  ETag?: string
}) {
  if (!obj.Body) return new NextResponse(null, { status: 404 })
  const headers = new Headers()
  headers.set('Content-Type', obj.ContentType ?? 'application/octet-stream')
  if (obj.ContentLength != null) headers.set('Content-Length', String(obj.ContentLength))
  if (obj.ETag) headers.set('ETag', obj.ETag)
  headers.set('Cache-Control', 'private, max-age=31536000, immutable')
  return new NextResponse(obj.Body.transformToWebStream(), { status: 200, headers })
}

/** Auth required via middleware. Streams R2 objects so the client never depends on r2.dev. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }
  if (!R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 500 })
  }

  const width = parseWidth(req.nextUrl.searchParams.get('w'))

  try {
    const obj = await getS3().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    if (!obj.Body) return new NextResponse(null, { status: 404 })

    const contentType = obj.ContentType ?? 'application/octet-stream'

    if (width != null && RESIZEABLE.test(contentType)) {
      try {
        const bytes = Buffer.from(await obj.Body.transformToByteArray())
        const out = await sharp(bytes)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer()

        const headers = new Headers()
        headers.set('Content-Type', 'image/jpeg')
        headers.set('Content-Length', String(out.byteLength))
        if (obj.ETag) headers.set('ETag', `${obj.ETag}-w${width}`)
        headers.set('Cache-Control', 'private, max-age=31536000, immutable')
        return new NextResponse(new Uint8Array(out), { status: 200, headers })
      } catch (resizeErr) {
        console.warn('[api/media] resize failed, serving original', key, resizeErr)
        // Body already consumed — re-fetch for fallback
        const again = await getS3().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
        if (!again.Body) return new NextResponse(null, { status: 404 })
        return streamOriginal(again)
      }
    }

    return streamOriginal(obj)
  } catch (e: unknown) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } }
    const status = err.$metadata?.httpStatusCode
    if (err.name === 'NoSuchKey' || status === 404) return new NextResponse(null, { status: 404 })
    console.error('[api/media]', key, e)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 502 })
  }
}
