'use client'
import { useEffect, useRef } from 'react'
import { ContextMenuState } from '@/types'

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
    <div ref={ref} style={{ left, top }} className="fixed bg-white dark:bg-gray-800 border border-black/10 dark:border-gray-700 rounded-md shadow-lg dark:shadow-gray-900 py-1 min-w-[130px] z-300 text-[13px]">
      {state.kind === 'gallery' && (
        <div className="px-3.5 py-1.5 cursor-pointer text-gray-800 dark:text-gray-100 hover:bg-mist-50 dark:hover:bg-mist-700 select-none"
          onClick={() => { if (state.galTs != null) { onJumpToMessage(state.galTs, state.galMsgId ?? null); onClose() } }}>Go to message</div>
      )}
      {(state.kind === 'gallery' || state.kind === 'media') && state.mediaUri && onHideUri && (
        <div className="px-3.5 py-1.5 cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 select-none"
          onClick={() => { onHideUri(state.mediaUri!); onClose() }}>Hide image</div>
      )}
      {state.kind === 'message' && state.msgIds && (
        <>
          {state.msgTs && (
            <div className="px-3.5 py-1.5 cursor-pointer text-gray-800 dark:text-gray-100 hover:bg-mist-50 dark:hover:bg-mist-700 select-none"
              onClick={() => { onJumpToMessage(String(state.msgTs!), state.msgIds![0]); onClose() }}>Go to message</div>
          )}
          {onCopyLink && (
            <div className="px-3.5 py-1.5 cursor-pointer text-gray-800 dark:text-gray-100 hover:bg-mist-50 dark:hover:bg-mist-700 select-none"
              onClick={() => { onCopyLink(state.msgIds!); onClose() }}>Copy link</div>
          )}
          {onCopyText && (
            <div className="px-3.5 py-1.5 cursor-pointer text-gray-800 dark:text-gray-100 hover:bg-mist-50 dark:hover:bg-mist-700 select-none"
              onClick={() => { onCopyText(state.msgIds!); onClose() }}>Copy text</div>
          )}
          {onTagMessages && (
            <div className="px-3.5 py-1.5 cursor-pointer text-gray-800 dark:text-gray-100 hover:bg-mist-50 dark:hover:bg-mist-700 select-none"
              onClick={() => { onTagMessages(state.msgIds!); onClose() }}># Tag</div>
          )}
        </>
      )}
    </div>
  )
}
