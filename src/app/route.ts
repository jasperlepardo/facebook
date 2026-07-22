import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

const HTML = readFileSync(join(process.cwd(), 'src/viewer.html'), 'utf-8')

export async function GET() {
  return new NextResponse(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
