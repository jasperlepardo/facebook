'use client'
import { useEffect, useRef } from 'react'
import { ContextMenuState } from '@/types'
import { menu, menuItem, menuItemDanger } from '@/lib/ui'

interface ContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onJumpToMessage?: (ts: string, msgId: string | null) => void
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  isHidden?: boolean
  isSuperAdmin?: boolean
}

/** Desktop context menu for chat media and gallery cells. */
export default function ContextMenu({
  state, onClose, onJumpToMessage, onHideUri, onUnhideUri, isHidden, isSuperAdmin,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('click', handleOutsideClick, true)
    return () => document.removeEventListener('click', handleOutsideClick, true)
  }, [onClose])

  const left = Math.min(state.x, window.innerWidth - 160)
  const top  = Math.min(state.y, window.innerHeight - 140)

  const items: { label: string; destructive?: boolean; onPress: () => void }[] = []

  if (state.kind === 'gallery' && state.galMsgId && onJumpToMessage) {
    items.push({
      label: 'Go to message',
      onPress: () => { onJumpToMessage(state.galTs!, state.galMsgId!); onClose() },
    })
  }

  if (state.mediaUri) {
    if (state.kind === 'gallery' && isSuperAdmin) {
      if (isHidden && onUnhideUri) {
        items.push({ label: 'Unhide', onPress: () => { onUnhideUri(state.mediaUri!); onClose() } })
      } else if (!isHidden && onHideUri) {
        items.push({ label: 'Hide', destructive: true, onPress: () => { onHideUri(state.mediaUri!); onClose() } })
      }
    } else if (state.kind === 'media' && onHideUri) {
      if (isHidden && onUnhideUri) {
        items.push({ label: 'Unhide', onPress: () => { onUnhideUri(state.mediaUri!); onClose() } })
      } else {
        items.push({ label: 'Hide image', destructive: true, onPress: () => { onHideUri(state.mediaUri!); onClose() } })
      }
    }
  }

  if (!items.length) return null

  return (
    <div ref={ref} style={{ left, top }} className={`fixed ${menu} min-w-[140px] z-300 text-[13px]`}>
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          className={item.destructive ? menuItemDanger : menuItem}
          onClick={item.onPress}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
