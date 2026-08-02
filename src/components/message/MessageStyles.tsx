// Shared design tokens and primitive components for the message rendering system.

export const pill      = 'flex w-fit items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg liquid-glass select-none'
export const card      = 'rounded-xl liquid-glass'
export const pillIcon  = 'shrink-0 text-mist-400 dark:text-mist-500'
export const pillLabel = 'text-mist-600 dark:text-mist-300 font-medium'
export const pillSub   = 'text-mist-400 dark:text-mist-500'
export const iconWell  = 'w-7 h-7 rounded-lg liquid-glass flex items-center justify-center shrink-0 text-mist-400 dark:text-mist-500'

/** Dense archive log — compact rows with an inline select checkbox. */
export const rowBase   = 'group/row relative flex items-start pl-4 pr-3 py-1 gap-3 cursor-pointer select-none transition-[background,box-shadow] rounded-lg mx-1'
export const rowSel    = 'liquid-glass-selected'
export const rowUnsel  = 'liquid-glass-hover'
export const timeCls   = 'text-[11px] text-mist-400 dark:text-mist-500 leading-6 opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 transition-opacity'
/** Inline select checkbox — actions live on the floating selection bar / ActionSheet. */
export const selectCls = (sel: boolean) =>
  `shrink-0 self-start mt-1 transition-opacity ${
    sel
      ? 'opacity-100'
      : 'opacity-0 pointer-events-none [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-hover/row:pointer-events-auto'
  }`
export function StatusPill({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
  return (
    <span className={pill}>
      <span className={pillIcon}>{icon}</span>
      <span>
        <span className={pillLabel}>{label}</span>
        {sublabel && <span className={`${pillSub} ml-1`}>· {sublabel}</span>}
      </span>
    </span>
  )
}
