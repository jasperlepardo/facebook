'use client'
import { useEffect, useRef, useState } from 'react'
import { Hashtag } from '@/types'

interface Props {
  hashtags: Hashtag[]
  onClose: () => void
  onApply: (hashtagIds: string[], newNames: string[]) => void
}

export default function HashtagPicker({ hashtags, onClose, onApply }: Props) {
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newTags, setNewTags] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function toSlug(v: string) {
    return v.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(toSlug(e.target.value))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && input.trim()) {
      const slug = input.trim()
      const existing = hashtags.find(h => h.name === slug)
      if (existing) {
        setSelected(prev => { const n = new Set(prev); n.has(existing.id) ? n.delete(existing.id) : n.add(existing.id); return n })
      } else if (!newTags.includes(slug)) {
        setNewTags(prev => [...prev, slug])
      }
      setInput('')
    }
  }

  function toggleExisting(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function removeNew(tag: string) {
    setNewTags(prev => prev.filter(t => t !== tag))
  }

  const filtered = input
    ? hashtags.filter(h => h.name.includes(input))
    : hashtags

  const canApply = selected.size > 0 || newTags.length > 0

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-80 p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Tag messages</h3>

        <input
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type hashtag, press Enter…"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-500 mb-3"
        />

        {/* New tags staged */}
        {newTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {newTags.map(t => (
              <span key={t} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                #{t}
                <button onClick={() => removeNew(t)} className="hover:text-blue-900 leading-none">×</button>
              </span>
            ))}
          </div>
        )}

        {/* Existing hashtags */}
        <div className="max-h-48 overflow-y-auto space-y-0.5 mb-4">
          {filtered.length === 0 && input && (
            <p className="text-xs text-gray-400 py-1 px-1">Press Enter to create <strong>#{input}</strong></p>
          )}
          {filtered.map(h => (
            <label key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={selected.has(h.id)} onChange={() => toggleExisting(h.id)} className="accent-blue-600" />
              <span className="text-sm text-gray-700">#{h.name}</span>
              <span className="ml-auto text-xs text-gray-400">{(h.msgIds || '').split(',').filter(Boolean).length}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg">Cancel</button>
          <button
            onClick={() => canApply && onApply([...selected], newTags)}
            disabled={!canApply}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-40"
          >Apply</button>
        </div>
      </div>
    </div>
  )
}
