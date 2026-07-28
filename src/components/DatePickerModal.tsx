'use client'
import { useRef, useState } from 'react'

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
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900 px-6 py-5 w-72 flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Jump to date</h2>
        <input
          ref={inputRef}
          type="date"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-[14px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >Cancel</button>
          <button
            onClick={submit}
            disabled={!value}
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >Jump</button>
        </div>
      </div>
    </div>
  )
}
