'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration } from '@simplewebauthn/browser'
import { DateIndex } from '@/types'
import ProfileView from './settings/ProfileView'
import PasswordView from './settings/PasswordView'
import HiddenItemsView from './settings/HiddenItemsView'

type Theme    = 'light' | 'dark' | 'system'
type View     = 'main' | 'profile' | 'password' | 'hidden-items'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SettingsPaneProps {
  total: number
  dateIndex: DateIndex | null
  currentUser: string
  isSuperAdmin?: boolean
  showHidden?: boolean
  onToggleShowHidden?: () => void
  hiddenUriCount?: number
  onClearHiddenUris?: () => void
}

function SunIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function MoonIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function SystemIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }
function ChevronRight() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M9 18l6-6-6-6"/></svg> }

const sectionCls = 'bg-white dark:bg-mist-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700'
const rowCls     = 'flex items-center justify-between px-4 py-3'
const labelCls   = 'text-sm text-gray-500 dark:text-mist-400'
const valueCls   = 'text-sm font-medium text-gray-900 dark:text-mist-100'

export default function SettingsPane({ total, dateIndex, currentUser, isSuperAdmin, showHidden, onToggleShowHidden, hiddenUriCount, onClearHiddenUris }: SettingsPaneProps) {
  const router = useRouter()
  const [view, setView] = useState<View>('main')

  // Profile state
  const [userId, setUserId]         = useState('')
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [nameInput, setNameInput]   = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [profileSave, setProfileSave] = useState<SaveState>('idle')
  const [profileError, setProfileError] = useState('')

  // Password state
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSave, setPwSave]       = useState<SaveState>('idle')
  const [pwError, setPwError]     = useState('')

  // Passkey state
  const [passkeys, setPasskeys] = useState<{
    credentialID: string; deviceType: string; backedUp: boolean
    transports?: string; counter?: number; createdAt?: string; lastUsedAt?: string; nickname?: string
  }[]>([])
  const [editingNickname, setEditingNickname] = useState<string | null>(null)
  const [nicknameInput, setNicknameInput]     = useState('')
  const [passkeyStatus, setPasskeyStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [passkeyError, setPasskeyError]       = useState('')

  // Theme state
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem('theme') as Theme | null) ?? 'system'
  })

  const [signingOut, setSigningOut] = useState(false)

  const profileResetTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pwResetTimer       = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const passkeyResetTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d?.id) return
      setUserId(d.id)
      setName(d.name ?? '')
      setEmail(d.email ?? '')
      setPasskeys(d.passkeys ?? [])
    })
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
      setName(nameInput.trim()); setEmail(emailInput.trim())
      setProfileSave('saved')
      setTimeout(() => setView('main'), 800)
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : 'Failed to save')
      setProfileSave('error')
      clearTimeout(profileResetTimer.current)
      profileResetTimer.current = setTimeout(() => setProfileSave('idle'), 3000)
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
      if (!res.ok) throw new Error((await res.json())?.errors?.[0]?.message ?? 'Failed to update')
      setPwSave('saved')
      setTimeout(() => setView('main'), 800)
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Failed to update')
      setPwSave('error')
      clearTimeout(pwResetTimer.current)
      pwResetTimer.current = setTimeout(() => setPwSave('idle'), 3000)
    }
  }

  function applyTheme(t: Theme) {
    setTheme(t)
    if (t === 'system') {
      localStorage.removeItem('theme')
      document.cookie = 'theme=; path=/; max-age=0; samesite=lax'
      document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
    } else {
      localStorage.setItem('theme', t)
      document.cookie = `theme=${t}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
  }

  async function signOut() {
    setSigningOut(true)
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/auth/signin')
  }

  async function addPasskey() {
    if (!userId) return
    setPasskeyStatus('loading'); setPasskeyError('')
    try {
      const optRes = await fetch(`/api/auth/passkey/register-options?userId=${userId}`)
      if (!optRes.ok) throw new Error('Failed to get options')
      const options = await optRes.json()
      const credential = await startRegistration({ optionsJSON: options })
      const verRes = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credential }),
      })
      const data = await verRes.json()
      if (!verRes.ok) throw new Error(data.error)
      setPasskeyStatus('success')
      const me = await fetch('/api/auth/me').then(r => r.json())
      setPasskeys(me.passkeys ?? [])
      setTimeout(() => setPasskeyStatus('idle'), 2000)
    } catch (e: unknown) {
      const err = e instanceof Error ? e : null
      setPasskeyError(err?.name === 'NotAllowedError' ? 'Cancelled.' : err?.message || 'Failed')
      setPasskeyStatus('error')
      clearTimeout(passkeyResetTimer.current)
      passkeyResetTimer.current = setTimeout(() => setPasskeyStatus('idle'), 3000)
    }
  }

  const fmtDateLong = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const fmtDateShort = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null
  const firstDate = dateIndex?.days[0]?.iso
  const lastDate  = dateIndex?.days[dateIndex.days.length - 1]?.iso

  // ─── Sub-views ───────────────────────────────────────────────────────────────

  if (view === 'profile') return (
    <ProfileView
      nameInput={nameInput}
      emailInput={emailInput}
      saveState={profileSave}
      error={profileError}
      onNameChange={setNameInput}
      onEmailChange={setEmailInput}
      onSave={saveProfile}
      onBack={() => setView('main')}
    />
  )

  if (view === 'password') return (
    <PasswordView
      newPw={newPw}
      confirmPw={confirmPw}
      saveState={pwSave}
      error={pwError}
      onNewPwChange={setNewPw}
      onConfirmPwChange={setConfirmPw}
      onSave={changePassword}
      onBack={() => setView('main')}
    />
  )

  if (view === 'hidden-items') return <HiddenItemsView onBack={() => setView('main')} />

  // ─── Main view ───────────────────────────────────────────────────────────────

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light',  label: 'Light',  icon: <SunIcon /> },
    { value: 'dark',   label: 'Dark',   icon: <MoonIcon /> },
    { value: 'system', label: 'System', icon: <SystemIcon /> },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-mist-900">
      <div className="px-4 py-6 space-y-6">

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-mist-500 mb-2 px-1">Profile</h2>
          <div className={sectionCls}>
            <div className={rowCls}><span className={labelCls}>Name</span><span className={valueCls}>{name || '—'}</span></div>
            <div className={rowCls}><span className={labelCls}>Email</span><span className={valueCls}>{email || '—'}</span></div>
            <button onClick={() => { setNameInput(name); setEmailInput(email); setProfileError(''); setProfileSave('idle'); setView('profile') }}
              className={`${rowCls} w-full hover:bg-mist-50 dark:hover:bg-mist-700/50 transition-colors`}>
              <span className="text-sm text-mist-600 dark:text-mist-400 font-medium">Edit profile</span>
              <ChevronRight />
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-mist-500 mb-2 px-1">Security</h2>
          <div className={sectionCls}>
            <div className={rowCls}><span className={labelCls}>Password</span><span className="text-sm text-gray-400 dark:text-mist-500 tracking-widest">••••••••</span></div>
            <button onClick={() => { setNewPw(''); setConfirmPw(''); setPwError(''); setPwSave('idle'); setView('password') }}
              className={`${rowCls} w-full hover:bg-mist-50 dark:hover:bg-mist-700/50 transition-colors`}>
              <span className="text-sm text-mist-600 dark:text-mist-400 font-medium">Change password</span>
              <ChevronRight />
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-mist-500 mb-2 px-1">Passkeys</h2>
          <div className={sectionCls}>
            {passkeys.length === 0 && (
              <div className={rowCls}><span className={labelCls}>No passkeys registered</span></div>
            )}
            {passkeys.map(pk => {
              const transports: string[] = pk.transports ? (() => { try { return JSON.parse(pk.transports!) } catch { return [] } })() : []
              const isInternal = transports.includes('internal')
              const isHybrid   = transports.includes('hybrid')
              const transportLabel = isInternal ? 'Face ID / Touch ID' : isHybrid ? 'Phone or tablet' : transports.includes('usb') ? 'Security key' : pk.deviceType === 'multiDevice' ? 'Synced passkey' : 'Passkey'
              const isEditing  = editingNickname === pk.credentialID

              async function saveNickname(val: string) {
                await fetch('/api/auth/passkey/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ credentialID: pk.credentialID, nickname: val }),
                })
                setPasskeys(prev => prev.map(p => p.credentialID === pk.credentialID ? { ...p, nickname: val } : p))
                setEditingNickname(null)
              }

              return (
                <div key={pk.credentialID} className={`${rowCls} gap-3`}>
                  <div className="w-8 h-8 rounded-lg bg-mist-100 dark:bg-mist-900/40 flex items-center justify-center shrink-0">
                    {isInternal ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mist-600 dark:text-mist-400"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 16v2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                    ) : isHybrid ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mist-600 dark:text-mist-400"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mist-600 dark:text-mist-400"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input autoFocus value={nicknameInput} onChange={e => setNicknameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNickname(nicknameInput); if (e.key === 'Escape') setEditingNickname(null) }}
                        onBlur={() => saveNickname(nicknameInput)}
                        placeholder={transportLabel}
                        className="text-sm font-medium bg-transparent border-b border-mist-400 outline-hidden text-gray-900 dark:text-mist-100 w-full" />
                    ) : (
                      <button onClick={() => { setNicknameInput(pk.nickname ?? ''); setEditingNickname(pk.credentialID) }}
                        className="text-sm font-medium text-gray-900 dark:text-mist-100 hover:text-mist-600 dark:hover:text-mist-400 text-left group flex items-center gap-1">
                        {pk.nickname || transportLabel}
                        <svg className="opacity-0 group-hover:opacity-50" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                    <p className="text-xs text-gray-400 dark:text-mist-500 mt-0.5 flex flex-wrap gap-x-1.5">
                      <span>{transportLabel}</span>
                      {pk.createdAt  && <><span>·</span><span>Added {fmtDateShort(pk.createdAt)}</span></>}
                      {pk.lastUsedAt && <><span>·</span><span>Used {fmtDateShort(pk.lastUsedAt)}</span></>}
                      {typeof pk.counter === 'number' && <><span>·</span><span>{pk.counter}×</span></>}
                      {pk.backedUp   && <><span>·</span><span>Backed up</span></>}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await fetch('/api/auth/passkey/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialID: pk.credentialID }) })
                      setPasskeys(prev => prev.filter(p => p.credentialID !== pk.credentialID))
                    }}
                    className="text-xs text-red-400 hover:text-red-600 shrink-0"
                  >Remove</button>
                </div>
              )
            })}
            <div className={rowCls}>
              {passkeyError && <p className="text-xs text-red-500 mr-2">{passkeyError}</p>}
              <button onClick={addPasskey} disabled={passkeyStatus === 'loading' || !userId}
                className="text-sm text-mist-600 dark:text-mist-400 font-medium disabled:opacity-50">
                {passkeyStatus === 'loading' ? 'Waiting…' : passkeyStatus === 'success' ? 'Passkey added!' : '+ Add passkey'}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-mist-500 mb-2 px-1">Appearance</h2>
          <div className={sectionCls}>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-500 dark:text-mist-400 mb-3">Theme</p>
              <div className="flex gap-2">
                {themeOptions.map(({ value, label, icon }) => (
                  <button key={value} onClick={() => applyTheme(value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-colors text-xs font-semibold ${
                      theme === value
                        ? 'border-mist-600 text-mist-600 bg-mist-50 dark:border-mist-400 dark:text-mist-400 dark:bg-mist-900/30'
                        : 'border-gray-200 dark:border-mist-700 text-gray-500 dark:text-mist-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}>
                    {icon}{label}
                  </button>
                ))}
              </div>
            </div>
            {!!hiddenUriCount && onClearHiddenUris && (
              <button onClick={onClearHiddenUris} className={`${rowCls} w-full hover:bg-mist-50 dark:hover:bg-mist-700/50 transition-colors`}>
                <span className="text-sm text-gray-900 dark:text-mist-100">Hidden images</span>
                <span className="text-sm text-mist-600 dark:text-mist-400 font-medium">Unhide all ({hiddenUriCount})</span>
              </button>
            )}
          </div>
        </section>

        {isSuperAdmin && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-mist-500 mb-2 px-1">Super Admin</h2>
            <div className={sectionCls}>
              <button onClick={onToggleShowHidden} className={`${rowCls} w-full hover:bg-mist-50 dark:hover:bg-mist-700/50 transition-colors`}>
                <span className="text-sm text-gray-900 dark:text-mist-100">Show hidden messages</span>
                <div className={`w-10 h-6 rounded-full transition-colors ${showHidden ? 'bg-mist-600' : 'bg-gray-300 dark:bg-gray-600'} relative`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showHidden ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </button>
              <button onClick={() => setView('hidden-items')} className={`${rowCls} w-full hover:bg-mist-50 dark:hover:bg-mist-700/50 transition-colors`}>
                <span className="text-sm text-gray-900 dark:text-mist-100">Hidden items</span>
                <ChevronRight />
              </button>
              <a href="/admin" target="_blank" rel="noopener noreferrer" className={`${rowCls} w-full hover:bg-mist-50 dark:hover:bg-mist-700/50 transition-colors`}>
                <span className="text-sm text-gray-900 dark:text-mist-100">Payload admin</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-mist-500 mb-2 px-1">About</h2>
          <div className={sectionCls}>
            {currentUser && <div className={rowCls}><span className={labelCls}>Viewing as</span><span className={valueCls}>{currentUser}</span></div>}
            {total > 0 && <div className={rowCls}><span className={labelCls}>Messages</span><span className={valueCls}>{total.toLocaleString()}</span></div>}
            {firstDate && <div className={rowCls}><span className={labelCls}>First message</span><span className={valueCls}>{fmtDateLong(firstDate)}</span></div>}
            {lastDate  && <div className={rowCls}><span className={labelCls}>Last message</span><span className={valueCls}>{fmtDateLong(lastDate)}</span></div>}
          </div>
        </section>

        <section>
          <div className={sectionCls}>
            <button onClick={signOut} disabled={signingOut} className={`${rowCls} w-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}>
              <span className="text-sm font-medium text-red-500 dark:text-red-400">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
