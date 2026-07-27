import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

async function getCallerInfo(): Promise<{ userId: string | null; isSuperAdmin: boolean; name: string | undefined }> {
  const session = await getSession()
  if (!session) return { userId: null, isSuperAdmin: false, name: undefined }
  try {
    const payload = await getPayloadClient()
    const user = await payload.findByID({ collection: 'users', id: session.userId, overrideAccess: true })
    return {
      userId: session.userId,
      isSuperAdmin: !!(user as any)?.superAdmin,
      name: (user as { name?: string }).name ?? undefined,
    }
  } catch {
    return { userId: session.userId, isSuperAdmin: false, name: undefined }
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// GET ?limit=&sort=&depth=  — list hashtags (private ones filtered by caller identity)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') ?? '200')
    const sort  = searchParams.get('sort') ?? 'name'
    const depth = parseInt(searchParams.get('depth') ?? '0')
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'hashtags',
      limit,
      sort,
      depth,
      overrideAccess: true,
    })

    const { userId, isSuperAdmin } = await getCallerInfo()

    const visible = result.docs.filter(h => {
      if (!h.isPrivate) return true
      if (isSuperAdmin) return true
      return h.createdById === userId
    })

    return NextResponse.json({ ...result, docs: visible }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// POST { name, context? } — create hashtag
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400, headers: CORS })
    const payload = await getPayload({ config })

    const { userId, name: createdBy } = await getCallerInfo()

    const doc = await payload.create({
      collection: 'hashtags',
      data: {
        ...body,
        ...(createdBy ? { createdBy } : {}),
        ...(userId ? { createdById: userId } : {}),
      },
      overrideAccess: true,
    })
    return NextResponse.json({ doc }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
