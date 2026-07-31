'use client'

interface Tab<T extends string> {
  key: T
  label: string
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[]
  active: T
  onChange: (key: T) => void
  scrollable?: boolean
}

export default function Tabs<T extends string>({ tabs, active, onChange, scrollable }: TabsProps<T>) {
  return (
    <div className={`flex border-b border-mist-200 dark:border-mist-700 shrink-0 bg-white dark:bg-mist-900 ${scrollable ? 'overflow-x-auto scrollbar-none' : ''}`}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px select-none transition-colors shrink-0 hover:bg-mist-50 dark:hover:bg-mist-800 ${active === t.key ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-mist-500 dark:text-mist-400 border-transparent'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
