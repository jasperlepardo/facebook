import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { upsertParticipants } from '@/lib/participantUtils'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

/** Upsert global participants by name; returns records + name→id map for message stamping. */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS })

  try {
    const body = await req.json() as { names?: unknown }
    if (!Array.isArray(body.names)) {
      return NextResponse.json({ error: 'names[] required' }, { status: 400, headers: CORS })
    }
    const names = body.names.filter((n): n is string => typeof n === 'string')
    const result = await upsertParticipants(names)
    return NextResponse.json(result, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
