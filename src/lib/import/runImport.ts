import { fixMojibake } from '@/lib/mojibake'
import type { FileRef, FoundThread, ImportProgress, StoredSource, VirtualFS } from '@/lib/import/types'
import { guessMime, inferInitials, mediaTypeLabel, pickColor } from '@/lib/import/utils'
import { openSource } from '@/lib/import/virtualFs'
import { buildUriIndex, extractMediaUris } from '@/lib/import/parseExport'

export interface RunImportArgs {
  selected: FoundThread
  threadName: string
  sources: Map<string, StoredSource>
  onProgress: (progress: ImportProgress) => void
  /** Non-fatal errors (insert failures, finalize stream errors). Fatal errors throw. */
  onError?: (message: string) => void
}

export interface RunImportResult {
  inserted: number
  mediaUploaded: number
  mediaMissing: number
}

export async function runImport({
  selected,
  threadName,
  sources,
  onProgress,
  onError,
}: RunImportArgs): Promise<RunImportResult> {
  const collectionName = selected.key
  const tFolder        = collectionName

  // ── 1. Open all sources and build URI indexes ────────────────────────────
  onProgress({ label: 'Preparing sources', current: 0, total: 0, errors: [] })

  const openFSCache   = new Map<string, VirtualFS>()
  const uriIndexCache = new Map<string, Map<string, string>>()

  const allSourceIds = new Set([
    ...selected.messageFiles.map(f => f.sourceId),
    ...selected.mediaBasePaths.map(f => f.sourceId),
  ])
  for (const sourceId of allSourceIds) {
    const src = sources.get(sourceId)
    if (!src) continue
    const fs = await openSource(src)
    if (!fs) continue
    openFSCache.set(sourceId, fs)
    uriIndexCache.set(sourceId, buildUriIndex(fs))
  }

  // ── 2. Concurrent pipeline: upload media + insert messages per file ──────
  const uriMap   = new Map<string, string>()   // fbUri → r2Key (confirmed uploads)
  const inFlight = new Map<string, Promise<void>>()
  const mediaErrors: string[] = []
  let uploaded = 0, missing = 0, inserted = 0

  const totalFiles = selected.messageFiles.length  // used in progress label inside processFile

  // Update aggregate progress bar
  const refreshProgress = (label: string, sublabel?: string) =>
    onProgress({
      label,
      sublabel: sublabel ?? `${uploaded} uploaded · ${inserted} messages saved`,
      current: uploaded + missing,
      total: selected.mediaFileCount || 1,
      errors: mediaErrors.slice(-3),
    })

  async function uploadUri(fbUri: string): Promise<void> {
    if (uriMap.has(fbUri)) return
    if (inFlight.has(fbUri)) { await inFlight.get(fbUri); return }

    // Normalize the URI before lookup:
    // 1. Strip leading "./" (scraped exports use "./media/..." relative paths)
    // 2. Try all suffix variants (handles user dropping inner folder vs outer folder)
    const baseUri = fbUri.startsWith('./') ? fbUri.slice(2) : fbUri
    const uriVariants = [...new Set([fbUri, baseUri])]
    // Also strip "your_facebook_activity/" prefix (native FB exports)
    const fbActIdx = baseUri.indexOf('your_facebook_activity/')
    if (fbActIdx !== -1) uriVariants.push(baseUri.slice(fbActIdx + 'your_facebook_activity/'.length))
    // Try all path suffix variants of baseUri
    let _u = baseUri
    while (_u.includes('/')) {
      _u = _u.slice(_u.indexOf('/') + 1)
      uriVariants.push(_u)
    }

    const p = (async () => {
      for (const [, index] of uriIndexCache) {
        const vfsPath = uriVariants.map(u => index.get(u)).find(Boolean)
        if (!vfsPath) continue
        const fsEntry = [...openFSCache.entries()].find(([sid]) => uriVariants.some(u => uriIndexCache.get(sid)?.get(u) === vfsPath))?.[1]
        if (!fsEntry) continue

        const filename    = vfsPath.split('/').pop() ?? vfsPath
        const blob        = await fsEntry.readBlob(vfsPath).catch(() => null)
        if (!blob) { missing++; return }
        const contentType = blob.type || guessMime(filename)

        // Retry up to 3 times with exponential backoff; only report the final error
        let lastError = ''
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const signRes = await fetch('/api/import/media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename, threadFolder: tFolder, contentType }),
            })
            if (!signRes.ok) {
              lastError = (await signRes.json().catch(() => ({}))).error ?? `sign failed (${signRes.status})`
              break  // server-side error — don't retry
            }
            const { url, key } = await signRes.json()
            const putRes = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } })
            if (putRes.ok) { uriMap.set(fbUri, key); uploaded++; return }
            lastError = `R2 upload failed (${putRes.status})`
          } catch (e) {
            lastError = String(e)
          }
          if (attempt < 2) await new Promise(r => setTimeout(r, 500 * 2 ** attempt))
        }
        mediaErrors.push(`${filename}: ${lastError}`)
        missing++
        return
      }
      missing++
    })()

    inFlight.set(fbUri, p)
    try { await p } finally { inFlight.delete(fbUri) }
  }

  const MEDIA_CONCURRENCY = 8
  const FILE_CONCURRENCY  = 4

  async function processFile({ sourceId, path, format: fileFormat }: FileRef, fileIdx: number) {
    const fs = openFSCache.get(sourceId)
    if (!fs) return

    // Load messages
    let msgs: unknown[] = []
    try {
      const data = JSON.parse(await fs.readText(path))
      msgs = data.messages ?? data
      if (!Array.isArray(msgs)) msgs = []
    } catch { return }

    // ── 1. Upload all media first ──────────────────────────────────────────
    const uris = extractMediaUris(msgs)
    for (let i = 0; i < uris.length; i += MEDIA_CONCURRENCY) {
      await Promise.all(uris.slice(i, i + MEDIA_CONCURRENCY).map(async uri => {
        const filename = uri.split('/').pop() ?? uri
        refreshProgress(`Uploading ${mediaTypeLabel(filename)}`, filename)
        await uploadUri(uri)
      }))
    }

    // ── 2. Rewrite URIs using only confirmed uploads, apply mojibake ───────
    const rewritten = msgs.map((m: any) => {
      const out = fileFormat === 'native' ? {
        ...m,
        content:     m.content     ? fixMojibake(m.content)     : m.content,
        sender_name: m.sender_name ? fixMojibake(m.sender_name) : m.sender_name,
        reactions:   Array.isArray(m.reactions)
          ? m.reactions.map((r: any) => ({ ...r, reaction: fixMojibake(r.reaction ?? '') }))
          : m.reactions,
      } : { ...m }
      const rewriteUri = (item: any) => { const k = uriMap.get(item.uri); return k ? { ...item, uri: k } : null }
      for (const field of ['photos', 'videos', 'gifs', 'audio_files', 'files']) {
        if (Array.isArray(out[field])) {
          const mapped = out[field].map(rewriteUri).filter(Boolean)
          if (mapped.length > 0) out[field] = mapped
          else delete out[field]
        }
      }
      if (out.sticker?.uri) {
        const k = uriMap.get(out.sticker.uri)
        if (k) out.sticker = { ...out.sticker, uri: k }
        else delete out.sticker
      }
      if (Array.isArray(out.media)) {
        out.media = out.media.map(rewriteUri).filter(Boolean)
      }
      return out
    })

    // ── 3. Insert messages — every URI is already confirmed in R2 ──────────
    refreshProgress(`Inserting messages (file ${fileIdx + 1} / ${totalFiles})`)
    const res = await fetch('/api/import/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: collectionName, messages: rewritten, skipBlockIds: true,
        threadName: threadName || selected!.title, participants: selected!.participants,
        facebookThreadId: selected!.facebookThreadId,
        initials: inferInitials(threadName || selected!.title), color: pickColor(collectionName),
      }),
    })
    if (res.ok) {
      const d = await res.json()
      inserted += d.inserted ?? 0
    } else {
      const d = await res.json().catch(() => ({}))
      onError?.((d as any).error ?? 'Message insert failed')
    }
  }

  // Sort oldest-first so concurrent batches don't fight over overlapping timestamp ranges.
  // FB exports message_1.json = newest, message_N.json = oldest, so sort descending by number.
  const sortedFiles = [...selected.messageFiles].sort((a, b) => {
    const na = parseInt(a.path.match(/message_(\d+)\.json$/i)?.[1] ?? '0')
    const nb = parseInt(b.path.match(/message_(\d+)\.json$/i)?.[1] ?? '0')
    return nb - na
  })

  // Run FILE_CONCURRENCY files at a time
  for (let i = 0; i < sortedFiles.length; i += FILE_CONCURRENCY) {
    await Promise.all(
      sortedFiles.slice(i, i + FILE_CONCURRENCY).map((f, j) => processFile(f, i + j))
    )
  }

  // ── 3. Finalize: recompute blockIds once + upsert thread ─────────────────
  onProgress({ label: 'Computing message groups', sublabel: '0', current: 0, total: 1, errors: [] })

  const finRes = await fetch('/api/import/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection: collectionName, threadName: threadName || selected.title,
      participants: selected.participants, facebookThreadId: selected.facebookThreadId,
      initials: inferInitials(threadName || selected.title), color: pickColor(collectionName),
    }),
  })

  if (!finRes.ok || !finRes.body) {
    throw new Error('Finalize failed')
  }

  let total = 0
  const reader  = finRes.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  outer: while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const ev = JSON.parse(line)
      if (ev.type === 'blockids') {
        onProgress({ label: 'Computing message groups', sublabel: `${ev.current.toLocaleString()} / ${ev.total.toLocaleString()}`, current: ev.current, total: ev.total, errors: [] })
      } else if (ev.type === 'done') {
        total = ev.total
      } else if (ev.type === 'error') {
        onError?.(ev.error ?? 'Finalize failed'); break outer
      }
    }
  }

  return { inserted, mediaUploaded: uploaded, mediaMissing: missing }
}
