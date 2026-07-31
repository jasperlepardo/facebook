'use client'
import { useState } from 'react'
import { MediaTab, LightboxState, GalleryItem } from '@/types'
import Gallery from './Gallery'
import FilesView from './FilesView'
import LinksView from './LinksView'
import CallsView from './CallsView'
import Tabs from './Tabs'

interface Props {
  initialTab?: MediaTab
  counts?: Record<MediaTab, number>
  onLightbox: (s: LightboxState) => void
  onContextMenu: (e: React.MouseEvent, item: GalleryItem) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  thread?: string
  threadName?: string
  threadCollection?: string
  participants?: string[]
  onThreadDeleted?: (collection: string) => void
  onClose?: () => void
}

const MEDIA_TABS: { key: MediaTab; label: string }[] = [
  { key: 'photos',   label: 'Photos' },
  { key: 'videos',   label: 'Videos' },
  { key: 'gifs',     label: 'GIFs' },
  { key: 'stickers', label: 'Stickers' },
  { key: 'audio',    label: 'Audio' },
  { key: 'files',    label: 'Files' },
  { key: 'links',    label: 'Links' },
  { key: 'calls',    label: 'Calls' },
]

export default function MediaPane({
  initialTab, counts, thread = 'messages', threadName, threadCollection, participants,
  onLightbox, onContextMenu, hideImages, hiddenUris, isSuperAdmin,
  onHideUri, onUnhideUri, onThreadDeleted, onClose,
}: Props) {
  const [tab,         setTab]         = useState<MediaTab>(initialTab ?? 'photos')
  const [mode,        setMode]        = useState<'media' | 'settings'>('media')
  const [confirming,   setConfirming]   = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)
  const [migrating,    setMigrating]    = useState(false)
  const [migrateResult, setMigrateResult] = useState<{ copied: number; deleted: number; skipped: number } | null>(null)
  const [migrateError, setMigrateError] = useState<string | null>(null)

  const tabsWithCounts = MEDIA_TABS.map(t => {
    const n = counts?.[t.key]
    return n != null && n > 0 ? { ...t, label: `${t.label} (${n.toLocaleString()})` } : t
  })

  const canDelete = !!threadCollection && threadCollection !== 'messages' && !!onThreadDeleted

  async function handleMigrate() {
    if (!threadCollection) return
    setMigrating(true); setMigrateError(null); setMigrateResult(null)
    try {
      const res = await fetch('/api/import/migrate-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: threadCollection }),
      })
      const d = await res.json()
      if (!res.ok) { setMigrateError(d.error ?? 'Migration failed'); return }
      setMigrateResult(d)
    } catch (e) {
      setMigrateError(String(e))
    } finally {
      setMigrating(false)
    }
  }

  async function handleDelete() {
    if (!threadCollection || !onThreadDeleted) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/import/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: threadCollection }),
      })
      const d = await res.json()
      if (!res.ok) {
        setDeleteError(d.error ?? 'Delete failed')
        return
      }
      if (d.r2Deleted === 0 && d.r2Failed === 0) {
        console.warn('Delete: no R2 objects were removed — check prefix or token permissions')
      }
      onThreadDeleted(threadCollection)
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 flex items-center justify-between shrink-0 bg-white dark:bg-mist-900">
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {mode === 'settings' ? 'Thread Settings' : 'Media'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setMode(m => m === 'settings' ? 'media' : 'settings'); setConfirming(false); setDeleteError(null) }}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${mode === 'settings' ? 'bg-mist-100 dark:bg-mist-800 text-gray-900 dark:text-white' : 'hover:bg-mist-100 dark:hover:bg-mist-800 text-gray-500 dark:text-mist-400'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-mist-100 dark:hover:bg-mist-800 text-gray-500 dark:text-mist-400 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {mode === 'settings' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* Thread info */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-mist-400 dark:text-mist-500 uppercase tracking-wide">Thread</p>
            <div className="bg-mist-50 dark:bg-mist-800 rounded-xl p-4 space-y-2">
              {threadName && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-mist-500 dark:text-mist-400 shrink-0">Name</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white text-right truncate">{threadName}</span>
                </div>
              )}
              {threadCollection && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-mist-500 dark:text-mist-400 shrink-0">Collection</span>
                  <code className="text-xs text-gray-700 dark:text-mist-300 bg-mist-100 dark:bg-mist-700 px-1.5 py-0.5 rounded truncate">{threadCollection}</code>
                </div>
              )}
              {participants && participants.length > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-mist-500 dark:text-mist-400 shrink-0 pt-0.5">Participants</span>
                  <span className="text-xs text-gray-700 dark:text-mist-300 text-right">{participants.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Migrate media */}
          {threadCollection && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-mist-400 dark:text-mist-500 uppercase tracking-wide">Media Storage</p>
              <div className="bg-mist-50 dark:bg-mist-800 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Migrate to new folder structure</p>
                  <p className="text-xs text-mist-500 dark:text-mist-400 mt-0.5">
                    Moves R2 objects from <code className="bg-mist-100 dark:bg-mist-700 px-1 rounded">media/&lt;type&gt;/</code> to <code className="bg-mist-100 dark:bg-mist-700 px-1 rounded">media/{threadCollection}/&lt;type&gt;/</code> and updates all URIs.
                  </p>
                </div>
                {migrateResult && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 space-y-0.5">
                    <div>Copied: {migrateResult.copied} · Deleted: {migrateResult.deleted}{migrateResult.skipped > 0 ? ` · Skipped (no token): ${migrateResult.skipped}` : ''}</div>
                  </div>
                )}
                {migrateError && <p className="text-xs text-red-600 dark:text-red-400">{migrateError}</p>}
                <button
                  onClick={handleMigrate}
                  disabled={migrating}
                  className="w-full py-2 bg-mist-100 dark:bg-mist-700 text-gray-700 dark:text-mist-200 text-sm font-medium rounded-lg hover:bg-mist-200 dark:hover:bg-mist-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {migrating && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  {migrating ? 'Migrating…' : 'Run migration'}
                </button>
              </div>
            </div>
          )}

          {/* Danger zone */}
          {canDelete && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Danger Zone</p>
              <div className="border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
                {!confirming ? (
                  <>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Delete thread</p>
                      <p className="text-xs text-mist-500 dark:text-mist-400 mt-0.5">Permanently removes all messages, media, and this thread entry.</p>
                    </div>
                    <button
                      onClick={() => setConfirming(true)}
                      className="w-full py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      Delete thread…
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">Are you sure?</p>
                    <p className="text-xs text-mist-500 dark:text-mist-400">
                      This will delete <span className="font-semibold text-gray-700 dark:text-mist-200">{threadName ?? threadCollection}</span> — all messages, media files, and this thread. This cannot be undone.
                    </p>
                    {deleteError && (
                      <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirming(false); setDeleteError(null) }}
                        disabled={deleting}
                        className="flex-1 py-2 bg-mist-100 dark:bg-mist-700 text-gray-700 dark:text-mist-200 text-sm font-medium rounded-lg hover:bg-mist-200 dark:hover:bg-mist-600 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {deleting ? 'Deleting…' : 'Delete permanently'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      ) : (
        <>
          <Tabs tabs={tabsWithCounts} active={tab} onChange={k => setTab(k)} scrollable />
          {tab === 'photos'   && <Gallery type="photos"   thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={onHideUri} onUnhideUri={onUnhideUri} />}
          {tab === 'videos'   && <Gallery type="videos"   thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={onHideUri} onUnhideUri={onUnhideUri} />}
          {tab === 'gifs'     && <Gallery type="gifs"     thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={onHideUri} onUnhideUri={onUnhideUri} />}
          {tab === 'stickers' && <Gallery type="stickers" thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={onHideUri} onUnhideUri={onUnhideUri} />}
          {tab === 'audio'    && <FilesView type="audio" thread={thread} />}
          {tab === 'files'    && <FilesView type="files" thread={thread} />}
          {tab === 'links'    && <LinksView thread={thread} />}
          {tab === 'calls'    && <CallsView thread={thread} />}
        </>
      )}
    </div>
  )
}
