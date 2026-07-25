'use client'
import { useEffect, useRef } from 'react'
import { ContextMenuState, Note } from '@/types'

interface ContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onEditNote: (note: Note) => void
  onJumpToMessage: (ts: string, msgId: string | null) => void
}

export default function ContextMenu({ state, onClose, onEditNote, onJumpToMessage }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('click', handleOutsideClick, true)
    return () => document.removeEventListener('click', handleOutsideClick, true)
  }, [onClose])

  const left = Math.min(state.x, window.innerWidth - 145)
  const top  = Math.min(state.y, window.innerHeight - 80)

  return (
    <div ref={ref} style={{ left, top }} className="fixed bg-white border border-black/15 rounded-md shadow-lg py-1 min-w-[130px] z-[300] text-[13px]">
      {state.kind === 'note' && state.note && (
        <div className="px-3.5 py-1.5 cursor-pointer text-gray-800 hover:bg-gray-100 select-none"
          onClick={() => { onEditNote(state.note!); onClose() }}>Edit Note</div>
      )}
      {state.kind === 'gallery' && (
        <div className="px-3.5 py-1.5 cursor-pointer text-gray-800 hover:bg-gray-100 select-none"
          onClick={() => { onJumpToMessage(state.galTs!, state.galMsgId ?? null); onClose() }}>Go to message</div>
      )}
    </div>
  )
}
