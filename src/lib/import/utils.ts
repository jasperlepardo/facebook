import { fixMojibake } from '@/lib/mojibake'

export function normalizeName(name: string): string {
  return fixMojibake(name).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function djb2(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function participantHash(participants: string[]): string {
  return 'thread_' + djb2(participants.map(normalizeName).sort().join('|'))
}

export function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', heic: 'image/heic', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    mkv: 'video/x-matroska', aac: 'audio/aac', mp3: 'audio/mpeg',
    m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/opus',
  }
  return map[ext] ?? 'application/octet-stream'
}

export function mediaTypeLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg','jpeg','png','webp','heic'].includes(ext)) return 'photo'
  if (['mp4','mov','avi','mkv'].includes(ext))          return 'video'
  if (ext === 'gif')                                    return 'GIF'
  if (['aac','mp3','m4a','ogg','opus'].includes(ext))   return 'audio file'
  return 'file'
}


export function inferInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
}

export const THREAD_COLORS = [
  'bg-rose-400', 'bg-violet-400', 'bg-amber-400', 'bg-sky-400',
  'bg-teal-400', 'bg-indigo-400', 'bg-emerald-400', 'bg-orange-400',
]

export function pickColor(hash: string): string {
  const n = parseInt(hash.replace('thread_', '').slice(0, 2), 16)
  return THREAD_COLORS[n % THREAD_COLORS.length]
}
