import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getS3, R2_BUCKET } from '@/lib/r2'
import { getSession } from '@/lib/session'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

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
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 3600 },
    )

    return NextResponse.json({ url, key }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
