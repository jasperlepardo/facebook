'use client'
import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { fixMojibake } from '@/lib/mojibake'
import type { FileRef, FoundThread, ImportProgress, StoredSource, VirtualFS } from '@/lib/import/types'
import { guessMime, inferInitials, mediaTypeLabel, pickColor } from '@/lib/import/utils'
import { openSource, readDirEntry } from '@/lib/import/virtualFs'
import { buildUriIndex, extractMediaUris, mergeThreads, parseSource } from '@/lib/import/parseExport'

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [dragging,   setDragging]   = useState(false)
  const [parsing,    setParsing]    = useState(false)
  const [parseLabel, setParseLabel] = useState('')
  const [threads,    setThreads]    = useState<FoundThread[]>([])
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<FoundThread | null>(null)
  const [threadName, setThreadName] = useState('')
  const [progress,   setProgress]   = useState<ImportProgress | null>(null)
  const [done,       setDone]       = useState<{ inserted: number; mediaUploaded: number; mediaMissing: number } | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const sourcesRef  = useRef<Map<string, StoredSource>>(new Map())
  const zipInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  const handleSources = useCallback(async (incoming: { id: string; source: StoredSource }[]) => {
    const fresh = incoming.filter(({ id }) => !sourcesRef.current.has(id))
    if (!fresh.length) { setError('All selected sources are already loaded'); return }

    setError(null); setDone(null)
    setParsing(true)

    try {
      const newThreads: FoundThread[] = []

      for (let i = 0; i < fresh.length; i++) {
        const { id, source } = fresh[i]
        setParseLabel(`Scanning ${id} (${i + 1}/${fresh.length})…`)
        const fs = await openSource(source)
        if (!fs) { setError(`Could not read ${id}`); return }
        const found = await parseSource(fs, id)
        sourcesRef.current.set(id, source)
        newThreads.push(...found)
      }

      setThreads(prev => mergeThreads([...prev, ...newThreads]))
    } catch (e) {
      setError(String(e))
    } finally {
      setParsing(false)
      setParseLabel('')
    }
  }, [])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const incoming: { id: string; source: StoredSource }[] = []

    for (const item of Array.from(e.dataTransfer.items)) {
      const entry = item.webkitGetAsEntry?.()
      if (!entry) continue

      if (entry.isDirectory) {
        setParsing(true)

        // Shallow-scan the dropped folder first to get its immediate children
        const topReader = (entry as FileSystemDirectoryEntry).createReader()
        const topEntries: FileSystemEntry[] = []
        let topBatch: FileSystemEntry[]
        do {
          topBatch = await new Promise((res, rej) => topReader.readEntries(res as any, rej))
          topEntries.push(...topBatch)
        } while (topBatch.length > 0)

        const subDirs  = topEntries.filter(e => e.isDirectory) as FileSystemDirectoryEntry[]
        const topFiles = topEntries.filter(e => !e.isDirectory) as FileSystemFileEntry[]

        const entryMap = new Map<string, FileSystemFileEntry>()
        for (const f of topFiles) entryMap.set(f.name, f)

        if (subDirs.length > 3) {
          // Many sub-folders — scan each one separately so the browser
          // doesn't hit its per-session FileSystem enumeration limit
          for (let i = 0; i < subDirs.length; i++) {
            setParseLabel(`Scanning ${subDirs[i].name} (${i + 1} / ${subDirs.length})…`)
            await readDirEntry(subDirs[i], subDirs[i].name + '/', entryMap)
          }
        } else {
          // Small folder — single recursive scan
          setParseLabel(`Scanning ${entry.name}…`)
          for (const dir of subDirs) {
            await readDirEntry(dir, dir.name + '/', entryMap)
          }
        }

        incoming.push({
          id: entry.name,
          source: {
            kind: 'folder',
            paths: [...entryMap.keys()],
            resolve: p => new Promise((res, rej) => entryMap.get(p)!.file(res, rej)),
          },
        })
      } else if (entry.name.endsWith('.zip')) {
        const file = item.getAsFile()
        if (!file) continue
        const buf = await file.arrayBuffer()
        incoming.push({ id: file.name, source: { kind: 'zip', buf } })
      }
    }

    if (!incoming.length) { setError('Drop a folder or .zip file'); setParsing(false); return }
    await handleSources(incoming)
  }, [handleSources])

  const onZipInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const incoming = await Promise.all(
      files.filter(f => f.name.endsWith('.zip')).map(async f => ({
        id: f.name,
        source: { kind: 'zip' as const, buf: await f.arrayBuffer() },
      }))
    )
    if (incoming.length) await handleSources(incoming)
  }, [handleSources])

  const onDirInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return

    const fileMap = new Map<string, File>()
    for (const f of files) {
      fileMap.set((f as any).webkitRelativePath || f.name, f)
    }
    const id = files[0] ? ((files[0] as any).webkitRelativePath as string).split('/')[0] : 'folder'
    await handleSources([{
      id,
      source: {
        kind: 'folder',
        paths: [...fileMap.keys()],
        resolve: p => Promise.resolve(fileMap.get(p)!),
      },
    }])
  }, [handleSources])

  const onSelect = (t: FoundThread) => {
    setSelected(t); setThreadName(t.title); setDone(null); setProgress(null)
  }

  const handleImport = async () => {
    if (!selected) return
    setError(null); setDone(null)

    const collectionName = selected.key
    const tFolder        = collectionName

    // ── 1. Open all sources and build URI indexes ────────────────────────────
    setProgress({ label: 'Preparing sources', current: 0, total: 0, errors: [] })

    const openFSCache   = new Map<string, VirtualFS>()
    const uriIndexCache = new Map<string, Map<string, string>>()

    const allSourceIds = new Set([
      ...selected.messageFiles.map(f => f.sourceId),
      ...selected.mediaBasePaths.map(f => f.sourceId),
    ])
    for (const sourceId of allSourceIds) {
      const src = sourcesRef.current.get(sourceId)
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
      setProgress({
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
        setError((d as any).error ?? 'Message insert failed')
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
    setProgress({ label: 'Computing message groups', sublabel: '0', current: 0, total: 1, errors: [] })

    const finRes = await fetch('/api/import/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: collectionName, threadName: threadName || selected.title,
        participants: selected.participants, facebookThreadId: selected.facebookThreadId,
        initials: inferInitials(threadName || selected.title), color: pickColor(collectionName),
      }),
    })

    if (!finRes.ok || !finRes.body) { setError('Finalize failed'); return }

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
          setProgress({ label: 'Computing message groups', sublabel: `${ev.current.toLocaleString()} / ${ev.total.toLocaleString()}`, current: ev.current, total: ev.total, errors: [] })
        } else if (ev.type === 'done') {
          total = ev.total
        } else if (ev.type === 'error') {
          setError(ev.error ?? 'Finalize failed'); break outer
        }
      }
    }

    setProgress(null)
    setDone({ inserted, mediaUploaded: uploaded, mediaMissing: missing })
  }

  const reset = () => {
    setThreads([]); setSelected(null); setDone(null); setProgress(null)
    sourcesRef.current.clear()
  }

  const filtered = search
    ? threads.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : threads

  return (
    <div className="min-h-screen bg-mist-50 dark:bg-mist-950 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Thread</h1>
          <p className="text-sm text-mist-500 dark:text-mist-400 mt-1">
            Drop your Facebook export folder or .zip — threads with the same participants are merged automatically.
          </p>
        </div>

        {/* Hidden inputs */}
        <input ref={zipInputRef} type="file" accept=".zip" multiple className="hidden" onChange={onZipInput} />
        <input ref={dirInputRef} type="file" className="hidden" onChange={onDirInput}
          {...{ webkitdirectory: '', directory: '' } as any} />

        {/* Full drop zone — when no threads yet */}
        {!threads.length && !parsing && (
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-colors
              ${dragging
                ? 'border-mist-500 bg-mist-100 dark:bg-mist-800'
                : 'border-mist-300 dark:border-mist-700'
              }`}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-sm font-medium text-mist-600 dark:text-mist-300">Drop your export folder or .zip here</p>
            <div className="flex gap-3">
              <button
                onClick={() => dirInputRef.current?.click()}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Select folder
              </button>
              <button
                onClick={() => zipInputRef.current?.click()}
                className="px-4 py-2 bg-mist-100 dark:bg-mist-800 text-gray-700 dark:text-mist-200 text-sm font-medium rounded-lg hover:bg-mist-200 dark:hover:bg-mist-700 transition-colors"
              >
                Select .zip
              </button>
            </div>
          </div>
        )}

        {/* Compact drop zone — when threads already listed */}
        {threads.length > 0 && !parsing && !progress && !done && (
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className={`border border-dashed rounded-xl px-4 py-3 flex items-center gap-3 transition-colors
              ${dragging
                ? 'border-mist-500 bg-mist-100 dark:bg-mist-800'
                : 'border-mist-300 dark:border-mist-700'
              }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400 shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="text-sm text-mist-500 dark:text-mist-400 flex-1">Drop more sources to merge</span>
            <button onClick={() => dirInputRef.current?.click()} className="text-xs text-mist-400 hover:text-mist-600 dark:hover:text-mist-200">folder</button>
            <span className="text-mist-300 dark:text-mist-600 text-xs">·</span>
            <button onClick={() => zipInputRef.current?.click()} className="text-xs text-mist-400 hover:text-mist-600 dark:hover:text-mist-200">.zip</button>
          </div>
        )}

        {parsing && (
          <div className="flex items-center gap-3 p-6 bg-white dark:bg-mist-900 rounded-2xl border border-mist-200 dark:border-mist-700">
            <div className="w-5 h-5 border-2 border-mist-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-mist-600 dark:text-mist-300">{parseLabel || 'Scanning…'}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Thread list */}
        {threads.length > 0 && !progress && !done && (
          <div className="bg-white dark:bg-mist-900 rounded-2xl border border-mist-200 dark:border-mist-700 overflow-hidden">
            <div className="p-4 border-b border-mist-100 dark:border-mist-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-mist-500 dark:text-mist-400">
                  {threads.length} conversation{threads.length !== 1 ? 's' : ''}
                  {' · '}
                  {sourcesRef.current.size} source{sourcesRef.current.size !== 1 ? 's' : ''}
                </p>
                <button onClick={reset} className="text-xs text-mist-400 hover:text-mist-600 dark:hover:text-mist-200">
                  Clear
                </button>
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full px-3 py-2 bg-mist-50 dark:bg-mist-800 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-mist-400 outline-hidden border border-mist-200 dark:border-mist-700"
              />
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-mist-100 dark:divide-mist-800">
              {filtered.map(t => (
                <button
                  key={t.key}
                  onClick={() => onSelect(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                    ${selected?.key === t.key
                      ? 'bg-mist-100 dark:bg-mist-800'
                      : 'hover:bg-mist-50 dark:hover:bg-mist-800'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${pickColor(t.key)}`}>
                    {inferInitials(t.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t.title}</span>
                      <span className="text-xs text-mist-400 shrink-0">~{t.messageCount.toLocaleString()} msgs</span>
                    </div>
                    <div className="text-xs text-mist-400 truncate">{t.participants.join(', ')}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${t.format === 'native' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                    {t.format === 'native' ? 'FB export' : 'scraped'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Config */}
        {selected && !progress && !done && (
          <div className="bg-white dark:bg-mist-900 rounded-2xl border border-mist-200 dark:border-mist-700 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Configure import</h2>

            <div className="space-y-1">
              <label className="text-xs text-mist-500 dark:text-mist-400">Display name</label>
              <input
                value={threadName}
                onChange={e => setThreadName(e.target.value)}
                className="w-full px-3 py-2 bg-mist-50 dark:bg-mist-800 rounded-lg text-sm text-gray-900 dark:text-white outline-hidden border border-mist-200 dark:border-mist-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-mist-500 dark:text-mist-400">
              <div><span className="font-medium text-gray-700 dark:text-mist-200">Collection:</span> <code className="bg-mist-100 dark:bg-mist-800 px-1 rounded">{selected.key}</code></div>
              <div><span className="font-medium text-gray-700 dark:text-mist-200">Format:</span> {selected.format}</div>
              <div><span className="font-medium text-gray-700 dark:text-mist-200">Messages:</span> ~{selected.messageCount.toLocaleString()}</div>
              <div><span className="font-medium text-gray-700 dark:text-mist-200">Message files:</span> {selected.messageFiles.length}</div>
              <div className={selected.mediaFileCount === 0 ? 'text-amber-500 dark:text-amber-400' : ''}>
                <span className="font-medium text-gray-700 dark:text-mist-200">Media files:</span>{' '}
                {selected.mediaFileCount === 0 ? 'none found in source' : selected.mediaFileCount.toLocaleString()}
              </div>
            </div>

            <button
              onClick={handleImport}
              className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Import Thread
            </button>
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="bg-white dark:bg-mist-900 rounded-2xl border border-mist-200 dark:border-mist-700 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 border-2 border-mist-400 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{progress.label}</p>
                {progress.sublabel && (
                  <p className="text-xs text-mist-500 dark:text-mist-400 truncate mt-0.5">{progress.sublabel}</p>
                )}
              </div>
            </div>
            {progress.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-mist-500">
                  <span>{progress.current.toLocaleString()}</span>
                  <span>{progress.total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-mist-100 dark:bg-mist-800 rounded-full h-1.5">
                  <div
                    className="bg-gray-900 dark:bg-white h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {progress.errors.length > 0 && (
              <div className="text-xs text-red-500 space-y-0.5">
                {progress.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="bg-white dark:bg-mist-900 rounded-2xl border border-mist-200 dark:border-mist-700 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Import complete</p>
                <p className="text-xs text-mist-500 dark:text-mist-400">{threadName}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Messages',       value: done.inserted.toLocaleString() },
                { label: 'Media uploaded', value: done.mediaUploaded.toLocaleString() },
                { label: done.mediaMissing > 0 ? 'Missing (re-import to recover)' : 'Media missing', value: done.mediaMissing.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="bg-mist-50 dark:bg-mist-800 rounded-xl p-3">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
                  <div className="text-xs text-mist-500 dark:text-mist-400">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Link href="/" className="flex-1 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl text-center hover:opacity-90 transition-opacity">
                View App
              </Link>
              <button
                onClick={reset}
                className="flex-1 py-2.5 bg-mist-100 dark:bg-mist-800 text-gray-700 dark:text-mist-200 text-sm font-semibold rounded-xl hover:bg-mist-200 dark:hover:bg-mist-700 transition-colors"
              >
                Import Another
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
