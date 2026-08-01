'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ContentTypeKey } from '@/lib/contentTypes'
import { fieldQuiet, pbSafe, sectionCard } from '@/lib/ui'
import type { ThreadParticipant } from '@/types'
import AppHeader from './AppHeader'
import ThreadAvatar from './ThreadAvatar'
import AvatarGroup from './AvatarGroup'
import ChatViewSettingsList from './ChatViewSettingsList'
import { participantAvatars } from '@/lib/threadDisplay'
import { PARTICIPANT_COLOR_OPTIONS } from '@/lib/participantColors'

type Page = 'hub' | 'chatInfo'

const MEMBER_COLORS = PARTICIPANT_COLOR_OPTIONS

export interface ThreadInfoUpdate {
  name?: string
  participants?: ThreadParticipant[]
}

interface Props {
  threadName: string
  threadCollection?: string
  participants?: ThreadParticipant[]
  enabledTypes: Set<ContentTypeKey>
  onContentTypeChange: (key: ContentTypeKey, enabled: boolean) => void
  onResetContentTypes: () => void
  hideImages: boolean
  onHideImagesChange: (v: boolean) => void
  isSuperAdmin?: boolean
  showHidden?: boolean
  onToggleShowHidden?: () => void
  onOpenMedia: () => void
  onThreadDeleted?: (collection: string) => void
  onThreadUpdated?: (collection: string, patch: ThreadInfoUpdate) => void
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-mist-400 dark:text-mist-500 mb-2 px-1">
      {children}
    </p>
  )
}

