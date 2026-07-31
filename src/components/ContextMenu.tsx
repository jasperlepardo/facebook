'use client'
import { useEffect, useRef } from 'react'
import { ContextMenuState } from '@/types'
import { menu, menuItem, menuItemDanger } from '@/lib/ui'

interface ContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onJumpToMessage: (ts: string, msgId: string | null) => void
  onHideUri?: (uri: string) => void
  onTagMessages?: (msgIds: string[]) => void
  onCopyLink?: (msgIds: string[]) => void
  onCopyText?: (msgIds: string[]) => void
}

export default function ContextMenu({ state, onClose, onJumpToMessage, onHideUri, onTagMessages, onCopyLink, onCopyText }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('click', handleOutsideClick, true)
    return () => document.removeEventListener('click', handleOutsideClick, true)
  }, [onClose])

  const left = Math.min(state.x, window.innerWidth - 145)
  const top  = Math.min(state.y, window.innerHeight - 120)

  return (
    <div ref={ref} style={{ left, top }} className={`fixed ${menu} min-w-[130px] z-300 text-[13px]`}>
      {state.kind === 'gallery' && (
        <button type="button" className={menuItem}
          onClick={() => { if (state.galTs != null) { onJumpToMessage(state.galTs, state.galMsgId ?? null); onClose() } }}>Go to message</button>
      )}
      {(state.kind === 'gallery' || state.kind === 'media') && state.mediaUri && onHideUri && (
        <button type="button" className={menuItemDanger}
          onClick={() => { onHideUri(state.mediaUri!); onClose() }}>Hide image</button>
      )}
      {state.kind === 'message' && state.msgIds && (
        <>
          {state.msgTs && (
            <button type="button" className={menuItem}
              onClick={() => { onJumpToMessage(String(state.msgTs!), state.msgIds![0]); onClose() }}>Go to message</button>
          )}
          {onCopyLink && (
            <button type="button" className={menuItem}
              onClick={() => { onCopyLink(state.msgIds!); onClose() }}>Copy link</button>
          )}
          {onCopyText && (
            <button type="button" className={menuItem}
              onClick={() => { onCopyText(state.msgIds!); onClose() }}>Copy text</button>
          )}
          {onTagMessages && (
            <button type="button" className={menuItem}
              onClick={() => { onTagMessages(state.msgIds!); onClose() }}># Tag</button>
          )}
        </>
      )}
    </div>
  )
}
