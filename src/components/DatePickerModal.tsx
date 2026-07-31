'use client'
import { useRef, useState } from 'react'
import { field, btnPrimary, btnGhost } from '@/lib/ui'

interface DatePickerModalProps {
  onClose: () => void
  onJump: (date: string) => void
  defaultDate?: string
}

export default function DatePickerModal({ onClose, onJump, defaultDate = '' }: DatePickerModalProps) {
  const [value, setValue] = useState(defaultDate)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    if (!value) return
    onJump(value)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white dark:bg-mist-800 rounded-2xl shadow-2xl dark:shadow-black/40 px-6 py-5 w-72 flex flex-col gap-4 border border-mist-100 dark:border-mist-700">
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-mist-100">Jump to date</h2>
        <input
          ref={inputRef}
          type="date"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          className={field}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className={`px-4 ${btnGhost} w-auto`}>Cancel</button>
          <button
            onClick={submit}
            disabled={!value}
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >Jump</button>
        </div>
      </div>
    </div>
  )
}
