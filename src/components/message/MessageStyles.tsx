// Shared design tokens and primitive components for the message rendering system.

export const pill      = 'flex w-fit items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border border-mist-100 dark:border-mist-700/50 bg-mist-50 dark:bg-mist-800/60 select-none'
export const card      = 'rounded-xl border border-mist-100 dark:border-mist-700/50 bg-mist-50/50 dark:bg-mist-800/30'
export const pillIcon  = 'shrink-0 text-mist-300 dark:text-mist-600'
export const pillLabel = 'text-mist-500 dark:text-mist-400 font-medium'
export const pillSub   = 'text-mist-300 dark:text-mist-600'
export const iconWell  = 'w-7 h-7 rounded-lg bg-mist-100 dark:bg-mist-800 flex items-center justify-center shrink-0 text-mist-400 dark:text-mist-500'

/** Dense archive log — compact rows, selection chrome on hover. */
export const rowBase   = 'group/row flex items-start px-4 py-1 gap-3 cursor-pointer select-none transition-colors'
export const rowSel    = 'bg-blue-50! dark:bg-blue-950/30!'
export const rowUnsel  = '[@media(hover:hover)]:hover:bg-mist-50 dark:[@media(hover:hover)]:hover:bg-mist-800 active:bg-mist-100 dark:active:bg-mist-800/60'
export const timeCls   = 'text-[11px] text-mist-400 dark:text-mist-500 leading-6 opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 transition-opacity'
export const actionsCls = (sel: boolean) =>
  `flex items-center gap-1 self-start pt-0.5 transition-opacity ${sel ? 'opacity-100' : 'opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100'}`

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
