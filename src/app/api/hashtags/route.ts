import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { getCallerInfo } from '@/lib/auth'
import { getSession } from '@/lib/session'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// GET ?limit=&sort=&depth=&thread=  — list hashtags (optionally scoped to a thread)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit  = parseInt(searchParams.get('limit') ?? '200')
    const sort   = searchParams.get('sort') ?? 'name'
    const depth  = parseInt(searchParams.get('depth') ?? '0')
    const thread = searchParams.get('thread')
    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'hashtags',
      limit,
      sort,
      depth,
      overrideAccess: true,
    })

    const session = await getSession()
    const userId = session?.userId ?? null
    const isSuperAdmin = session?.superAdmin ?? false

    const visible = result.docs.filter(h => {
      if (!h.isPrivate) return true
      if (isSuperAdmin) return true
      return h.createdById === userId
    })

    return NextResponse.json({ ...result, docs: visible }, { headers: CORS })
  } catch (e) {
    console.error(e)
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
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
