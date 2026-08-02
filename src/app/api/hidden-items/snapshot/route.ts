import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getHiddenSnapshot } from '@/lib/hidden-sync'

/** GET — compact hidden messageIds + uris for any authenticated user. */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const snapshot = await getHiddenSnapshot()
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
