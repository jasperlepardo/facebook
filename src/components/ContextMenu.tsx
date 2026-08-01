'use client'
import { useEffect, useRef } from 'react'
import { ContextMenuState } from '@/types'
import { menu, menuItemDanger } from '@/lib/ui'

interface ContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onJumpToMessage?: (ts: string, msgId: string | null) => void
  onHideUri?: (uri: string) => void
}

/** Desktop menu for inline chat media hide (gallery/message use icons + ActionSheet). */
export default function ContextMenu({ state, onClose, onHideUri }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('click', handleOutsideClick, true)
    return () => document.removeEventListener('click', handleOutsideClick, true)
  }, [onClose])

  const left = Math.min(state.x, window.innerWidth - 145)
  const top  = Math.min(state.y, window.innerHeight - 120)

  if (state.kind !== 'media' || !state.mediaUri || !onHideUri) return null

  return (
    <div ref={ref} style={{ left, top }} className={`fixed ${menu} min-w-[130px] z-300 text-[13px]`}>
      <button type="button" className={menuItemDanger}
        onClick={() => { onHideUri(state.mediaUri!); onClose() }}>Hide image</button>
    </div>
  )
}
