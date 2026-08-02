import { LightboxState } from '@/types'
import { r2 } from '@/lib/format'

export interface LocalMediaItem {
  uri: string
}

/**
 * Build a lightbox carousel scoped to one message's media array
 * (chat photo strip / merged photo-only run).
 */
export function buildLocalMediaLightbox({
  items,
  index,
  type,
  mediaType,
  msgId,
  ts,
  caption = '',
  onLightbox,
}: {
  items: LocalMediaItem[]
  /** 0-based index of the tapped item */
  index: number
  type: 'photo' | 'video' | 'gif'
  mediaType: 'photos' | 'videos' | 'gifs'
  msgId: string
  ts: number
  caption?: string
  onLightbox: (state: LightboxState) => void
}): LightboxState {
  const total = items.length
  const safeIndex = Math.max(0, Math.min(index, total - 1))

  const loadStrip = async (offset: number, limit: number) => {
    return items.slice(offset, offset + limit).map(it => ({ uri: it.uri }))
  }

  const mkState = (idx: number): LightboxState => {
    const item = items[idx]
    if (!item) return mkState(safeIndex)
    const prev = idx > 0 ? items[idx - 1] : undefined
    const next = idx < total - 1 ? items[idx + 1] : undefined
    return {
      src: r2(item.uri),
      uri: item.uri,
      type,
      mediaType,
      caption,
      msgId,
      ts,
      index: total > 1 ? idx + 1 : undefined,
      total: total > 1 ? total : undefined,
      prevSrc: prev ? r2(prev.uri) : undefined,
      nextSrc: next ? r2(next.uri) : undefined,
      onPrev: idx > 0 ? () => onLightbox(mkState(idx - 1)) : undefined,
      onNext: idx < total - 1 ? () => onLightbox(mkState(idx + 1)) : undefined,
      onGoToIndex: total > 1
        ? (absOff) => {
            if (absOff >= 0 && absOff < total) onLightbox(mkState(absOff))
          }
        : undefined,
      loadStrip: total > 1 ? loadStrip : undefined,
    }
  }

  return mkState(safeIndex)
}
