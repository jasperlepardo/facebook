'use client'
import { useRef, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { sectionLabel } from '@/lib/ui'

export type Passkey = {
  credentialID: string
  deviceType: string
  backedUp: boolean
  transports?: string
  counter?: number
  createdAt?: string
  lastUsedAt?: string
  nickname?: string
}

interface PasskeysSectionProps {
  userId: string
  passkeys: Passkey[]
  setPasskeys: React.Dispatch<React.SetStateAction<Passkey[]>>
  sectionCls: string
  rowCls: string
  labelCls: string
}

function fmtDateShort(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null
}

export default function PasskeysSection({
  userId, passkeys, setPasskeys, sectionCls, rowCls, labelCls,
}: PasskeysSectionProps) {
  const [editingNickname, setEditingNickname] = useState<string | null>(null)
  const [nicknameInput, setNicknameInput]     = useState('')
  const [confirmRemove, setConfirmRemove]     = useState<string | null>(null)
  const [passkeyStatus, setPasskeyStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [passkeyError, setPasskeyError]       = useState('')
  const passkeyResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  return (
    <section>
      <h2 className={sectionLabel}>Passkeys</h2>
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
              <div className="w-8 h-8 rounded-lg liquid-glass flex items-center justify-center shrink-0">
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
                {confirmRemove === pk.credentialID && passkeys.length === 1 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Your last passkey — you will sign in with your password.</p>
                )}
              </div>
              {confirmRemove === pk.credentialID ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setConfirmRemove(null)} className="text-xs text-mist-500 dark:text-mist-400">Cancel</button>
                  <button
                    onClick={async () => {
                      setConfirmRemove(null)
                      await fetch('/api/auth/passkey/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialID: pk.credentialID }) })
                      setPasskeys(prev => prev.filter(p => p.credentialID !== pk.credentialID))
                    }}
                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                  >Confirm</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(pk.credentialID)}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                >Remove</button>
              )}
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
  )
}
