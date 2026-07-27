'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hashtag } from '@/types'
import { toSlug } from '@/lib/utils'

interface HashtagPickerProps {
  hashtags: Hashtag[]
  blockIds: string[]
  initialSelected?: Set<string>
  onClose: () => void
  onApply: (hashtagIds: string[], newNames: string[]) => void
}

export default function HashtagPicker({ hashtags, blockIds, initialSelected, onClose, onApply }: HashtagPickerProps) {
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(initialSelected ?? new Set())
  const [newTags, setNewTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // If preloaded data arrives after the modal opens, apply it once
  useEffect(() => {
    if (initialSelected) setSelected(initialSelected)
  }, [initialSelected])

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [onClose])

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

  const filtered = useMemo(
    () => input ? hashtags.filter(h => h.name.includes(input)) : hashtags,
    [hashtags, input]
  )

  const pendingInput = input.trim()
  const canApply = selected.size > 0 || newTags.length > 0 || !!pendingInput

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={loading ? undefined : onClose} />
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
              <span className="ml-auto text-xs text-gray-400">{h.groupCount ?? 0}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg disabled:opacity-40">Cancel</button>
          <button
            onClick={() => {
              if (!canApply || loading) return
              const allNew = pendingInput && !newTags.includes(pendingInput) ? [...newTags, pendingInput] : newTags
              setLoading(true)
              onApply([...selected], allNew)
            }}
            disabled={!canApply || loading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-40 flex items-center gap-2 min-w-[64px] justify-center"
          >
            {loading && (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loading ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
