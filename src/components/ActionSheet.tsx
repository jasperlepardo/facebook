'use client'
import { useEffect } from 'react'

export interface ActionSheetAction {
  label: string
  destructive?: boolean
  onPress: () => void
}

interface ActionSheetProps {
  title?: string
  actions: ActionSheetAction[]
  onClose: () => void
}

export default function ActionSheet({ title, actions, onClose }: ActionSheetProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-300 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 px-3 pb-[max(0.75rem,var(--resibo-safe-bottom))] flex flex-col gap-2">
        <div className="liquid-glass rounded-2xl overflow-hidden">
          {title && (
            <div className="px-6 pt-3.5 pb-2.5 text-center text-[13px] text-mist-500 dark:text-mist-400 border-b border-mist-100 dark:border-white/8">
              {title}
            </div>
          )}
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onPress(); onClose() }}
              className={`w-full py-[14px] text-[17px] text-center border-b border-mist-100 dark:border-white/8 last:border-0 liquid-glass-hover ${action.destructive ? 'text-red-500' : 'text-mist-700 dark:text-mist-200'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="liquid-glass rounded-2xl overflow-hidden">
          <button
            onClick={onClose}
            className="w-full py-[14px] text-[17px] font-semibold text-mist-700 dark:text-mist-200 text-center liquid-glass-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
