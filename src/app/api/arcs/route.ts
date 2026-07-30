import { NextRequest, NextResponse } from 'next/server'
import { getArcs } from '@/lib/db'

function clean(doc: Record<string, unknown>) {
  return { ...doc, _id: String(doc._id) }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const col = await getArcs()

  try {
    const year  = searchParams.get('year')
    const from  = searchParams.get('from')
    const to    = searchParams.get('to')

    let filter: Record<string, unknown> = {}
    if (from && to) {
      filter = { startDate: { $lte: to }, endDate: { $gte: from } }
    } else if (year) {
      const y = year.padStart(4, '0')
      filter = { startDate: { $lte: `${y}-12-31` }, endDate: { $gte: `${y}-01-01` } }
    }

    const docs = await col.find(filter).sort({ startDate: 1 }).toArray()
    return NextResponse.json({ arcs: docs.map(clean) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
