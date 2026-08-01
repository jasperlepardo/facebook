import type { ThreadParticipant } from '@/types'

/** Default chat title: all members, e.g. "Ada, Bob". */
export function defaultThreadName(
  people: Array<string | { name: string }>,
): string {
  const names = [...new Set(
    people.map(p => (typeof p === 'string' ? p : p.name).trim()).filter(Boolean),
  )]
  return names.join(', ') || 'Chat'
}

export function participantAvatars(
  people: ThreadParticipant[] | undefined,
): { initials: string; color: string; name: string }[] {
  return (people ?? []).map(p => ({
    name: p.name,
    initials: p.initials || '?',
    color: p.color || 'bg-violet-400',
  }))
}
