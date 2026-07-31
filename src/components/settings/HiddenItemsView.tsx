'use client'
import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'

interface HiddenItem {
  _id: string
  type: 'message' | 'uri'
  value: string
  note?: string
  createdAt: string
}

const inputCls    = 'w-full px-3 py-2.5 border border-gray-300 dark:border-mist-700 rounded-xl text-sm bg-white dark:bg-mist-900 text-gray-900 dark:text-mist-100 focus:outline-hidden focus:ring-2 focus:ring-mist-500'
const sectionCls  = 'bg-white dark:bg-mist-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700'
const rowCls      = 'flex items-center justify-between px-4 py-3'

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
}

interface Props {
  onBack: () => void
}

export default function HiddenItemsView({ onBack }: Props) {
  const [items, setItems]       = useState<HiddenItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [addType, setAddType]   = useState<'message' | 'uri'>('message')
  const [addValue, setAddValue] = useState('')
  const [addNote, setAddNote]   = useState('')
  const [adding, setAdding]     = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/hidden-items')
      if (res.ok) setItems((await res.json()).items ?? [])
      else toast('Failed to load hidden items')
    } catch { toast('Failed to load hidden items') }
    finally { setLoading(false) }
  }

  async function add() {
    if (!addValue.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/hidden-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: addType, value: addValue.trim(), note: addNote.trim() }),
      })
      if (!res.ok) { toast('Failed to add hidden item'); return }
      setAddValue(''); setAddNote('')
      await load()
    } catch { toast('Failed to add hidden item') }
    finally { setAdding(false) }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/hidden-items?id=${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i._id !== id))
    } catch { toast('Failed to remove hidden item') }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-mist-900">
      <div className="px-4 py-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-mist-400 hover:text-mist-700 dark:hover:text-mist-200 mb-6">
          <BackIcon /> Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-mist-100 mb-6">Hidden items</h1>

        <div className="bg-white dark:bg-mist-800 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-mist-500">Add hidden item</p>
          <div className="flex gap-2">
            {(['message', 'uri'] as const).map(t => (
              <button key={t} onClick={() => setAddType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${addType === t ? 'border-mist-600 text-mist-600 bg-mist-50 dark:border-mist-400 dark:text-mist-400 dark:bg-mist-900/30' : 'border-gray-200 dark:border-mist-700 text-gray-500 dark:text-mist-400'}`}>
                {t === 'message' ? 'Message ID' : 'Image URI'}
              </button>
            ))}
          </div>
          <input value={addValue} onChange={e => setAddValue(e.target.value)}
            placeholder={addType === 'message' ? 'MongoDB ObjectId…' : 'media/photos/…'} className={inputCls} />
          <input value={addNote} onChange={e => setAddNote(e.target.value)}
            placeholder="Note (optional)" className={inputCls} />
          <button onClick={add} disabled={adding || !addValue.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-mist-600 hover:bg-mist-700 text-white disabled:opacity-50 transition-colors">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No hidden items yet.</p>
        ) : (
          <div className={sectionCls}>
            {items.map(item => (
              <div key={item._id} className={`${rowCls} gap-3`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${item.type === 'message' ? 'bg-mist-100 text-mist-700 dark:bg-mist-900/40 dark:text-mist-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
                      {item.type === 'message' ? 'MSG' : 'URI'}
                    </span>
                    <span className="text-xs font-mono text-gray-600 dark:text-mist-300 truncate">{item.value}</span>
                  </div>
                  {item.note && <p className="text-xs text-gray-400 dark:text-mist-500">{item.note}</p>}
                  <p className="text-xs text-gray-400 dark:text-mist-500">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => remove(item._id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
