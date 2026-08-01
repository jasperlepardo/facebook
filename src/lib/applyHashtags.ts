import { Hashtag } from '@/types'

/** Create new hashtags if needed, then attach all of them to the given messages. */
export async function applyMessageHashtags(opts: {
  thread: string
  messageIds: string[]
  hashtagIds: string[]
  newNames: string[]
  hashtags: Hashtag[]
}): Promise<void> {
  const { thread, messageIds, hashtagIds, newNames, hashtags } = opts
  if (!messageIds.length) return

  const tagMessages = (hashtagId: string) =>
    fetch('/api/hashtag-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashtagId, messageIds, thread }),
    })

  const createdIds = await Promise.all(newNames.map(name => {
    const existing = hashtags.find(h => h.name === name)
    if (existing) return Promise.resolve(existing.id as string | undefined)
    return fetch('/api/hashtags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, thread }),
    })
      .then(r => r.json())
      .then(d => d.doc?.id as string | undefined)
  }))

  const ids = [...hashtagIds, ...createdIds.filter((id): id is string => !!id)]
  await Promise.all(ids.map(tagMessages))
}
