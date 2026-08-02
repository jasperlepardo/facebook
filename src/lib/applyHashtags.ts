import { Hashtag } from '@/types'
import { isAbortError } from '@/lib/utils'

/** Create new hashtags if needed, then attach all of them to the given messages. */
export async function applyMessageHashtags(opts: {
  thread: string
  messageIds: string[]
  hashtagIds: string[]
  newNames: string[]
  hashtags: Hashtag[]
  signal?: AbortSignal
}): Promise<void> {
  const { thread, messageIds, hashtagIds, newNames, hashtags, signal } = opts
  if (!messageIds.length) return
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const tagMessages = (hashtagId: string) =>
    fetch('/api/hashtag-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashtagId, messageIds, thread }),
      signal,
    })

  try {
    const createdIds = await Promise.all(newNames.map(name => {
      const existing = hashtags.find(h => h.name === name)
      if (existing) return Promise.resolve(existing.id as string | undefined)
      return fetch('/api/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, thread }),
        signal,
      })
        .then(r => r.json())
        .then(d => d.doc?.id as string | undefined)
    }))

    const ids = [...hashtagIds, ...createdIds.filter((id): id is string => !!id)]
    await Promise.all(ids.map(tagMessages))
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    throw err
  }
}
