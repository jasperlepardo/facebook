'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProfileView from './ProfileView'
import PasswordView from './PasswordView'
import HiddenItemsView from './HiddenItemsView'
import PasskeysSection, { type Passkey } from './PasskeysSection'
import { sectionCard, sectionLabel, toggleOn, toggleOff, pbNav } from '@/lib/ui'

type Theme    = 'light' | 'dark' | 'system'
type View     = 'main' | 'profile' | 'password' | 'hidden-items'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SettingsPaneProps {
  showHidden?: boolean
  onToggleShowHidden?: () => void
  hiddenUriCount?: number
  onClearHiddenUris?: () => void
  thread?: string
  senderStyles?: Record<string, { initials: string; color: string }>
  onUnhideMessage?: (id: string) => void
  onUnhideUri?: (uri: string) => void
  onJumpToMessage?: (ts: number, msgId: string, thread?: string) => void
}

interface Stats {
  threads: number
  messages: number
  firstTs: number | null
  lastTs: number | null
}

function SunIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function MoonIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function SystemIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }
function ChevronRight() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400"><path d="M9 18l6-6-6-6"/></svg> }

const sectionCls = sectionCard
const rowCls     = 'flex items-center justify-between px-4 py-3.5'
const labelCls   = 'text-sm text-mist-500 dark:text-mist-400'
const valueCls   = 'text-sm font-medium text-gray-900 dark:text-mist-100 text-right'

function initialsFrom(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?'
}

