import { NextRequest, NextResponse } from 'next/server'

export interface OgMeta {
  title?: string
  description?: string
  image?: string
  host: string
}

const cache = new Map<string, { data: OgMeta; ts: number }>()
const TTL       = 1000 * 60 * 60
const MAX_CACHE = 500

function parseHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

function getMeta(html: string, key: string): string | undefined {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+(?:property|name)=["']${k}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1])
  }
}

function extractOg(html: string, url: string): OgMeta {
  const host = parseHost(url)
  const title =
    getMeta(html, 'og:title') ||
    getMeta(html, 'twitter:title') ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  const description =
    getMeta(html, 'og:description') ||
    getMeta(html, 'twitter:description') ||
    getMeta(html, 'description')
  const image =
    getMeta(html, 'og:image') ||
    getMeta(html, 'twitter:image')
  return { host, title, description, image }
}

function cacheSet(url: string, data: OgMeta) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cacheSet(url, data)
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 })

  const hit = cache.get(url)
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json(hit.data)

  const host = parseHost(url)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; resibo/1.0 +https://resibo.app)' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })

    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) {
      const data: OgMeta = { host }
      cacheSet(url, data)
      return NextResponse.json(data)
    }

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let html = ''
    if (reader) {
      while (html.length < 120_000) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        if (html.includes('</head>')) break
      }
      reader.cancel()
    }

    const data = extractOg(html, url)
    cacheSet(url, data)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    const data: OgMeta = { host }
    return NextResponse.json(data)
  }
}
