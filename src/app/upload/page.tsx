'use client'
import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { FoundThread, ImportProgress, StoredSource } from '@/lib/import/types'
import { inferInitials, pickColor } from '@/lib/import/utils'
import { openSource, readDirEntry } from '@/lib/import/virtualFs'
import { mergeThreads, parseSource } from '@/lib/import/parseExport'
import { runImport } from '@/lib/import/runImport'

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

    try {
      const result = await runImport({
        selected,
        threadName,
        sources: sourcesRef.current,
        onProgress: setProgress,
        onError: setError,
      })
      setProgress(null)
      setDone(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
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