function fmtDateLong(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtYear(ts: number) {
  return new Date(ts).getFullYear().toString()
}

export default function SettingsPane({
  showHidden, onToggleShowHidden, hiddenUriCount, onClearHiddenUris,
  thread = 'messages', senderStyles, onUnhideMessage, onUnhideUri, onJumpToMessage,
}: SettingsPaneProps) {
  const router = useRouter()
  const [view, setView] = useState<View>('main')

  const [userId, setUserId]         = useState('')
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [nameInput, setNameInput]   = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [profileSave, setProfileSave] = useState<SaveState>('idle')
  const [profileError, setProfileError] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSave, setPwSave]       = useState<SaveState>('idle')
  const [pwError, setPwError]     = useState('')

  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem('theme') as Theme | null) ?? 'system'
  })

  const [signingOut, setSigningOut] = useState(false)

  const profileResetTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pwResetTimer       = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const profileNavTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pwNavTimer         = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => {
    clearTimeout(profileResetTimer.current)
    clearTimeout(pwResetTimer.current)
    clearTimeout(profileNavTimer.current)
    clearTimeout(pwNavTimer.current)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d?.id) return
      setUserId(d.id)
      setName(d.name ?? '')
      setEmail(d.email ?? '')
      setIsSuperAdmin(!!d.superAdmin)
      setPasskeys(d.passkeys ?? [])
    }).catch(() => {})

    fetch('/api/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setStats(d) })
      .catch(() => {})
  }, [])

  async function saveProfile() {
    setProfileSave('saving'); setProfileError('')
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim(), email: emailInput.trim() }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed to save')
      setName(nameInput.trim()); setEmail(emailInput.trim())
      setProfileSave('saved')
      profileNavTimer.current = setTimeout(() => setView('main'), 800)
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : 'Failed to save')
      setProfileSave('error')
      clearTimeout(profileResetTimer.current)
      profileResetTimer.current = setTimeout(() => setProfileSave('idle'), 3000)
    }
  }

  async function changePassword() {
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters'); return }
    setPwSave('saving'); setPwError('')
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed to update')
      setPwSave('saved')
      pwNavTimer.current = setTimeout(() => {
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
        setView('main')
      }, 800)
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
      currentPw={currentPw}
      newPw={newPw}
      confirmPw={confirmPw}
      saveState={pwSave}
      error={pwError}
      onCurrentPwChange={setCurrentPw}
      onNewPwChange={setNewPw}
      onConfirmPwChange={setConfirmPw}
      onSave={changePassword}
      onBack={() => setView('main')}
    />
  )

  if (view === 'hidden-items') {
    return (
      <HiddenItemsView
        onBack={() => setView('main')}
        thread={thread}
        senderStyles={senderStyles}
        onUnhideMessage={onUnhideMessage ?? (() => {})}
        onUnhideUri={onUnhideUri ?? (() => {})}
        onJumpToMessage={onJumpToMessage}
      />
    )
  }

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light',  label: 'Light',  icon: <SunIcon /> },
    { value: 'dark',   label: 'Dark',   icon: <MoonIcon /> },
    { value: 'system', label: 'System', icon: <SystemIcon /> },
  ]

  const archiveSpan = stats?.firstTs && stats?.lastTs
    ? stats.firstTs === stats.lastTs
      ? fmtYear(stats.firstTs)
      : `${fmtYear(stats.firstTs)} – ${fmtYear(stats.lastTs)}`
    : null

  return (
    <div className={`relative flex-1 overflow-y-auto ${pbNav} md:pb-0`}>
      {/* Soft mist wash — light and dark variants */}
      <div
        className="pointer-events-none absolute inset-0 dark:hidden"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(59,130,246,0.08), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(148,163,184,0.12), transparent 50%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 15% 0%, rgba(59,130,246,0.12), transparent 55%), radial-gradient(ellipse 50% 35% at 95% 5%, rgba(255,255,255,0.04), transparent 45%)',
        }}
      />

      <div className="mx-auto w-full max-w-5xl px-5 pt-8 pb-10 md:px-10 md:pt-12 md:pb-14">
        {/* Identity hero */}
        <header className="mb-10 md:mb-14 [animation:fade-up_320ms_ease-out]">
          <div className="flex items-end gap-5 md:gap-7">
            <div className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl md:text-2xl font-bold select-none shadow-[0_8px_28px_rgba(37,99,235,0.28)]">
              {initialsFrom(name)}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-500 dark:text-mist-400 mb-1.5">
                Account
              </p>
              <h1 className="font-display text-3xl md:text-[2.75rem] font-medium leading-[1.1] tracking-tight text-gray-900 dark:text-white truncate">
                {name || 'You'}
              </h1>
              {email && (
                <p className="mt-1.5 text-sm text-mist-500 dark:text-mist-400 truncate">{email}</p>
              )}
              {archiveSpan && (
                <p className="mt-3 text-sm text-mist-400 dark:text-mist-500">
                  Archive span <span className="text-mist-600 dark:text-mist-300 font-medium">{archiveSpan}</span>
                </p>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Account column */}
          <div className="space-y-8 [animation:fade-up_320ms_ease-out] [animation-delay:60ms] [animation-fill-mode:both]">
            <section>
              <h2 className={sectionLabel}>Profile</h2>
              <div className={sectionCls}>
                <div className={rowCls}><span className={labelCls}>Name</span><span className={valueCls}>{name || '—'}</span></div>
                <div className={rowCls}><span className={labelCls}>Email</span><span className={`${valueCls} max-w-[60%] truncate`}>{email || '—'}</span></div>
                <button
                  type="button"
                  onClick={() => { setNameInput(name); setEmailInput(email); setProfileError(''); setProfileSave('idle'); setView('profile') }}
                  className={`${rowCls} w-full liquid-glass-hover transition-[background,box-shadow]`}
                >
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Edit profile</span>
                  <ChevronRight />
                </button>
              </div>
            </section>

            <section>
              <h2 className={sectionLabel}>Security</h2>
              <div className={sectionCls}>
                <div className={rowCls}>
                  <span className={labelCls}>Password</span>
                  <span className="text-sm text-mist-400 dark:text-mist-500 tracking-widest">••••••••</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); setPwSave('idle'); setView('password') }}
                  className={`${rowCls} w-full liquid-glass-hover transition-[background,box-shadow]`}
                >
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Change password</span>
                  <ChevronRight />
                </button>
              </div>
            </section>

            <PasskeysSection
              userId={userId}
              passkeys={passkeys}
              setPasskeys={setPasskeys}
              sectionCls={sectionCls}
              rowCls={rowCls}
              labelCls={labelCls}
            />
          </div>

          {/* Preferences column */}
          <div className="space-y-8 [animation:fade-up_320ms_ease-out] [animation-delay:120ms] [animation-fill-mode:both]">
            <section>
              <h2 className={sectionLabel}>Appearance</h2>
              <div className={sectionCls}>
                <div className="px-4 py-4">
                  <p className="text-sm text-mist-500 dark:text-mist-400 mb-3">Theme</p>
                  <div className="grid grid-cols-3 gap-2">
                    {themeOptions.map(({ value, label, icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => applyTheme(value)}
                        className={`flex flex-col items-center gap-2 py-3.5 rounded-xl transition-colors text-xs font-semibold ${
                          theme === value
                            ? 'bg-blue-600 text-white shadow-[0_6px_20px_rgba(37,99,235,0.28)]'
                            : 'liquid-glass text-mist-500 dark:text-mist-400 liquid-glass-hover'
                        }`}
                      >
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                </div>
                {!!hiddenUriCount && onClearHiddenUris && (
                  <button
                    type="button"
                    onClick={onClearHiddenUris}
                    className={`${rowCls} w-full liquid-glass-hover transition-[background,box-shadow]`}
                  >
                    <span className="text-sm text-gray-900 dark:text-mist-100">Hidden images</span>
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Unhide all ({hiddenUriCount})</span>
                  </button>
                )}
              </div>
            </section>

            {isSuperAdmin && (
              <section>
                <h2 className={sectionLabel}>Super Admin</h2>
                <div className={sectionCls}>
                  <button
                    type="button"
                    onClick={onToggleShowHidden}
                    className={`${rowCls} w-full liquid-glass-hover transition-[background,box-shadow]`}
                  >
                    <span className="text-sm text-gray-900 dark:text-mist-100">Show hidden messages</span>
                    <div className={`w-10 h-6 rounded-full transition-colors ${showHidden ? toggleOn : toggleOff} relative`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showHidden ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('hidden-items')}
                    className={`${rowCls} w-full liquid-glass-hover transition-[background,box-shadow]`}
                  >
                    <span className="text-sm text-gray-900 dark:text-mist-100">Hidden items</span>
                    <ChevronRight />
                  </button>
                  <a
                    href="/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${rowCls} w-full liquid-glass-hover transition-[background,box-shadow]`}
                  >
                    <span className="text-sm text-gray-900 dark:text-mist-100">Payload admin</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </div>
              </section>
            )}

            <section>
              <h2 className={sectionLabel}>Archive</h2>
              <div className={sectionCls}>
                {!!stats?.threads && (
                  <div className={rowCls}>
                    <span className={labelCls}>Conversations</span>
                    <span className={valueCls}>{stats.threads.toLocaleString()}</span>
                  </div>
                )}
                {!!stats?.messages && (
                  <div className={rowCls}>
                    <span className={labelCls}>Messages</span>
                    <span className={valueCls}>{stats.messages.toLocaleString()}</span>
                  </div>
                )}
                {!!stats?.firstTs && (
                  <div className={rowCls}>
                    <span className={labelCls}>First message</span>
                    <span className={valueCls}>{fmtDateLong(stats.firstTs)}</span>
                  </div>
                )}
                {!!stats?.lastTs && (
                  <div className={rowCls}>
                    <span className={labelCls}>Last message</span>
                    <span className={valueCls}>{fmtDateLong(stats.lastTs)}</span>
                  </div>
                )}
                {!stats && (
                  <div className={rowCls}>
                    <span className={labelCls}>Loading archive…</span>
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className={sectionCls}>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  className={`${rowCls} w-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}
                >
                  <span className="text-sm font-medium text-red-500 dark:text-red-400">
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
