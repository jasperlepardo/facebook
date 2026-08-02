'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Hashtag } from '@/types'
import { isAbortError, toSlug } from '@/lib/utils'
import { field, btnPrimary, btnSecondary } from '@/lib/ui'

interface HashtagPickerProps {
  hashtags: Hashtag[]
  initialSelected?: Set<string>
  /** When false, list is visible but selection/Apply stay gated until existing tags load. */
  ready?: boolean
  onClose: () => void
  onApply: (hashtagIds: string[], newNames: string[], signal: AbortSignal) => void | Promise<void>
  /** Extra classes for the scrollable list (pane can grow). */
  listClassName?: string
}

export default function HashtagPicker({
  hashtags, initialSelected, ready = true, onClose, onApply, listClassName = 'max-h-48',
}: HashtagPickerProps) {
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(initialSelected ?? new Set())
  const [newTags, setNewTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const locked = !ready || loading

  useEffect(() => {
    if (ready) inputRef.current?.focus()
  }, [ready])

  useEffect(() => () => { abortRef.current?.abort() }, [])

  useEffect(() => {
    if (ready && initialSelected) setSelected(initialSelected)
  }, [ready, initialSelected])

  const handleClose = useCallback(() => {
    abortRef.current?.abort()
    onCloseRef.current()
  }, [])

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [handleClose])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(toSlug(e.target.value))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (locked) return
    if (e.key === 'Enter' && input.trim()) {
      const slug = input.trim()
      const existing = hashtags.find(h => h.name === slug)
      if (existing) {
        setSelected(prev => {
          const n = new Set(prev)
          if (n.has(existing.id)) n.delete(existing.id)
          else n.add(existing.id)
          return n
        })
      } else if (!newTags.includes(slug)) {
        setNewTags(prev => [...prev, slug])
      }
      setInput('')
    }
  }

  function toggleExisting(id: string) {
    if (locked) return
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function removeNew(tag: string) {
    if (locked) return
    setNewTags(prev => prev.filter(t => t !== tag))
  }

  const filtered = useMemo(
    () => input ? hashtags.filter(h => h.name.includes(input)) : hashtags,
    [hashtags, input],
  )

  const pendingInput = input.trim()
  const canApply = ready && (selected.size > 0 || newTags.length > 0 || !!pendingInput)

  async function handleApply() {
    if (!canApply || loading) return
    const allNew = pendingInput && !newTags.includes(pendingInput) ? [...newTags, pendingInput] : newTags
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      await onApply([...selected], allNew, ctrl.signal)
    } catch (err) {
      if (isAbortError(err) || ctrl.signal.aborted) return
      throw err
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 pt-4 shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={ready ? 'Type hashtag, press Enter…' : 'Loading existing tags…'}
          className={`${field} mb-3`}
          disabled={locked}
        />

        {newTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {newTags.map(t => (
              <span key={t} className="flex items-center gap-1 liquid-glass text-mist-700 dark:text-mist-300 text-xs px-2 py-0.5 rounded-full font-medium">
                #{t}
                <button type="button" onClick={() => removeNew(t)} disabled={locked} className="hover:text-mist-900 dark:hover:text-mist-100 leading-none disabled:opacity-40">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto px-2 space-y-0.5 min-h-0 ${listClassName}`}>
        {filtered.length === 0 && input && (
          <p className="text-xs text-gray-400 dark:text-gray-500 py-1 px-2">Press Enter to create <strong>#{input}</strong></p>
        )}
        {filtered.map(h => (
          <label key={h.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg liquid-glass-hover ${locked ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={selected.has(h.id)} onChange={() => toggleExisting(h.id)} disabled={locked} className="accent-blue-600" />
            <span className="text-sm text-gray-700 dark:text-gray-200">#{h.name}</span>
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{h.groupCount ?? 0}</span>
          </label>
        ))}
      </div>

      <div className="px-4 py-3 flex gap-2 shrink-0 border-t border-mist-100 dark:border-mist-700">
        <button type="button" onClick={handleClose} className={`flex-1 ${btnSecondary}`}>Cancel</button>
        <button
          type="button"
          onClick={() => { void handleApply() }}
          disabled={!canApply || loading}
          className={`flex-1 ${btnPrimary} inline-flex items-center justify-center gap-2 min-w-[64px]`}
        >
          {loading && (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {loading ? 'Applying…' : !ready ? 'Loading…' : 'Apply'}
        </button>
      </div>
    </div>
  )
}
