'use client'
import { useEffect, useRef } from 'react'
import { CONTENT_TYPES, ContentTypeKey, ALL_CONTENT_TYPE_KEYS } from '@/lib/contentTypes'

interface Props {
  enabledTypes: Set<ContentTypeKey>
  onChange: (key: ContentTypeKey, enabled: boolean) => void
  onReset: () => void
  onClose: () => void
}

export default function ChatViewSettingsModal({ enabledTypes, onChange, onReset, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const allOn = ALL_CONTENT_TYPE_KEYS.every(k => enabledTypes.has(k))

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="bg-white dark:bg-mist-900 rounded-2xl shadow-2xl w-[340px] max-h-[80vh] flex flex-col overflow-hidden border border-mist-100 dark:border-mist-700">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mist-100 dark:border-mist-800 shrink-0">
          <span className="text-sm font-bold text-gray-900 dark:text-white">View settings</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-mist-200 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 py-2">
          {/* All toggle */}
          <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-mist-50 dark:hover:bg-mist-800/50 group">
            <span className="text-[18px] w-6 text-center select-none">✦</span>
            <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-mist-200">All content types</span>
            <Toggle on={allOn} onChange={on => ALL_CONTENT_TYPE_KEYS.forEach(k => onChange(k, on))} />
          </label>
          <div className="mx-5 my-1 border-t border-mist-100 dark:border-mist-800" />
          {CONTENT_TYPES.map(({ key, label, icon }) => (
            <label key={key} className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-mist-50 dark:hover:bg-mist-800/50">
              <span className="text-[18px] w-6 text-center select-none">{icon}</span>
              <span className="flex-1 text-sm text-gray-700 dark:text-mist-200">{label}</span>
              <Toggle on={enabledTypes.has(key)} onChange={on => onChange(key, on)} />
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-mist-100 dark:border-mist-800 shrink-0 flex justify-between items-center">
          <button
            onClick={onReset}
            className="text-xs text-mist-500 hover:text-mist-700 dark:hover:text-mist-300 transition-colors"
          >Reset to defaults</button>
          <button
            onClick={onClose}
            className="text-sm font-semibold text-mist-600 dark:text-mist-400 hover:text-mist-800 dark:hover:text-mist-200 transition-colors"
          >Done</button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={e => { e.preventDefault(); onChange(!on) }}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-mist-600' : 'bg-mist-200 dark:bg-mist-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}
