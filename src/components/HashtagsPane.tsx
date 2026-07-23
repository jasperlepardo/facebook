'use client'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Hashtag, LightboxState, Message, MessageBlock } from '@/types'
import { ME } from '@/lib/constants'
import { fmtDate } from '@/lib/format'
import MessageGroup from './MessageGroup'
import Lightbox from './Lightbox'

function buildBlocks(messages: Message[]): MessageBlock[] {
  const sorted = [...messages].sort((a, b) => a.timestamp_ms - b.timestamp_ms)
  const groupMap = new Map<string, Message[]>()
  for (const m of sorted) {
    const key = m.blockId!
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(m)
  }
  const groups = [...groupMap.values()]
    .sort((a, b) => a[0].timestamp_ms - b[0].timestamp_ms)
  return groups.map((msgs, i) => ({
    date: fmtDate(msgs[0].timestamp_ms),
    newDate: i === 0 || fmtDate(msgs[0].timestamp_ms) !== fmtDate(groups[i - 1][0].timestamp_ms),
    sender: msgs[0].sender_name,
    mine: msgs[0].sender_name === ME,
    msgs,
  }))
}

// Per-container lazy loader (same pattern as main chat)
const ioCache = new Map<HTMLElement, IntersectionObserver>()
function observeLazy(container: HTMLElement) {
  let io = ioCache.get(container)
  if (!io) {
    io = new IntersectionObserver(entries => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) continue
        const el = target as HTMLImageElement | HTMLVideoElement | HTMLAudioElement
        if (el.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; io!.unobserve(el) }
      }
    }, { root: container, rootMargin: '300px' })
    ioCache.set(container, io)
  }
  container.querySelectorAll<HTMLElement>('[data-src]').forEach(el => io!.observe(el))
}

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
  const [editingContext, setEditingContext] = useState(false)
  const ctxRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nameRef = useRef<HTMLInputElement>(null)
  const newRef = useRef<HTMLInputElement>(null)
  const msgsScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab === 'messages' && msgsScrollRef.current) {
      observeLazy(msgsScrollRef.current)
    }
  }, [messages, activeTab])

  async function openDetail(h: Hashtag) {
    setSelected(h)
    setContext(h.context ?? '')
    setActiveTab('context')
    setEditingName(false)
    setEditingContext(false)
    await loadMessages(h)
  }

  async function loadMessages(h: Hashtag) {
    const ids = (h.groupIds ?? '').split(',').filter(Boolean)
    if (!ids.length) { setMessages([]); return }
    try {
      const CHUNK = 150
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))
      const results = await Promise.all(
        chunks.map(chunk => apiFetch<{ messages: Message[] }>(`/api/messages?groupIds=${chunk.join(',')}`))
      )
      const all = results.flatMap(r => r.messages ?? [])
      all.sort((a, b) => a.timestamp_ms - b.timestamp_ms)
      setMessages(all)
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

  async function removeGroup(blockId: string) {
    if (!selected) return
    const ids = (selected.groupIds ?? '').split(',').filter(id => id && id !== blockId)
    const updated = { ...selected, groupIds: ids.join(',') }
    await fetch(`/api/hashtags/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupIds: updated.groupIds }) })
    setSelected(updated)
    await loadMessages(updated)
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

        {/* Tab content — each tab is its own independent scroll container */}
        <div className="flex-1 min-h-0 relative">

          {/* Context tab */}
          {activeTab === 'context' && (
            <div className="absolute inset-0 overflow-y-auto">
              {editingContext ? (
                <textarea
                  ref={ctxRef}
                  value={context}
                  onChange={e => handleContextChange(e.target.value)}
                  onBlur={() => setEditingContext(false)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') setEditingContext(false) }}
                  placeholder={`Notes and context for #${selected.name}…\n\nSupports **markdown**`}
                  className="w-full h-full p-3 text-sm text-gray-700 leading-relaxed resize-none outline-none font-mono"
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => { setEditingContext(true); setTimeout(() => ctxRef.current?.focus(), 10) }}
                  className="min-h-full p-3 cursor-text"
                >
                  {context ? (
                    <ReactMarkdown components={{
                      p:          ({children}) => <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>,
                      h1:         ({children}) => <h1 className="text-base font-bold text-gray-900 mb-2 mt-4">{children}</h1>,
                      h2:         ({children}) => <h2 className="text-sm font-bold text-gray-800 mb-2 mt-3">{children}</h2>,
                      h3:         ({children}) => <h3 className="text-sm font-semibold text-gray-800 mb-1 mt-3">{children}</h3>,
                      ul:         ({children}) => <ul className="list-disc pl-4 mb-3 space-y-1 text-sm text-gray-700">{children}</ul>,
                      ol:         ({children}) => <ol className="list-decimal pl-4 mb-3 space-y-1 text-sm text-gray-700">{children}</ol>,
                      li:         ({children}) => <li className="leading-relaxed">{children}</li>,
                      strong:     ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      em:         ({children}) => <em className="italic">{children}</em>,
                      a:          ({href, children}) => <a href={href} target="_blank" rel="noopener" className="text-blue-600 underline">{children}</a>,
                      code:       ({children}) => <code className="bg-gray-100 text-xs px-1 py-0.5 rounded font-mono">{children}</code>,
                      blockquote: ({children}) => <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-500 italic my-2">{children}</blockquote>,
                    }}>{context}</ReactMarkdown>
                  ) : (
                    <p className="text-sm text-gray-300 italic">Click to add context… supports **markdown**</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages tab — own scroll container so observeLazy root is correct */}
          {activeTab === 'messages' && (
            <div ref={msgsScrollRef} className="absolute inset-0 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">No messages tagged yet.</p>
              )}
              {buildBlocks(messages).map((block, i) => (
                <div key={block.msgs[0].blockId ?? i} className="relative group/block">
                  <MessageGroup
                    block={block}
                    isSelected={false}
                    onToggle={() => {}}
                    onLightbox={setLightbox}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover/block:opacity-100 transition-opacity flex gap-1 z-10">
                    <button
                      onClick={() => onJumpToMessage(block.msgs[0].timestamp_ms, block.msgs[0]._id)}
                      className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-blue-600 shadow-sm hover:bg-blue-50"
                    >→ Jump</button>
                    <button
                      onClick={() => removeGroup(block.msgs[0].blockId!)}
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

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">{filter ? 'No matches.' : 'No hashtags yet. Create one above.'}</p>
        )}
        {filtered.map(h => {
          const count = (h.groupIds ?? '').split(',').filter(Boolean).length
          return (
            <button key={h.id} onClick={() => openDetail(h)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-blue-600">#{h.name}</span>
                {count > 0 && <span className="text-[11px] text-gray-400">{count} message{count !== 1 ? 's' : ''}</span>}
              </div>
              {h.context
                ? <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{h.context}</p>
                : <p className="text-xs text-gray-300 italic">No context yet</p>
              }
            </button>
          )
        })}
      </div>
    </div>
  )
}
