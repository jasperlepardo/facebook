'use client'
import { useEffect, useRef, useState } from 'react'
import { Hashtag, LightboxState, Message } from '@/types'
import { groupMessages } from '@/lib/groupMessages'
import MessageGroup from './MessageGroup'
import Lightbox from './Lightbox'

interface Props {
  hashtags: Hashtag[]
  onReload: () => void
  onJumpToMessage: (ts: number, msgId: string) => void
}

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

export default function HashtagsPane({ hashtags, onReload, onJumpToMessage }: Props) {
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Hashtag | null>(null)
  const [activeTab, setActiveTab] = useState<'context' | 'messages'>('context')
  const [context, setContext] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nameRef = useRef<HTMLInputElement>(null)
  const newRef = useRef<HTMLInputElement>(null)

  async function openDetail(h: Hashtag) {
    setSelected(h)
    setContext(h.context ?? '')
    setActiveTab('context')
    setEditingName(false)
    await loadMessages(h)
  }

  async function loadMessages(h: Hashtag) {
    const ids = (h.msgIds ?? '').split(',').filter(Boolean)
    if (!ids.length) { setMessages([]); return }
    try {
      const d = await apiFetch<{ messages: Message[] }>(`/api/messages?ids=${ids.join(',')}`)
      setMessages(d.messages ?? [])
    } catch { setMessages([]) }
  }

  function handleContextChange(v: string) {
    setContext(v)
    if (!selected) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: v }) })
    }, 600)
  }

  async function saveName() {
    if (!selected || !nameInput.trim()) { setEditingName(false); return }
    const slug = nameInput.trim()
    await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: slug }) })
    setSelected(prev => prev ? { ...prev, name: slug } : prev)
    setEditingName(false)
    onReload()
  }

  async function createHashtag() {
    const slug = newName.trim()
    if (!slug) return
    await fetch('/api/hashtags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: slug }) })
    setNewName(''); setCreating(false)
    onReload()
  }

  async function removeMessage(msgId: string) {
    if (!selected) return
    const ids = (selected.msgIds ?? '').split(',').filter(id => id && id !== msgId)
    const updated = { ...selected, msgIds: ids.join(',') }
    await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msgIds: updated.msgIds }) })
    setSelected(updated)
    setMessages(prev => prev.filter(m => m._id !== msgId))
  }

  async function deleteHashtag() {
    if (!selected || !confirm(`Delete #${selected.name}?`)) return
    await fetch(`/api/hashtags/${selected.id}`, { method: 'DELETE' })
    setSelected(null)
    onReload()
  }

  function toSlug(v: string) { return v.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() }

  const filtered = filter ? hashtags.filter(h => h.name.includes(filter.toLowerCase())) : hashtags

  // ─── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    const msgCount = messages.length

    return (
      <>
      <div className="flex flex-col h-full min-h-0 bg-white">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 flex-shrink-0">
          <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1">←</button>
          {editingName ? (
            <input
              ref={nameRef}
              value={nameInput}
              onChange={e => setNameInput(toSlug(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              onBlur={saveName}
              className="flex-1 text-sm font-bold border-b border-blue-500 outline-none px-0.5 text-blue-700"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setNameInput(selected.name); setEditingName(true) }}
              className="flex-1 text-left text-sm font-bold text-blue-700 hover:underline truncate"
            >#{selected.name}</button>
          )}
          <button onClick={deleteHashtag} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">Delete</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {(['context', 'messages'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab === 'messages' ? `Messages (${msgCount})` : 'Context'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'context' && (
            <textarea
              value={context}
              onChange={e => handleContextChange(e.target.value)}
              placeholder={`Notes and context for #${selected.name}…`}
              className="w-full h-full p-3 text-sm text-gray-700 leading-relaxed resize-none outline-none"
            />
          )}

          {activeTab === 'messages' && (
            <div>
              {messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">No messages tagged yet.</p>
              )}
              {groupMessages(messages).map((block, i) => (
                <div key={block.msgs[0]._id ?? i} className="relative group/block">
                  <MessageGroup
                    block={block}
                    isSelected={false}
                    onToggle={() => {}}
                    onLightbox={setLightbox}
                  />
                  {/* Per-block actions: jump + remove */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover/block:opacity-100 transition-opacity flex gap-1 z-10">
                    <button
                      onClick={() => onJumpToMessage(block.msgs[0].timestamp_ms, block.msgs[0]._id)}
                      className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-blue-600 shadow-sm hover:bg-blue-50"
                    >→ Jump</button>
                    <button
                      onClick={() => block.msgs.forEach(m => removeMessage(m._id))}
                      className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-red-500 shadow-sm hover:bg-red-50"
                    >× Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
      </>
    )
  }

  // ─── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold text-gray-800 flex-1"># Hashtags</span>
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          className="px-2 py-1 text-xs border border-gray-200 rounded-full outline-none w-24"
        />
        <button onClick={() => { setCreating(true); setTimeout(() => newRef.current?.focus(), 50) }}
          className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-full font-semibold">+ New</button>
      </div>

      {creating && (
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm text-gray-400">#</span>
          <input
            ref={newRef}
            value={newName}
            onChange={e => setNewName(toSlug(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') createHashtag(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
            placeholder="hashtag-name"
            className="flex-1 text-sm outline-none"
          />
          <button onClick={createHashtag} className="text-xs text-blue-600 font-semibold">Add</button>
          <button onClick={() => { setCreating(false); setNewName('') }} className="text-xs text-gray-400">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">{filter ? 'No matches.' : 'No hashtags yet. Create one above.'}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {filtered.map(h => {
            const count = (h.msgIds ?? '').split(',').filter(Boolean).length
            return (
              <button key={h.id} onClick={() => openDetail(h)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded-full text-sm font-medium text-gray-700 transition-colors">
                <span className="text-gray-400">#</span>{h.name}
                {count > 0 && <span className="text-xs text-gray-400">({count})</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
