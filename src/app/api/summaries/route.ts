import { NextRequest, NextResponse } from 'next/server'
import { getDailySummaries } from '@/lib/db'

function clean(doc: Record<string, unknown>) {
  return { ...doc, _id: String(doc._id) }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const col = await getDailySummaries()

  try {
    // Meta: distinct years and months that have summaries
    if (searchParams.get('meta') === '1') {
      const docs = await col
        .find({}, { projection: { year: 1, month: 1 } })
        .sort({ date: 1 })
        .toArray()

      const yearsSet = new Set<number>()
      const byYear: Record<number, number[]> = {}
      for (const d of docs) {
        const y = d.year as number
        const m = d.month as number
        yearsSet.add(y)
        if (!byYear[y]) byYear[y] = []
        if (!byYear[y].includes(m)) byYear[y].push(m)
      }
      return NextResponse.json({ years: [...yearsSet].sort(), byYear })
    }

    const date  = searchParams.get('date')
    const year  = searchParams.get('year')
    const month = searchParams.get('month')
    const from  = searchParams.get('from')
    const to    = searchParams.get('to')

    let filter: Record<string, unknown> = {}
    if (date) {
      filter = { date }
    } else if (from && to) {
      filter = { date: { $gte: from, $lte: to } }
    } else if (year && month) {
      filter = { year: parseInt(year), month: parseInt(month) }
    } else if (year) {
      filter = { year: parseInt(year) }
    }

    const docs = await col.find(filter).sort({ date: 1 }).toArray()
    return NextResponse.json({ summaries: docs.map(clean) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
