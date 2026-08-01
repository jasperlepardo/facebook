'use client'

import { field, btnPrimary, label, pbNav } from '@/lib/ui'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
}

interface Props {
  newPw: string
  confirmPw: string
  saveState: SaveState
  error: string
  onNewPwChange: (v: string) => void
  onConfirmPwChange: (v: string) => void
  onSave: () => void
  onBack: () => void
}

export default function PasswordView({ newPw, confirmPw, saveState, error, onNewPwChange, onConfirmPwChange, onSave, onBack }: Props) {
  return (
    <div className={`flex-1 overflow-y-auto liquid-glass-atmosphere ${pbNav} md:pb-0`}>
      <div className="px-4 py-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-mist-500 dark:text-mist-400 hover:text-mist-700 dark:hover:text-mist-200 mb-6">
          <BackIcon /> Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-mist-100 mb-6">Change password</h1>
        <div className="liquid-glass rounded-2xl p-5 space-y-4">
          <div>
            <label className={label}>New password</label>
            <input type="password" value={newPw} onChange={e => onNewPwChange(e.target.value)} placeholder="••••••••" className={field} />
          </div>
          <div>
            <label className={label}>Confirm new password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => onConfirmPwChange(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => { if (e.key === 'Enter') onSave() }}
              className={field}
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={onSave}
            disabled={saveState === 'saving' || !newPw}
            className={`${btnPrimary} ${saveState === 'saved' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          >
            {saveState === 'saving' ? 'Updating…' : saveState === 'saved' ? 'Updated!' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  )
}
