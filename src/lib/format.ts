/**
 * Optional custom CDN (not Cloudflare’s rate-limited `*.r2.dev` public host).
 * If unset or still pointing at r2.dev, media is served via authenticated `/api/media`.
 */
function publicMediaBase(): string {
  const raw = process.env.NEXT_PUBLIC_R2_URL?.replace(/\/$/, '') ?? ''
  if (!raw) return ''
  try {
    const host = new URL(raw).hostname
    if (host.endsWith('.r2.dev')) return ''
  } catch {
    return ''
  }
  return raw
}

const R2_DIRECT = publicMediaBase()

export const r2 = (uri: string, opts?: { w?: number }) => {
  if (R2_DIRECT) {
    return `${R2_DIRECT}/${uri.split('/').map(encodeURIComponent).join('/')}`
  }
  const params = new URLSearchParams({ key: uri })
  if (opts?.w != null && Number.isFinite(opts.w)) {
    params.set('w', String(Math.round(opts.w)))
  }
  return `/api/media?${params.toString()}`
}

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export const fmtTimeShort = (ts: number) => {
  const d = new Date(ts)
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })

export function relTime(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
