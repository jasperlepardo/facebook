'use client'
import { CONTENT_TYPES, ContentTypeKey, ALL_CONTENT_TYPE_KEYS } from '@/lib/contentTypes'

interface Props {
  enabledTypes: Set<ContentTypeKey>
  onChange: (key: ContentTypeKey, enabled: boolean) => void
  onReset: () => void
  hideImages?: boolean
  onHideImagesChange?: (v: boolean) => void
  showHidden?: boolean
  onShowHiddenChange?: () => void
  compact?: boolean
}

export default function ChatViewSettingsList({
  enabledTypes, onChange, onReset, hideImages, onHideImagesChange,
  showHidden, onShowHiddenChange, compact,
}: Props) {
  const allOn = ALL_CONTENT_TYPE_KEYS.every(k => enabledTypes.has(k))
  const pad = compact ? 'px-4 py-3' : 'px-5 py-3'
  const row = `flex items-center justify-between gap-3 ${pad} cursor-pointer liquid-glass-hover`

  return (
    <div className="divide-y divide-black/10 dark:divide-white/12">
      <label className={row}>
        <span className="text-sm font-semibold text-gray-900 dark:text-mist-100">All content types</span>
        <Toggle on={allOn} onChange={on => ALL_CONTENT_TYPE_KEYS.forEach(k => onChange(k, on))} />
      </label>
      {CONTENT_TYPES.map(({ key, label }) => (
        <label key={key} className={row}>
          <span className="text-sm text-gray-900 dark:text-mist-100">{label}</span>
          <Toggle on={enabledTypes.has(key)} onChange={on => onChange(key, on)} />
        </label>
      ))}
      {onHideImagesChange != null && (
        <label className={row}>
          <span className="text-sm text-gray-900 dark:text-mist-100">Hide images</span>
          <Toggle on={!!hideImages} onChange={onHideImagesChange} />
        </label>
      )}
      {onShowHiddenChange != null && (
        <label className={row}>
          <span className="text-sm text-gray-900 dark:text-mist-100">Show hidden messages</span>
          <Toggle on={!!showHidden} onChange={() => onShowHiddenChange()} />
        </label>
      )}
      <div className={pad}>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-mist-500 hover:text-mist-700 dark:hover:text-mist-300 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={e => { e.preventDefault(); onChange(!on) }}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-blue-600' : 'bg-mist-200 dark:bg-mist-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}
