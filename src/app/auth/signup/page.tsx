'use client'

import { useState } from 'react'
import Link from 'next/link'
import { field, btnPrimary, label, brandMark, linkAccent, glassPanel } from '@/lib/ui'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = '/'
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${glassPanel} max-w-sm`}>
      <div className="text-center mb-8">
        <div className={`${brandMark} mx-auto mb-5`}>
          <span className="text-white text-2xl font-bold">R</span>
        </div>
        <p className="font-display text-3xl font-medium tracking-tight text-gray-900 dark:text-gray-100">Resibo</p>
        <p className="text-sm text-mist-500 dark:text-mist-400 mt-1.5">Create your archive account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className={label}>Name</label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="signup-email" className={label}>Email</label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className={label}>Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="signup-confirm" className={label}>Confirm password</label>
          <input
            id="signup-confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className={field}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-mist-500 dark:text-mist-400 mt-6">
        Already have an account?{' '}
        <Link href="/auth/signin" className={linkAccent}>Sign in</Link>
      </p>
    </div>
  )
}
