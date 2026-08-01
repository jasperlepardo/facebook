'use client'
import { useEffect, useState } from 'react'
import AppHeader from './AppHeader'
import { LockIcon, GlobeIcon } from '@/components/icons'
import { fieldQuiet, pbSafe } from '@/lib/ui'
import type { Hashtag } from '@/types'

type Page = 'hub' | 'info'

interface Props {
  hashtag: Hashtag
  activeTab: 'context' | 'messages'
  isSuperAdmin?: boolean
  onRenamed: (name: string) => void
  onPrivacyChanged: () => void
  onDeleted: () => void
}

function RowChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function headerTitle(label: string) {
  return <span className="text-sm font-bold truncate">{label}</span>
}

const rowBtn = 'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm text-gray-900 dark:text-white hover:bg-mist-100/80 dark:hover:bg-mist-700/50 transition-colors'

export default function HashtagDetailsPane({
  hashtag, activeTab, isSuperAdmin, onRenamed, onPrivacyChanged, onDeleted,
}: Props) {
  const [page, setPage] = useState<Page>('hub')
  const [nameInput, setNameInput] = useState(hashtag.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setNameInput(hashtag.name)
    setPage('hub')
    setError(null)
    setSaved(false)
    setConfirming(false)
    setDeleteError(null)
    setCopied(false)
  }, [hashtag.id])

  async function saveName() {
    const name = nameInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!name || name === hashtag.name) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/hashtags/${hashtag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to rename')
      }
      onRenamed(name)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename')
    } finally {
      setSaving(false)
    }
  }

  async function togglePrivacy() {
    if (!isSuperAdmin) return
    await fetch(`/api/hashtags/${hashtag.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPrivate: !hashtag.isPrivate }),
    })
    onPrivacyChanged()
  }

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?s=hashtags&h=${hashtag.id}&tab=${activeTab}`
    void navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/hashtags/${hashtag.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      onDeleted()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  if (page === 'info') {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-mist-50 dark:bg-mist-900">
        <AppHeader title={headerTitle('Hashtag info')} onBack={() => setPage('hub')} embedded />
        <div className={`flex-1 overflow-y-auto ${pbSafe} md:pb-6`}>
          <div className="px-4 py-5 space-y-6">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-mist-400 dark:text-mist-500 mb-2 px-1">Name</p>
              <div className="bg-white dark:bg-mist-800 rounded-xl p-4 space-y-3">
                <input
                  value={nameInput}
                  onChange={e => {
                    setNameInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                    setSaved(false)
                  }}
                  className={fieldQuiet}
                  autoComplete="off"
                  aria-label="Hashtag name"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={saving || !nameInput.trim() || nameInput.trim() === hashtag.name}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-40"
                >
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                </button>
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
            </section>

            {isSuperAdmin && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-mist-400 dark:text-mist-500 mb-2 px-1">Privacy</p>
                <div className="bg-white dark:bg-mist-800 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => void togglePrivacy()} className={rowBtn}>
                    <span className="inline-flex items-center gap-2">
                      {hashtag.isPrivate ? <LockIcon size={14} /> : <GlobeIcon size={14} />}
                      {hashtag.isPrivate ? 'Private' : 'Public'}
                    </span>
                    <span className="text-xs text-mist-500 dark:text-mist-400">
                      {hashtag.isPrivate ? 'Make public' : 'Make private'}
                    </span>
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-mist-900">
      <AppHeader title={headerTitle('Settings')} embedded />
      <div className={`flex-1 overflow-y-auto ${pbSafe} md:pb-4`}>
        <div className="mx-3 md:mx-4 mt-4 rounded-2xl bg-mist-50 dark:bg-mist-800/80 overflow-hidden divide-y divide-mist-100 dark:divide-mist-700/80">
          <button type="button" onClick={() => setPage('info')} className={rowBtn}>
            <span>Hashtag info</span>
            <RowChevron />
          </button>
          <button type="button" onClick={copyLink} className={rowBtn}>
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
            <RowChevron />
          </button>
        </div>

        <div className="mx-3 md:mx-4 mt-4 rounded-2xl bg-mist-50 dark:bg-mist-800/80 overflow-hidden">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${rowBtn} text-red-600 dark:text-red-400`}
            >
              Delete hashtag
            </button>
          ) : (
            <div className="px-4 py-3.5 space-y-3">
              <p className="text-sm text-gray-700 dark:text-mist-200">Delete #{hashtag.name}? This can’t be undone.</p>
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setConfirming(false); setDeleteError(null) }}
                  className="text-sm font-medium text-mist-600 dark:text-mist-300 px-3 py-1.5"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
