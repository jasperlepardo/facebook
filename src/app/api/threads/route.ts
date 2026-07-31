import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload-access'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET() {
  try {
    const payload = await getPayloadClient()
    const result  = await payload.find({
      collection: 'threads',
      limit: 100,
      sort: 'name',
      depth: 0,
      overrideAccess: true,
    })
    return NextResponse.json({ threads: mapThreads(result.docs) }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

function mapThreads(docs: any[]) {
  const seen = new Set<string>()
  return docs
    .map(t => ({
      id:               t.id,
      name:             t.name,
      initials:         t.initials ?? '',
      color:            t.color    ?? 'bg-rose-400',
      collection:       t.collection,
      facebookThreadId: t.facebookThreadId ?? null,
      participants:     (t.participants ?? []).map((p: any) => p.name),
      messageCount:     t.messageCount ?? 0,
    }))
    .filter(t => {
      if (seen.has(t.collection)) return false
      seen.add(t.collection)
      return true
    })
}
