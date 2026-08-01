'use client'
import {
  SelectIcon, GoToMessageIcon, TagIcon, CopyLinkIcon, CopyTextIcon,
  HideIcon, UnhideIcon, RemoveIcon,
} from '@/components/icons'
import { MessageActionDesc, MessageActionId } from '@/lib/messageActions'

const ICONS: Record<MessageActionId, (p: { size?: number }) => React.ReactNode> = {
  select:      p => <SelectIcon {...p} />,
  goToMessage: p => <GoToMessageIcon {...p} />,
  tag:         p => <TagIcon {...p} />,
  copyLink:    p => <CopyLinkIcon {...p} />,
  copyText:    p => <CopyTextIcon {...p} />,
  hide:        p => <HideIcon {...p} />,
  unhide:      p => <UnhideIcon {...p} />,
  remove:      p => <RemoveIcon {...p} />,
}

const btnBase =
  'liquid-glass-btn !w-7 !h-7 text-mist-600 dark:text-mist-300'

const btnDanger = `${btnBase} !text-red-500 dark:!text-red-400`

interface MessageRowActionsProps {
  actions: MessageActionDesc[]
  /** Extra class on the wrapper (e.g. gallery overlay positioning). */
  className?: string
  /** When true, always visible (bar / overlay); default is desktop-only. */
  alwaysVisible?: boolean
}

export function MessageActionIcon({ id, size = 14 }: { id: MessageActionId; size?: number }) {
  return <>{ICONS[id]({ size })}</>
}

export default function MessageRowActions({ actions, className = '', alwaysVisible }: MessageRowActionsProps) {
  if (!actions.length) return null
  return (
    <div className={`${alwaysVisible ? 'flex' : 'hidden md:flex'} items-center gap-1 ${className}`}>
      {actions.map(a => (
        <button
          key={a.id}
          type="button"
          title={a.label}
          aria-label={a.label}
          onClick={e => { e.stopPropagation(); a.onPress() }}
          className={a.destructive ? btnDanger : btnBase}
        >
          <MessageActionIcon id={a.iconKey} />
        </button>
      ))}
    </div>
  )
}

/** Dark floating-bar variant of icon buttons. */
export function MessageBarIconButton({
  action,
}: {
  action: MessageActionDesc
}) {
  return (
    <button
      type="button"
      title={action.label}
      aria-label={action.label}
      onClick={action.onPress}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors liquid-glass-btn !w-8 !h-8 ${
        action.destructive
          ? '!text-red-500 dark:!text-red-300'
          : ''
      }`}
    >
      <MessageActionIcon id={action.iconKey} size={15} />
    </button>
  )
}
