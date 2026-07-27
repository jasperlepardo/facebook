import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// GET ?limit=&sort=&depth=  — list hashtags
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
    return NextResponse.json(result, { headers: CORS })
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
    const doc = await payload.create({
      collection: 'hashtags',
      data: body,
      overrideAccess: true,
    })
    return NextResponse.json({ doc }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
