import { NextRequest, NextResponse } from 'next/server'
import { isSafeCollectionName } from '@/lib/db'
import { getOrBuildDateIndex } from '@/lib/dateIndex'
import type { DateIndex } from '@/types'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'private, no-store',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET(req: NextRequest) {
  const thread = new URL(req.url).searchParams.get('thread') ?? 'messages'
  if (!isSafeCollectionName(thread)) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400, headers: CORS })
  }

  try {
    const index = await getOrBuildDateIndex(thread)
    return NextResponse.json(index satisfies DateIndex, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
