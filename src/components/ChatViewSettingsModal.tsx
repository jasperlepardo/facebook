'use client'
import { useEffect, useRef } from 'react'
import { ContentTypeKey } from '@/lib/contentTypes'
import ChatViewSettingsList from './ChatViewSettingsList'

interface Props {
  enabledTypes: Set<ContentTypeKey>
  onChange: (key: ContentTypeKey, enabled: boolean) => void
  onReset: () => void
  onClose: () => void
}

/** Kept for any external callers; chat chrome uses ThreadDetailsPane instead. */
export default function ChatViewSettingsModal({ enabledTypes, onChange, onReset, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="liquid-glass rounded-2xl shadow-2xl w-[340px] max-w-[calc(100vw-2rem)] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/8 dark:border-white/10 shrink-0">
          <span className="text-sm font-bold text-gray-900 dark:text-white">View settings</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-mist-200 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 py-2">
          <ChatViewSettingsList enabledTypes={enabledTypes} onChange={onChange} onReset={onReset} />
        </div>
        <div className="px-5 py-3 border-t border-mist-100 dark:border-mist-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >Done</button>
        </div>
      </div>
    </div>
  )
}
