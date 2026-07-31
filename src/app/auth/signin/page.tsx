'use client'

import { useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import Link from 'next/link'
import { field, btnPrimary, btnSecondary, label, brandMark, linkAccent } from '@/lib/ui'

function getNextUrl() {
  const next = new URLSearchParams(window.location.search).get('next') ?? '/'
  return next.startsWith('/') ? next : '/'
}

export default function SigninPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pkLoading, setPkLoading] = useState(false)

  async function handlePasswordSignin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPwLoading(true)
    try {
      const res = await fetch('/api/auth/password-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = getNextUrl()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setPwLoading(false)
    }
  }

  async function handlePasskeySignin() {
    setError('')
    setPkLoading(true)
    try {
      const url = email
        ? `/api/auth/passkey/auth-options?email=${encodeURIComponent(email)}`
        : '/api/auth/passkey/auth-options'
      const optRes = await fetch(url)
      if (!optRes.ok) {
        const d = await optRes.json()
        throw new Error(d.error)
      }
      const { userId, ...options } = await optRes.json()
      const credential = await startAuthentication({ optionsJSON: options })
      const verRes = await fetch('/api/auth/passkey/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId ?? undefined, credential }),
      })
      const data = await verRes.json()
      if (!verRes.ok) throw new Error(data.error)
      window.location.href = getNextUrl()
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setError('Passkey was cancelled.')
      } else {
        setError(e.message || 'Something went wrong')
      }
    } finally {
      setPkLoading(false)
    }
  }

  const loading = pwLoading || pkLoading

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className={`${brandMark} mx-auto mb-5`}>
          <span className="text-white text-2xl font-bold">R</span>
        </div>
        <p className="font-display text-3xl font-medium tracking-tight text-gray-900 dark:text-gray-100">Resibo</p>
        <p className="text-sm text-mist-500 dark:text-mist-400 mt-1.5">Your private message archive</p>
      </div>

      <form onSubmit={handlePasswordSignin} className="space-y-4">
        <div>
          <label htmlFor="signin-email" className={label}>Email</label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="signin-password" className={label}>Password</label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className={field}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={loading} className={btnPrimary}>
          {pwLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-mist-200 dark:bg-mist-700" />
        <span className="text-xs text-mist-400 dark:text-mist-500">or</span>
        <div className="flex-1 h-px bg-mist-200 dark:bg-mist-700" />
      </div>

      <button
        type="button"
        onClick={handlePasskeySignin}
        disabled={loading}
        className={`${btnSecondary} flex items-center justify-center gap-2`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4"/>
          <path d="M16 14h1a2 2 0 0 1 2 2v1"/>
          <path d="M8 14H7a2 2 0 0 0-2 2v4h6v-3"/>
          <circle cx="18" cy="20" r="2"/>
          <path d="m22 22-1.5-1.5"/>
        </svg>
        {pkLoading ? 'Waiting for passkey…' : 'Sign in with passkey'}
      </button>

      <p className="text-center text-sm text-mist-500 dark:text-mist-400 mt-6">
        No account?{' '}
        <Link href="/auth/signup" className={linkAccent}>Sign up</Link>
      </p>
    </div>
  )
}
