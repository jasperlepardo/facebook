/** Public CDN base when set (custom domain). Otherwise media is served via authenticated `/api/media`. */
const R2_DIRECT = process.env.NEXT_PUBLIC_R2_URL?.replace(/\/$/, '') ?? ''

export const r2 = (uri: string) => {
  if (R2_DIRECT) {
    return `${R2_DIRECT}/${uri.split('/').map(encodeURIComponent).join('/')}`
  }
  return `/api/media?key=${encodeURIComponent(uri)}`
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
