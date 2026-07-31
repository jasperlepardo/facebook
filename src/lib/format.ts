const R2_BASE = process.env.NEXT_PUBLIC_R2_URL ?? 'https://pub-bcf374add91945839b65e3ee37ef410d.r2.dev'

export const r2 = (uri: string) =>
  `${R2_BASE}/${uri.split('/').map(encodeURIComponent).join('/')}`

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
