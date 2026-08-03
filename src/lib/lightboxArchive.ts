import { LightboxState } from '@/types'
import { apiFetch } from '@/lib/utils'
import { r2 } from '@/lib/format'
import { lightboxMediaCaption } from '@/lib/lightboxCaption'

type PhotoItem = { uri: string; ts: number; sender: string; msgId: string }

/**
 * Archive-wide lightbox opener (thread attachments of one media type).
 * Used by the Media pane — not chat message strips.
 */
export function createArchiveLightboxOpener(
  withThread: (url: string) => string,
  onLightbox: (state: LightboxState) => void,
): (state: LightboxState) => Promise<void> {
  const lightboxWindow: { current: { mtype: string; total: number; items: Map<number, PhotoItem> } | null } = {
    current: null,
  }

  return async (state: LightboxState) => {
    if (!state.ts) { onLightbox(state); return }

    // Show the tapped media immediately; enrich with neighbors in the background.
    const seeded: LightboxState = { ...state, source: state.source ?? 'gallery' }
    onLightbox(seeded)

    const mtype = state.mediaType ?? 'photos'
    const uriParam = state.uri ? `&uri=${encodeURIComponent(state.uri)}` : ''
    const typeMap: Record<string, LightboxState['type']> = { photos: 'photo', videos: 'video', gifs: 'gif' }

    try {
      const { offset: photoOff } = await apiFetch<{ offset: number }>(withThread(`/api/attachments?type=${mtype}&offsetOf=${state.ts}${uriParam}`))
      const baseOff = Math.max(0, photoOff - 1)
      const { items, total } = await apiFetch<{ items: PhotoItem[]; total: number }>(
        withThread(`/api/attachments?type=${mtype}&offset=${baseOff}&limit=3`)
      )

      const win = { mtype, total, items: new Map<number, PhotoItem>() }
      items.forEach((item, i) => win.items.set(baseOff + i, item))
      lightboxWindow.current = win

      // Prefer exact uri match; otherwise trust offsetOf (photoOff - baseOff).
      // Never fall back to "middle of window" (Math.min(1,…)) — that opens the 2nd
      // item whenever uri matching fails (e.g. first photo in the archive).
      // Do not match on msgId+ts alone: multi-photo messages share both.
      const byUri = state.uri ? items.findIndex(i => i.uri === state.uri) : -1
      const expectedLocal = photoOff - baseOff
      const target = byUri >= 0
        ? byUri
        : Math.min(Math.max(0, expectedLocal), Math.max(0, items.length - 1))
      if (!items[target]) return

      const ensureItem = async (absOff: number): Promise<PhotoItem | null> => {
        if (absOff < 0) return null
        const cached = lightboxWindow.current
        if (cached?.mtype === mtype && cached.items.has(absOff)) return cached.items.get(absOff)!
        try {
          const { items: fetched } = await apiFetch<{ items: PhotoItem[] }>(
            withThread(`/api/attachments?type=${mtype}&offset=${absOff}&limit=1`)
          )
          if (!fetched[0]) return null
          if (!lightboxWindow.current || lightboxWindow.current.mtype !== mtype) {
            lightboxWindow.current = { mtype, total, items: new Map() }
          }
          lightboxWindow.current.total = total
          lightboxWindow.current.items.set(absOff, fetched[0])
          return fetched[0]
        } catch {
          return null
        }
      }

      const loadStrip = async (offset: number, limit: number): Promise<{ uri: string }[]> => {
        if (offset < 0 || limit <= 0) return []
        const capped = Math.min(limit, Math.max(0, total - offset))
        if (!capped) return []

        const cache = lightboxWindow.current
        const allCached = cache?.mtype === mtype && Array.from({ length: capped }, (_, i) => cache.items.has(offset + i)).every(Boolean)
        if (allCached && cache) {
          return Array.from({ length: capped }, (_, i) => ({ uri: cache.items.get(offset + i)!.uri }))
        }

        try {
          const { items: fetched } = await apiFetch<{ items: PhotoItem[] }>(
            withThread(`/api/attachments?type=${mtype}&offset=${offset}&limit=${capped}`)
          )
          if (!lightboxWindow.current || lightboxWindow.current.mtype !== mtype) {
            lightboxWindow.current = { mtype, total, items: new Map() }
          }
          lightboxWindow.current.total = total
          fetched.forEach((item, i) => lightboxWindow.current!.items.set(offset + i, item))
          return fetched.map(item => ({ uri: item.uri }))
        } catch {
          return []
        }
      }

      const mkState = (absOff: number, item: PhotoItem): LightboxState => {
        const prev = lightboxWindow.current?.items.get(absOff - 1)
        const next = lightboxWindow.current?.items.get(absOff + 1)
        const kind = typeMap[mtype] ?? 'photo'
        return {
          src: r2(item.uri),
          uri: item.uri, type: kind, mediaType: mtype,
          caption: lightboxMediaCaption(item.ts, item.sender),
          msgId: item.msgId, ts: item.ts,
          source: state.source ?? 'gallery',
          index: absOff + 1,
          total,
          prevSrc: prev ? r2(prev.uri) : undefined,
          nextSrc: next ? r2(next.uri) : undefined,
          onPrev: absOff > 0 ? () => {
        const cached = lightboxWindow.current?.items.get(absOff - 1)
        if (cached) {
          onLightbox(mkState(absOff - 1, cached))
          void ensureItem(absOff - 2)
          return
        }
        return (async () => {
          try {
            const pi = await ensureItem(absOff - 1)
            if (!pi) return
            onLightbox(mkState(absOff - 1, pi))
            void ensureItem(absOff - 2)
          } catch { /* keep current */ }
        })()
      } : undefined,
      onNext: absOff < total - 1 ? () => {
        const cached = lightboxWindow.current?.items.get(absOff + 1)
        if (cached) {
          onLightbox(mkState(absOff + 1, cached))
          void ensureItem(absOff + 2)
          return
        }
        return (async () => {
          try {
            const ni = await ensureItem(absOff + 1)
            if (!ni) return
            onLightbox(mkState(absOff + 1, ni))
            void ensureItem(absOff + 2)
          } catch { /* keep current */ }
        })()
      } : undefined,
          onGoToIndex: async (targetOff: number) => {
            if (targetOff < 0 || targetOff >= total) return
            try {
              const itemAt = await ensureItem(targetOff)
              if (!itemAt) return
              void ensureItem(targetOff - 1)
              void ensureItem(targetOff + 1)
              onLightbox(mkState(targetOff, itemAt))
            } catch { /* keep current */ }
          },
          loadStrip,
        }
      }

      // Warm immediate neighbors before the user swipes.
      void ensureItem(baseOff + target - 1)
      void ensureItem(baseOff + target + 1)

      onLightbox(mkState(baseOff + target, items[target]))
    } catch {
      /* keep the immediate open state */
    }
  }
}
