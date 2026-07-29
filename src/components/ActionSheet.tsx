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

  return (
    <div className="fixed inset-0 z-300 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl overflow-hidden">
          {title && (
            <div className="px-6 pt-3.5 pb-2.5 text-center text-[13px] text-gray-500 dark:text-gray-400 border-b border-black/8 dark:border-white/8">
              {title}
            </div>
          )}
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onPress(); onClose() }}
              className={`w-full py-[14px] text-[17px] text-center border-b border-black/8 dark:border-white/8 last:border-0 active:bg-black/5 dark:active:bg-white/5 transition-colors ${action.destructive ? 'text-red-500' : 'text-mist-600 dark:text-mist-400'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl overflow-hidden">
          <button
            onClick={onClose}
            className="w-full py-[14px] text-[17px] font-semibold text-mist-600 dark:text-mist-400 text-center active:bg-black/5 dark:active:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
