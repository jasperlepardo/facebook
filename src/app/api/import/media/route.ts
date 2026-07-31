import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NodeHttpHandler } from '@smithy/node-http-handler'
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
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10_000,
      socketTimeout:     120_000,
    }),
  })
  return _s3
}

function classifyFile(filename: string): { folder: string } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg','jpeg','png','webp','heic'].includes(ext)) return { folder: 'photos' }
  if (['mp4','mov','avi','mkv'].includes(ext))          return { folder: 'videos' }
  if (ext === 'gif')                                    return { folder: 'gifs'   }
  if (['aac','mp3','m4a','ogg','opus'].includes(ext))   return { folder: 'audio'  }
  return                                                       { folder: 'files'  }
}

function r2Key(filename: string, threadFolder: string): string {
  const { folder } = classifyFile(filename)
  return `${threadFolder}/${folder}/${filename}`
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  if (!process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2_ACCESS_KEY_ID not configured' }, { status: 500, headers: CORS })
  }

  try {
    const { filename, threadFolder = 'messages', contentType = 'application/octet-stream' } = await req.json()

    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400, headers: CORS })

    const key = r2Key(filename, threadFolder)
    const url = await getSignedUrl(
      getS3(),
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 3600 },
    )

    return NextResponse.json({ url, key }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
