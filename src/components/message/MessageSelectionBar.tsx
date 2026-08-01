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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full px-3 py-2 flex items-center gap-2 text-[13px] whitespace-nowrap shadow-xl z-20">
        <span className="text-white/60 px-1">{count} selected</span>

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
          className="md:hidden bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full font-semibold transition-colors"
        >
          Actions
        </button>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="opacity-50 hover:opacity-100 transition-opacity w-7 h-7 inline-flex items-center justify-center"
        >
          ✕
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
