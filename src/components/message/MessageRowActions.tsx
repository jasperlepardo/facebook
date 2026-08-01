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
  'inline-flex items-center justify-center w-7 h-7 rounded-md border border-mist-200 dark:border-mist-600 bg-white dark:bg-mist-800 text-mist-600 dark:text-mist-300 shadow-xs hover:bg-mist-50 dark:hover:bg-mist-700 transition-colors'

const btnDanger = `${btnBase} text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40`

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
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
        action.destructive
          ? 'bg-red-500/20 hover:bg-red-500/30 text-red-200'
          : 'bg-white/15 hover:bg-white/25 text-white'
      }`}
    >
      <MessageActionIcon id={action.iconKey} size={15} />
    </button>
  )
}
