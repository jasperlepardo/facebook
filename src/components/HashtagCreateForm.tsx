'use client'
import { useState } from 'react'
import { toSlug } from '@/lib/utils'
import { btnPrimary, btnGhost, labelUpper } from '@/lib/ui'
import { LockIcon, GlobeIcon } from '@/components/icons'

interface CreatePayload {
  name: string
  isPrivate: boolean
  context: string
}

interface Props {
  isSuperAdmin?: boolean
  onCancel: () => void
  onCreate: (payload: CreatePayload) => Promise<void>
}

export default function HashtagCreateForm({ isSuperAdmin, onCancel, onCreate }: Props) {
  const [name, setName]           = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [context, setContext]     = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const slug = name.trim()
    if (!slug) return
    setLoading(true)
    try { await onCreate({ name: slug, isPrivate, context: context.trim() }) }
    finally { setLoading(false) }
  }

  const fieldCls = 'w-full px-4 py-3 rounded-xl bg-mist-50 dark:bg-mist-800 border border-mist-200 dark:border-mist-700 text-gray-900 dark:text-white placeholder:text-mist-400 outline-hidden focus:border-mist-400 dark:focus:border-mist-500 text-sm transition-colors'

  return (
    <div className="flex-1 overflow-y-auto">
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-5">

        <div className="flex flex-col gap-1.5">
          <label className={labelUpper}>Name</label>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-mist-50 dark:bg-mist-800 border border-mist-200 dark:border-mist-700 focus-within:border-mist-400 dark:focus-within:border-mist-500 transition-colors">
            <span className="text-mist-400 font-semibold text-sm">#</span>
            <input
              autoFocus
              value={name}
              onChange={e => setName(toSlug(e.target.value))}
              onKeyDown={e => e.key === 'Escape' && onCancel()}
              placeholder="hashtag-name"
              className="flex-1 bg-transparent outline-hidden text-gray-900 dark:text-white placeholder:text-mist-400 text-sm"
            />
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex flex-col gap-1.5">
            <label className={labelUpper}>Visibility</label>
            <div className="flex rounded-xl overflow-hidden border border-mist-200 dark:border-mist-700">
              {([false, true] as const).map(val => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setIsPrivate(val)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2
                    ${isPrivate === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-mist-50 dark:bg-mist-800 text-mist-500 dark:text-mist-400 hover:bg-mist-100 dark:hover:bg-mist-700'
                    }`}
                >
                  {val
                    ? <><LockIcon size={14} /> Private</>
                    : <><GlobeIcon size={14} /> Public</>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className={labelUpper}>Context <span className="normal-case font-normal text-mist-400">(optional)</span></label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="What is this hashtag about? Add any notes or context…"
            rows={4}
            className={fieldCls + ' resize-none'}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} className={`flex-1 ${btnGhost}`}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || loading} className={`flex-1 ${btnPrimary} disabled:opacity-40`}>
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>

      </form>
    </div>
  )
}
