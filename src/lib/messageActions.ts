export type MessageActionSurface = 'chat' | 'chat-search' | 'hashtag' | 'gallery'

export type MessageActionId =
  | 'select'
  | 'goToMessage'
  | 'tag'
  | 'copyLink'
  | 'copyText'
  | 'hide'
  | 'unhide'
  | 'remove'

export interface MessageActionDesc {
  id: MessageActionId
  label: string
  iconKey: MessageActionId
  destructive?: boolean
  onPress: () => void
}

export interface MessageActionCallbacks {
  onSelect?: () => void
  onGoToMessage?: () => void
  onTag?: () => void
  onCopyLink?: () => void
  onCopyText?: () => void
  onHide?: () => void
  onUnhide?: () => void
  onRemove?: () => void
}

export interface BuildMessageActionsOpts {
  surface: MessageActionSurface
  /** Number of target messages (1 for row; selection size for bar). */
  count: number
  isSelected?: boolean
  isHidden?: boolean
  isSuperAdmin?: boolean
  callbacks: MessageActionCallbacks
  /** When true, omit select (e.g. floating bar). */
  omitSelect?: boolean
}

export function buildMessageActions(opts: BuildMessageActionsOpts): MessageActionDesc[] {
  const { surface, count, isSelected, isHidden, isSuperAdmin, callbacks, omitSelect } = opts
  const single = count === 1
  const actions: MessageActionDesc[] = []

  const push = (id: MessageActionId, label: string, onPress: (() => void) | undefined, destructive?: boolean) => {
    if (!onPress) return
    actions.push({ id, label, iconKey: id, destructive, onPress })
  }

  if (!omitSelect && (surface === 'chat' || surface === 'chat-search' || surface === 'hashtag')) {
    push('select', isSelected ? 'Deselect' : 'Select', callbacks.onSelect)
  }

  if (surface === 'chat-search' || surface === 'hashtag' || surface === 'gallery') {
    if (single) push('goToMessage', 'Go to message', callbacks.onGoToMessage)
  }

  if (surface === 'chat' || surface === 'chat-search') {
    push('tag', '# Tag', callbacks.onTag)
  }

  if (surface === 'chat' || surface === 'chat-search' || surface === 'hashtag') {
    // Floating bar: always offer Share (first selected), matching the previous bar.
    // Row / sheet: Copy link only for a single target.
    if (omitSelect) push('copyLink', 'Share', callbacks.onCopyLink)
    else if (single) push('copyLink', 'Copy link', callbacks.onCopyLink)
    push('copyText', 'Copy text', callbacks.onCopyText)
  }

  if (surface === 'hashtag') {
    push('remove', 'Remove', callbacks.onRemove, true)
  }

  if (surface === 'gallery' && isSuperAdmin) {
    if (isHidden) push('unhide', 'Unhide', callbacks.onUnhide)
    else push('hide', 'Hide', callbacks.onHide, true)
  }

  if ((surface === 'chat' || surface === 'chat-search' || surface === 'hashtag') && isSuperAdmin) {
    if (isHidden) push('unhide', 'Unhide message', callbacks.onUnhide)
    else push('hide', 'Hide message', callbacks.onHide, true)
  }

  return actions
}

export function actionsToSheet(actions: MessageActionDesc[]) {
  return actions.map(({ label, destructive, onPress }) => ({ label, destructive, onPress }))
}
