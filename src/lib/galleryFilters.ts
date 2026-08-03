/** Local calendar month bounds as inclusive timestamp_ms. */
export function monthBounds(year: number, month: number): { tsFrom: number; tsTo: number } {
  const tsFrom = new Date(year, month - 1, 1).getTime()
  const tsTo = new Date(year, month, 0, 23, 59, 59, 999).getTime()
  return { tsFrom, tsTo }
}

/** Parse `YYYY-MM` into month bounds, or null if invalid. */
export function monthKeyBounds(ym: string): { tsFrom: number; tsTo: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  if (month < 1 || month > 12) return null
  return monthBounds(year, month)
}

export function galleryFilterKey(senderIds: string[], tsFrom?: number, tsTo?: number): string {
  const senders = senderIds.slice().sort().join(',')
  const from = tsFrom != null ? String(tsFrom) : ''
  const to = tsTo != null ? String(tsTo) : ''
  if (!senders && !from && !to) return ''
  return `s${senders}_f${from}_t${to}`
}

export function appendGalleryFilterParams(
  params: URLSearchParams,
  senderIds: string[],
  tsFrom?: number,
  tsTo?: number,
) {
  if (senderIds.length) params.set('senderId', senderIds.join(','))
  if (tsFrom != null) params.set('tsFrom', String(tsFrom))
  if (tsTo != null) params.set('tsTo', String(tsTo))
}
