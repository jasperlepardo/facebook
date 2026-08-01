'use client'
import { useState } from 'react'
import { toSlug } from '@/lib/utils'
import { btnPrimary, btnGhost, labelUpper, headerField, glassPanel } from '@/lib/ui'
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

  const fieldCls = `${headerField} w-full px-4 py-3 text-sm`

  return (
    <div className="flex-1 overflow-y-auto">
      <form onSubmit={handleSubmit} className={`${glassPanel} max-w-lg mx-auto mt-6 mb-8 flex flex-col gap-5`}>

        <div className="flex flex-col gap-1.5">
          <label className={labelUpper}>Name</label>
          <div className={`${headerField} flex items-center gap-2 px-4 py-3`}>
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
            <div className="flex rounded-xl overflow-hidden border border-black/10 dark:border-white/12">
              {([false, true] as const).map(val => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setIsPrivate(val)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2
                    ${isPrivate === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-mist-500 dark:text-mist-400 liquid-glass-hover'
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
