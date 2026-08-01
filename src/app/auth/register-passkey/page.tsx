'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { startRegistration } from '@simplewebauthn/browser'
import { brandMark, btnPrimary, glassPanel } from '@/lib/ui'

function RegisterPasskeyInner() {
  const router = useRouter()
  const params = useSearchParams()
  const userId = params.get('userId')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) router.push('/auth/signup')
  }, [userId, router])

  async function handleRegister() {
    if (!userId) return
    setStatus('loading')
    setError('')
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

      setStatus('success')
      setTimeout(() => router.push('/'), 1000)
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setError('Passkey was cancelled. Try again.')
      } else {
        setError(e.message || 'Something went wrong')
      }
      setStatus('error')
    }
  }

  return (
    <div className={`${glassPanel} max-w-sm text-center`}>
      <div className={`${brandMark} mx-auto mb-4`}>
        <span className="text-white text-2xl font-bold">R</span>
      </div>
      <h1 className="font-display text-2xl font-medium text-gray-900 dark:text-gray-100 mb-2">Set up passkey</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Use Face ID, fingerprint, or your device PIN to sign in — no password needed.
      </p>

      {status === 'success' ? (
        <div className="text-emerald-600 dark:text-emerald-400 font-medium">Passkey registered! Signing you in…</div>
      ) : (
        <div>
          <button
            onClick={handleRegister}
            disabled={status === 'loading'}
            className={`${btnPrimary}`}
          >
            {status === 'loading' ? 'Waiting for passkey…' : 'Register passkey'}
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Your passkey syncs via iCloud Keychain or Google Password Manager.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-3 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  )
}

export default function RegisterPasskeyPage() {
  return (
    <Suspense>
      <RegisterPasskeyInner />
    </Suspense>
  )
}
