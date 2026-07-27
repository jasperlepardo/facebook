'use client'
import { useEffect, useState } from 'react'
import { DateIndex } from '@/types'

type Theme = 'light' | 'dark' | 'system'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}

interface SettingsPaneProps {
  total: number
  dateIndex: DateIndex | null
  currentUser: string
}

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors'
const btnCls = 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors'

export default function SettingsPane({ total, dateIndex, currentUser }: SettingsPaneProps) {
  // Theme
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem('theme') as Theme | null) ?? 'system'
  })

  function applyTheme(t: Theme) {
    setTheme(t)
    if (t === 'system') {
      localStorage.removeItem('theme')
      document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
    } else {
      localStorage.setItem('theme', t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
  }

  // Profile
  const [userId, setUserId] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [profileSave, setProfileSave] = useState<SaveState>('idle')
  const [profileError, setProfileError] = useState('')

  // Password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSave, setPwSave] = useState<SaveState>('idle')
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => {
        if (!d?.user) return
        setUserId(d.user.id ?? '')
        setNameInput(d.user.name ?? '')
        setEmailInput(d.user.email ?? '')
      })
      .catch(() => {})
  }, [])

  async function saveProfile() {
    if (!userId) return
    setProfileSave('saving'); setProfileError('')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim(), email: emailInput.trim() }),
      })
      if (!res.ok) throw new Error((await res.json())?.errors?.[0]?.message ?? 'Failed to save')
      setProfileSave('saved')
      setTimeout(() => setProfileSave('idle'), 2000)
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : 'Failed to save')
      setProfileSave('error')
      setTimeout(() => setProfileSave('idle'), 3000)
    }
  }

  async function changePassword() {
    if (!userId) return
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters'); return }
    setPwSave('saving'); setPwError('')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPw }),
      })
      if (!res.ok) throw new Error((await res.json())?.errors?.[0]?.message ?? 'Failed to update password')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwSave('saved')
      setTimeout(() => setPwSave('idle'), 2000)
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Failed to update password')
      setPwSave('error')
      setTimeout(() => setPwSave('idle'), 3000)
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const firstDate = dateIndex?.days[0]?.iso
  const lastDate  = dateIndex?.days[dateIndex.days.length - 1]?.iso

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light',  label: 'Light',  icon: <SunIcon /> },
    { value: 'dark',   label: 'Dark',   icon: <MoonIcon /> },
    { value: 'system', label: 'System', icon: <SystemIcon /> },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* Profile */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Profile</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className={inputCls} />
            </div>
            {profileError && <p className="text-xs text-red-500">{profileError}</p>}
            <button
              onClick={saveProfile}
              disabled={profileSave === 'saving'}
              className={`${btnCls} ${profileSave === 'saved' ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}
            >
              {profileSave === 'saving' ? 'Saving…' : profileSave === 'saved' ? 'Saved!' : 'Save'}
            </button>
          </div>
        </section>

        {/* Password */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Password</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confirm new password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') changePassword() }}
                className={inputCls} />
            </div>
            {pwError && <p className="text-xs text-red-500">{pwError}</p>}
            <button
              onClick={changePassword}
              disabled={pwSave === 'saving' || !newPw}
              className={`${btnCls} ${pwSave === 'saved' ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}
            >
              {pwSave === 'saving' ? 'Updating…' : pwSave === 'saved' ? 'Updated!' : 'Change password'}
            </button>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Appearance</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-3">Theme</p>
            <div className="flex gap-2">
              {themeOptions.map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => applyTheme(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-colors text-xs font-semibold ${
                    theme === value
                      ? 'border-blue-600 text-blue-600 bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">About</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
            {currentUser && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">Viewing as</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{currentUser}</span>
              </div>
            )}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">Messages</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{total.toLocaleString()}</span>
              </div>
            )}
            {firstDate && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">First message</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{fmt(firstDate)}</span>
              </div>
            )}
            {lastDate && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">Last message</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{fmt(lastDate)}</span>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
