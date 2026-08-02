'use client'

import { field, btnPrimary, label, pbNav } from '@/lib/ui'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
}

interface Props {
  nameInput: string
  emailInput: string
  saveState: SaveState
  error: string
  onNameChange: (v: string) => void
  onEmailChange: (v: string) => void
  onSave: () => void
  onBack: () => void
}

export default function ProfileView({ nameInput, emailInput, saveState, error, onNameChange, onEmailChange, onSave, onBack }: Props) {
  return (
    <div className={`relative flex-1 overflow-y-auto ${pbNav} md:pb-0`}>
      <div className="mx-auto w-full max-w-lg px-5 pt-8 pb-10 md:px-10 md:pt-12 [animation:fade-up_280ms_ease-out]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-mist-500 dark:text-mist-400 hover:text-mist-700 dark:hover:text-mist-200 mb-8"
        >
          <BackIcon /> Back
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500 dark:text-mist-400 mb-2">
          Profile
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight text-gray-900 dark:text-white mb-8">
          Edit profile
        </h1>
        <div className="liquid-glass rounded-2xl p-5 md:p-6 space-y-4">
          <div>
            <label className={label}>Name</label>
            <input type="text" value={nameInput} onChange={e => onNameChange(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" value={emailInput} onChange={e => onEmailChange(e.target.value)} className={field} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === 'saving'}
            className={`${btnPrimary} ${saveState === 'saved' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
