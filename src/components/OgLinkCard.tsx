'use client'
import { useEffect, useState } from 'react'
import type { OgMeta } from '@/app/api/og-meta/route'
import { card, pill, pillIcon, pillLabel, pillSub, iconWell } from '@/components/message/MessageStyles'

const FILE_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', 'ai', 'indd', 'xd', 'ics']
const PREVIEWABLE = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

function getExt(url: string) {
  try {
    const path = new URL(url).pathname
    return (path.split('.').pop() ?? '').toLowerCase().split('?')[0]
  } catch { return '' }
}

function FilePill({ url }: { url: string }) {
  const name = decodeURIComponent(url.split('/').pop() ?? url).split('?')[0]
  const ext = getExt(url)
  const extLabel = ext.toUpperCase() || 'FILE'
  const previewable = PREVIEWABLE.includes(ext)

  const fileIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6"/><path d="M9 17h4"/>
    </svg>
  )

  return (
    <a href={url} target="_blank" rel="noopener"
      className={`mt-1 w-full max-w-[280px] hover:opacity-80 transition-opacity ${pill}`}
      style={{ textDecoration: 'none' }}
    >
      <span className={iconWell}>{fileIcon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${pillLabel}`}>{name}</span>
        <span className={pillSub}>{extLabel}</span>
      </span>
      {previewable
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pillIcon}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pillIcon}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      }
    </a>
  )
}

function OgPreview({ url }: { url: string }) {
  const [meta, setMeta] = useState<OgMeta | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/og-meta?url=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) { setMeta(data); setDone(true) } })
      .catch(() => { if (!cancelled) setDone(true) })
    return () => { cancelled = true }
  }, [url])

  if (!done) return (
    <div className={`mt-1.5 w-full max-w-[280px] animate-pulse ${card}`}>
      <div className="px-3 py-2.5 space-y-2">
        <div className="h-2 bg-mist-100 dark:bg-mist-700 rounded w-1/4" />
        <div className="h-3 bg-mist-100 dark:bg-mist-700 rounded w-3/4" />
        <div className="h-2 bg-mist-100 dark:bg-mist-700 rounded w-1/2" />
      </div>
    </div>
  )

  if (!meta) return null

  const host = meta.host || (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } })()

  return (
    <a href={url} target="_blank" rel="noopener"
      className={`mt-1.5 flex flex-col w-full max-w-[min(300px,100%)] overflow-hidden hover:opacity-80 transition-opacity ${card}`}
      style={{ textDecoration: 'none' }}
    >
      {meta.image && (
        <div className="w-full overflow-hidden rounded-t-xl bg-mist-100 dark:bg-mist-800" style={{ aspectRatio: '1.91' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.image} alt="" className="w-full h-full object-cover"
            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }} />
        </div>
      )}
      <div className={`px-3 pb-2.5 ${meta.image ? 'pt-2' : 'pt-2.5'}`}>
        <div className="flex items-center gap-1.5 mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" className="w-4 h-4 rounded-sm shrink-0"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          <span className="text-[10px] font-medium text-mist-400 dark:text-mist-500 uppercase tracking-wide truncate">{host}</span>
        </div>
        {meta.title && (
          <p className="text-[12px] font-semibold text-gray-800 dark:text-mist-100 line-clamp-2 leading-snug mb-1">{meta.title}</p>
        )}
        {meta.description && (
          <p className="text-[11px] text-mist-400 dark:text-mist-500 line-clamp-2 leading-snug mb-1">{meta.description}</p>
        )}
        <p className="text-[11px] text-mist-400 dark:text-mist-500 truncate">{url.replace(/^https?:\/\//, '')}</p>
      </div>
    </a>
  )
}

export default function OgLinkCard({ url }: { url: string }) {
  const ext = getExt(url)
  if (FILE_EXTS.includes(ext)) return <FilePill url={url} />
  return <OgPreview url={url} />
}
