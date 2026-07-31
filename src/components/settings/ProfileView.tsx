'use client'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-mist-700 rounded-xl text-sm bg-white dark:bg-mist-900 text-gray-900 dark:text-mist-100 focus:outline-hidden focus:ring-2 focus:ring-mist-500'

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
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-mist-900">
      <div className="px-4 py-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-mist-400 hover:text-mist-700 dark:hover:text-mist-200 mb-6">
          <BackIcon /> Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-mist-100 mb-6">Edit profile</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-mist-300 mb-1">Name</label>
            <input type="text" value={nameInput} onChange={e => onNameChange(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-mist-300 mb-1">Email</label>
            <input type="email" value={emailInput} onChange={e => onEmailChange(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={onSave}
            disabled={saveState === 'saving'}
            className={`w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors ${saveState === 'saved' ? 'bg-green-600 text-white' : 'bg-mist-600 hover:bg-mist-700 text-white'}`}
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
