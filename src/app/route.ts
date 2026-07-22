import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

let HTML: string
try {
  HTML = readFileSync(join(process.cwd(), 'src/viewer.html'), 'utf-8')
} catch (e) {
  HTML = `<pre>Error loading viewer: ${e}</pre>`
}

export async function GET() {
  return new NextResponse(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
