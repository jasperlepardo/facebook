/** Shared UI class tokens — mist for chrome, blue for brand/CTA. */

export const field =
  'liquid-glass-input w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 dark:text-mist-100 placeholder:text-mist-400 dark:placeholder:text-mist-500'

export const fieldQuiet =
  'liquid-glass-input w-full px-3 py-2 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-mist-400'

/** @deprecated Prefer headerField — kept as alias for search-shaped glass inputs. */
export const fieldSearch = 'liquid-glass-field'

export const btnPrimary =
  'w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors'

export const btnPrimaryInline =
  'inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors'

export const btnSecondary =
  'liquid-glass w-full py-2.5 rounded-xl text-sm font-medium text-mist-700 dark:text-mist-200 liquid-glass-hover disabled:opacity-50 transition-colors'

export const btnSecondaryInline =
  'liquid-glass inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-mist-200 liquid-glass-hover disabled:opacity-50 transition-colors'

export const btnGhost =
  'liquid-glass py-2.5 rounded-xl text-sm font-semibold text-mist-500 dark:text-mist-400 liquid-glass-hover transition-colors'

export const menu =
  'liquid-glass rounded-xl shadow-lg py-1 z-50 min-w-[150px] overflow-hidden'

export const menuItem =
  'w-full text-left px-3.5 py-2 text-sm text-gray-800 dark:text-mist-100 liquid-glass-hover select-none cursor-pointer'

export const menuItemDanger =
  'w-full text-left px-3.5 py-2 text-sm text-red-500 liquid-glass-hover select-none cursor-pointer'

export const label =
  'block text-sm font-medium text-mist-700 dark:text-mist-300 mb-1'

export const labelUpper =
  'text-xs font-semibold uppercase tracking-wide text-mist-500 dark:text-mist-400'

export const brandMark =
  'w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center'

export const linkAccent =
  'text-blue-600 dark:text-blue-400 font-medium hover:underline'

export const toggleOn = 'bg-blue-600'
export const toggleOff = 'bg-mist-300 dark:bg-mist-600'

export const sectionCard =
  'liquid-glass rounded-xl overflow-hidden divide-y divide-black/10 dark:divide-white/12'

export const sectionLabel =
  'text-xs font-semibold uppercase tracking-wide text-mist-500 dark:text-mist-400 mb-2 px-1'

/** Auth / standalone form shell */
export const glassPanel =
  'liquid-glass rounded-3xl p-6 md:p-8 w-full'

/** Header icon / back control — Apple liquid-glass circle (see globals.css). */
export const headerBtn = 'liquid-glass-btn'
export const headerBtnActive = 'liquid-glass-btn liquid-glass-btn-active'
export const headerChip = 'liquid-glass-btn liquid-glass-chip'
export const headerField = 'liquid-glass-field'
export const glassHover = 'liquid-glass-hover'
export const glassSelected = 'liquid-glass-selected'

/** Floating toast / snackbar — clears floating nav on mobile, standard offset on md+ */
export const toastPill =
  'fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--resibo-nav-clearance)+0.75rem)] md:bottom-6 liquid-glass text-gray-900 dark:text-white text-sm px-4 py-2 rounded-full shadow-xl pointer-events-none z-[400] max-w-[calc(100vw-2rem)]'

/** Empty-state icon well */
export const emptyWell =
  'liquid-glass flex items-center justify-center text-mist-400 dark:text-mist-500'

/**
 * Bottom padding tokens (PWA / iOS home indicator). Pair with `md:pb-*` at the call site.
 * `md` is remapped to 1024px (floating nav below; sidebar from small desktop up).
 * - pbNav: floating capsule is visible (list, story)
 * - pbSafe: nav hidden (chat/hashtag detail, settings, media overlay)
 */
export const pbNav  = 'pb-[var(--resibo-nav-clearance)]'
export const pbSafe = 'pb-[var(--resibo-safe-bottom)]'
