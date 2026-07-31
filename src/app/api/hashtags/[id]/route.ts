import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { isSuperAdmin } from '@/lib/auth'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// PATCH { name?, context?, groupCount?, firstMsgTs?, isPrivate? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const payload = await getPayload({ config })

    // Only super admins may set isPrivate
    if ('isPrivate' in body && !(await isSuperAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: CORS })
    }

    const doc = await payload.update({
      collection: 'hashtags',
      id,
      data: body,
      overrideAccess: true,
    })
    return NextResponse.json({ doc }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// DELETE
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config })
    await payload.delete({
      collection: 'hashtags',
      id,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
