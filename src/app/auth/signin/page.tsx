'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startAuthentication } from '@simplewebauthn/browser'
import Link from 'next/link'

export default function SigninPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const optRes = await fetch(`/api/auth/passkey/auth-options?email=${encodeURIComponent(email)}`)
      if (!optRes.ok) {
        const d = await optRes.json()
        throw new Error(d.error)
      }
      const { userId, ...options } = await optRes.json()

      const credential = await startAuthentication({ optionsJSON: options })

      const verRes = await fetch('/api/auth/passkey/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credential }),
      })
      const data = await verRes.json()
      if (!verRes.ok) throw new Error(data.error)

      router.push('/')
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setError('Passkey was cancelled. Try again.')
      } else {
        setError(e.message || 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">J</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="text-sm text-gray-500 mt-1">Jasper & Ciara</p>
      </div>

      <form onSubmit={handleSignin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Waiting for passkey…' : 'Sign in with passkey'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        No account?{' '}
        <Link href="/auth/signup" className="text-blue-600 font-medium">Sign up</Link>
      </p>
    </div>
  )
}
