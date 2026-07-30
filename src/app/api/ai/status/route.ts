import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ hasApiKey: !!process.env.ANTHROPIC_API_KEY })
}