export default function ThreadDetailsPane({
  threadName, threadCollection, participants,
  enabledTypes, onContentTypeChange, onResetContentTypes,
  hideImages, onHideImagesChange,
  isSuperAdmin, showHidden, onToggleShowHidden,
  onOpenMedia, onThreadDeleted, onThreadUpdated,
}: Props) {
  const [page, setPage] = useState<Page>('hub')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [nameInput, setNameInput] = useState(threadName)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [infoSaved, setInfoSaved] = useState(false)

  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [memberInitials, setMemberInitials] = useState('')
  const [memberColor, setMemberColor] = useState('bg-violet-400')
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)

  useEffect(() => {
    setNameInput(threadName)
    setInfoError(null)
    setInfoSaved(false)
    setPage('hub')
    setConfirming(false)
    setDeleteError(null)
    setEditingMember(null)
    setMemberError(null)
  }, [threadName, threadCollection])

  const canDelete = !!threadCollection && threadCollection !== 'messages' && !!onThreadDeleted
  const infoDirty = nameInput.trim() !== threadName
  const memberList = (participants ?? []).map((p): ThreadParticipant => ({
    id: p.id,
    name: p.name,
    initials: p.initials || (p.name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?'),
    color: p.color || 'bg-violet-400',
  }))

  async function handleSaveInfo() {
    if (!threadCollection || !isSuperAdmin || !onThreadUpdated) return
    const name = nameInput.trim()
    if (!name) { setInfoError('Name is required'); return }
    setInfoSaving(true)
    setInfoError(null)
    setInfoSaved(false)
    try {
      const res = await fetch('/api/threads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: threadCollection, name }),
      })
      const d = await res.json()
      if (!res.ok) { setInfoError(d.error ?? 'Failed to save'); return }
      onThreadUpdated(threadCollection, { name: d.thread.name })
      setInfoSaved(true)
      setTimeout(() => setInfoSaved(false), 1500)
    } catch (e) {
      setInfoError(String(e))
    } finally {
      setInfoSaving(false)
    }
  }

  function startEditMember(p: ThreadParticipant) {
    if (!isSuperAdmin) return
    setEditingMember(p.name)
    setMemberInitials(p.initials)
    setMemberColor(p.color)
    setMemberError(null)
  }

  async function handleSaveMember() {
    if (!threadCollection || !isSuperAdmin || !onThreadUpdated || !editingMember) return
    setMemberSaving(true)
    setMemberError(null)
    try {
      const member = memberList.find(p => p.name === editingMember)
      const res = await fetch('/api/threads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: threadCollection,
          participantId: member?.id,
          participantName: editingMember,
          initials: memberInitials.trim().slice(0, 2).toUpperCase(),
          color: memberColor,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setMemberError(d.error ?? 'Failed to save'); return }
      onThreadUpdated(threadCollection, { participants: d.thread.participants })
      setEditingMember(null)
    } catch (e) {
      setMemberError(String(e))
    } finally {
      setMemberSaving(false)
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
      onThreadDeleted(threadCollection)
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  const rowBtn =
    'w-full flex items-center justify-between px-4 py-3.5 text-left text-[15px] font-medium text-gray-900 dark:text-white hover:bg-mist-50 dark:hover:bg-mist-800/60 transition-colors'

  const goHub = () => {
    setPage('hub')
    setConfirming(false)
    setDeleteError(null)
    setEditingMember(null)
  }

  if (page === 'chatInfo') {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-mist-50 dark:bg-mist-900">
        <AppHeader title={headerTitle('Chat info')} onBack={goHub} embedded />
        <div className={`flex-1 overflow-y-auto ${pbSafe} md:pb-6`}>
          <div className="px-4 py-5 space-y-6">

            {/* Thread */}
            <section>
              <SectionLabel>Thread</SectionLabel>
              <div className="bg-white dark:bg-mist-800 rounded-xl p-4 space-y-4">
                {isSuperAdmin ? (
                  <>
                    <div>
                      <label htmlFor="thread-name" className="block text-xs text-mist-500 dark:text-mist-400 mb-1">Name</label>
                      <input
                        id="thread-name"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        className={fieldQuiet}
                        autoComplete="off"
                      />
                    </div>
                    {infoError && <p className="text-xs text-red-600 dark:text-red-400">{infoError}</p>}
                    <button
                      type="button"
                      onClick={handleSaveInfo}
                      disabled={!infoDirty || infoSaving}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      {infoSaving ? 'Saving…' : infoSaved ? 'Saved' : 'Save'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{threadName}</p>
                )}

                {threadCollection && (
                  <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-mist-100 dark:border-mist-700">
                    <span className="text-xs text-mist-500 dark:text-mist-400 shrink-0">Collection</span>
                    <code className="text-xs text-gray-700 dark:text-mist-300 bg-mist-100 dark:bg-mist-700 px-1.5 py-0.5 rounded truncate">{threadCollection}</code>
                  </div>
                )}
              </div>
            </section>

            {/* Members */}
            <section>
              <SectionLabel>Members</SectionLabel>
              <div className={`${sectionCard} divide-y divide-mist-100 dark:divide-mist-700/80`}>
                {memberList.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-mist-400 dark:text-mist-500 text-center">No members listed.</p>
                ) : (
                  memberList.map(p => {
                    const editing = editingMember === p.name
                    return (
                      <div key={p.name} className="px-4 py-3">
                        {editing ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <ThreadAvatar color={memberColor} initials={memberInitials || '?'} />
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</span>
                            </div>
                            <div>
                              <label className="block text-xs text-mist-500 dark:text-mist-400 mb-1">Initials</label>
                              <input
                                value={memberInitials}
                                onChange={e => setMemberInitials(e.target.value.slice(0, 2))}
                                maxLength={2}
                                className={`${fieldQuiet} uppercase max-w-[5rem]`}
                                autoComplete="off"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-mist-500 dark:text-mist-400 mb-2">Color</p>
                              <div className="flex flex-wrap gap-2">
                                {MEMBER_COLORS.map(c => (
                                  <button
                                    key={c.value}
                                    type="button"
                                    title={c.label}
                                    aria-label={c.label}
                                    aria-pressed={memberColor === c.value}
                                    onClick={() => setMemberColor(c.value)}
                                    className={`w-8 h-8 rounded-full ${c.value} ring-offset-2 ring-offset-white dark:ring-offset-mist-800 transition-shadow ${
                                      memberColor === c.value ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-mist-300 dark:hover:ring-mist-600'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {memberError && <p className="text-xs text-red-600 dark:text-red-400">{memberError}</p>}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setEditingMember(null); setMemberError(null) }}
                                disabled={memberSaving}
                                className="flex-1 py-2 bg-mist-100 dark:bg-mist-700 text-sm font-medium rounded-xl disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveMember}
                                disabled={memberSaving}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
                              >
                                {memberSaving ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditMember(p)}
                            disabled={!isSuperAdmin}
                            className={`w-full flex items-center gap-3 text-left ${isSuperAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <ThreadAvatar color={p.color} initials={p.initials} />
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{p.name}</span>
                            {isSuperAdmin && <RowChevron />}
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* Display */}
            <section>
              <SectionLabel>Display</SectionLabel>
              <div className={sectionCard}>
                <ChatViewSettingsList
                  compact
                  enabledTypes={enabledTypes}
                  onChange={onContentTypeChange}
                  onReset={onResetContentTypes}
                  hideImages={hideImages}
                  onHideImagesChange={onHideImagesChange}
                  showHidden={isSuperAdmin ? showHidden : undefined}
                  onShowHiddenChange={isSuperAdmin ? onToggleShowHidden : undefined}
                />
              </div>
            </section>

            {/* Privacy / admin */}
            {(isSuperAdmin || canDelete) && (
              <section>
                <SectionLabel>Privacy &amp; support</SectionLabel>
                <div className={sectionCard}>
                  {isSuperAdmin && (
                    <Link
                      href="/upload"
                      className="flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400"
                    >
                      Import thread
                      <RowChevron />
                    </Link>
                  )}
                </div>

                {canDelete && (
                  <div className="mt-3 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3 bg-white dark:bg-mist-800">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Danger zone</p>
                    {!confirming ? (
                      <>
                        <p className="text-xs text-mist-500 dark:text-mist-400">Permanently remove this thread and its media.</p>
                        <button
                          type="button"
                          onClick={() => setConfirming(true)}
                          className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                          Delete thread…
                        </button>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-mist-500 dark:text-mist-400">
                          Delete <span className="font-semibold text-gray-700 dark:text-mist-200">{threadName}</span>? This cannot be undone.
                        </p>
                        {deleteError && <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setConfirming(false); setDeleteError(null) }}
                            disabled={deleting}
                            className="flex-1 py-2.5 bg-mist-100 dark:bg-mist-700 text-sm font-medium rounded-xl disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-60"
                          >
                            {deleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
        <div className="flex flex-col items-center gap-2 px-4 pt-5 pb-4">
          <AvatarGroup people={participantAvatars(memberList)} size="lg" />
          <p className="text-base font-semibold text-gray-900 dark:text-white text-center px-4">{threadName}</p>
        </div>
        <div className="mx-3 md:mx-4 rounded-2xl bg-mist-50 dark:bg-mist-800/80 overflow-hidden divide-y divide-mist-100 dark:divide-mist-700/80">
          <button type="button" onClick={() => setPage('chatInfo')} className={rowBtn}>
            <span>Chat info</span>
            <RowChevron />
          </button>
          <button type="button" onClick={onOpenMedia} className={rowBtn} aria-label="Media, files and links">
            <span>Media, files and links</span>
            <RowChevron />
          </button>
        </div>
      </div>
    </div>
  )
}
