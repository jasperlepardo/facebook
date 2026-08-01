'use client'
import { useState } from 'react'
import ActionSheet from '@/components/ActionSheet'
import { MessageActionDesc, actionsToSheet } from '@/lib/messageActions'
import { MessageBarIconButton } from './MessageRowActions'

interface MessageSelectionBarProps {
  count: number
  actions: MessageActionDesc[]
  onClear: () => void
}

export default function MessageSelectionBar({ count, actions, onClear }: MessageSelectionBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 liquid-glass text-gray-900 dark:text-white rounded-full px-3 py-2 flex items-center gap-2 text-[13px] whitespace-nowrap shadow-xl z-20${count < 2 ? ' md:hidden' : ''}`}>
        <span className="text-mist-500 dark:text-white/60 px-1">{count} selected</span>

        {/* Desktop: icon actions */}
        <div className="hidden md:flex items-center gap-1.5">
          {actions.map(a => (
            <MessageBarIconButton key={a.id} action={a} />
          ))}
        </div>

        {/* Mobile: open ActionSheet */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="md:hidden liquid-glass-btn liquid-glass-chip !h-8 font-semibold"
        >
          <span>Actions</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="liquid-glass-btn !w-8 !h-8"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {sheetOpen && (
        <ActionSheet
          title={`${count} selected`}
          actions={actionsToSheet(actions)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}
