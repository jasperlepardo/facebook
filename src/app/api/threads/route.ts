import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload-access'
import { getCollection } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

async function seedCiara(payload: Awaited<ReturnType<typeof getPayloadClient>>) {
  try {
    const col = await getCollection('messages')
    const messageCount = await col.countDocuments()
    await payload.create({
      collection: 'threads',
      data: {
        name:             'Ciara',
        initials:         'CF',
        color:            'bg-rose-400',
        collection:       'messages',
        facebookThreadId: '10210106981572958',
        participants:     [{ name: 'Ciara Fei' }, { name: 'Jasper Lepardo' }],
        messageCount,
      },
      overrideAccess: true,
    })
  } catch (e) {
    console.error('seedCiara error:', e)
  }
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

    // Auto-seed Ciara thread on first run
    if (result.totalDocs === 0) {
      await seedCiara(payload)
      const seeded = await payload.find({
        collection: 'threads',
        limit: 100,
        sort: 'name',
        depth: 0,
        overrideAccess: true,
      })
      return NextResponse.json({ threads: mapThreads(seeded.docs) }, { headers: CORS })
    }

    return NextResponse.json({ threads: mapThreads(result.docs) }, { headers: CORS })
  } catch (e) {
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
