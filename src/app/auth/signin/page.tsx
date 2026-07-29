'use client'

import { useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import Link from 'next/link'

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-mist-500'

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
        <div className="w-14 h-14 bg-mist-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">R</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sign in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Resibo</p>
      </div>

      <form onSubmit={handlePasswordSignin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className={inputCls}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-mist-600 hover:bg-mist-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {pwLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>

      <button
        type="button"
        onClick={handlePasskeySignin}
        disabled={loading}
        className="w-full py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        No account?{' '}
        <Link href="/auth/signup" className="text-mist-600 dark:text-mist-400 font-medium">Sign up</Link>
      </p>
    </div>
  )
}
