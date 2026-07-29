export const r2 = (uri: string) =>
  `https://pub-bcf374add91945839b65e3ee37ef410d.r2.dev/${uri.split('/').map(encodeURIComponent).join('/')}`

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

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

const hasTime = (iso: string) => iso.includes('T')

export function fmtIso(iso: string) {
  if (!iso) return ''
  const d = new Date(iso.split('T')[0] + 'T00:00:00')
  const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  if (!hasTime(iso)) return datePart
  const [h, m] = iso.split('T')[1].split(':').map(Number)
  return `${datePart} · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function fmtDateRange(start: string, end?: string) {
  if (!end || start === end) return fmtIso(start)
  const sd = start.split('T')[0], ed = end.split('T')[0]
  if (sd === ed) {
    const d = new Date(sd + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    if (!hasTime(start) && !hasTime(end)) return d
    const t = (iso: string) => { const [h, m] = iso.split('T')[1].split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
    return `${d} · ${[hasTime(start) && t(start), hasTime(end) && t(end)].filter(Boolean).join(' – ')}`
  }
  const s = new Date(sd + 'T00:00:00'), e = new Date(ed + 'T00:00:00')
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString([], { day: 'numeric', year: 'numeric' })}`
  return `${fmtIso(start)} – ${fmtIso(end)}`
}
