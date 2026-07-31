import { fixMojibake } from '@/lib/mojibake'
import type { FileRef, FoundThread, VirtualFS } from './types'
import { participantHash } from './utils'

export async function parseSource(fs: VirtualFS, sourceId: string): Promise<FoundThread[]> {
  // Match both new export (your_facebook_activity/messages/...) and old export (messages/inbox/...)
  const isNative = fs.paths.some(p =>
    /messages\/[^/]+\/[^/]+\/message_\d+\.json$/.test(p)
  )
  return isNative
    ? parseNativeFormat(fs, sourceId)
    : parseScrapedFormat(fs, sourceId)
}

export async function parseNativeFormat(fs: VirtualFS, sourceId: string): Promise<FoundThread[]> {
  const message1Files = fs.paths.filter(p =>
    /messages\/[^/]+\/[^/]+\/message_1\.json$/.test(p)
  )
  const threads: FoundThread[] = []

  for (const m1Path of message1Files) {
    try {
      const data = JSON.parse(await fs.readText(m1Path))
      const rawParticipants: string[] = (data.participants ?? [])
        .map((p: any) => fixMojibake(typeof p === 'string' ? p : p.name ?? ''))
        .filter(Boolean)

      const title = fixMojibake(data.title ?? rawParticipants[0] ?? 'Unknown')
      const folderPath = m1Path.replace(/\/message_1\.json$/, '')
      const folderName = folderPath.split('/').pop() ?? ''
      const idMatch = folderName.match(/_(\d+)$/)

      const messageFiles: FileRef[] = fs.paths
        .filter(p => p.startsWith(folderPath + '/') && /\/message_\d+\.json$/.test(p))
        .map(path => ({ sourceId, path, format: 'native' as const }))

      const mediaFiles = fs.paths.filter(p => p.startsWith(folderPath + '/') && !p.endsWith('.json'))
      const mediaBasePaths: FileRef[] = [...new Set(
        mediaFiles.map(p => p.slice(0, p.lastIndexOf('/') + 1))
      )].map(path => ({ sourceId, path, format: 'native' as const }))

      const perFile  = data.messages?.length ?? 0
      const msgCount = perFile * messageFiles.length

      threads.push({
        key: participantHash(rawParticipants),
        title,
        participants: rawParticipants,
        facebookThreadId: idMatch ? idMatch[1] : null,
        messageFiles,
        mediaBasePaths,
        messageCount: msgCount,
        mediaFileCount: mediaFiles.length,
        format: 'native',
      })
    } catch {}
  }

  return threads
}

export async function parseScrapedFormat(fs: VirtualFS, sourceId: string): Promise<FoundThread[]> {
  const jsonFiles = fs.paths.filter(p => p.endsWith('.json'))
  const threads: FoundThread[] = []

  for (const filePath of jsonFiles) {
    try {
      const data = JSON.parse(await fs.readText(filePath))
      const msgs = data.messages ?? data
      if (!Array.isArray(msgs) || msgs.length === 0) continue

      const rawParticipants: string[] = Array.isArray(data.participants)
        ? data.participants.map((p: any) => typeof p === 'string' ? p : p.name ?? '').filter(Boolean)
        : []

      const title = data.threadName ?? filePath.split('/').pop()?.replace('.json', '') ?? 'Unknown'
      const folder = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : ''
      const mediaBase = folder ? folder + '/media/' : 'media/'

      threads.push({
        key: participantHash(rawParticipants),
        title,
        participants: rawParticipants,
        facebookThreadId: null,
        messageFiles: [{ sourceId, path: filePath, format: 'scraped' as const }],
        mediaBasePaths: [{ sourceId, path: mediaBase, format: 'scraped' as const }],
        messageCount: msgs.length,
        mediaFileCount: fs.paths.filter(p => p.startsWith(mediaBase)).length,
        format: 'scraped',
      })
    } catch {}
  }

  return threads
}

export function mergeThreads(allThreads: FoundThread[]): FoundThread[] {
  const map = new Map<string, FoundThread>()
  for (const t of allThreads) {
    const existing = map.get(t.key)
    if (existing) {
      existing.messageFiles   = [...existing.messageFiles,   ...t.messageFiles]
      existing.mediaBasePaths = [...existing.mediaBasePaths, ...t.mediaBasePaths]
      existing.messageCount  += t.messageCount
      existing.mediaFileCount += t.mediaFileCount
    } else {
      map.set(t.key, { ...t })
    }
  }
  return [...map.values()].sort((a, b) => b.messageCount - a.messageCount)
}

// Build a map from Facebook URI → VirtualFS path for O(1) lookups.
// Native exports: URI = "your_facebook_activity/messages/..." → strip to that prefix.
// Scraped exports: URI is stored relative to the thread folder (e.g. "messages/photos/x.jpg"
// or "local-media/x.mp4") while the VFS path has leading folder segments. We index every
// suffix of each path so it matches regardless of how many leading segments are present.
export function buildUriIndex(fs: VirtualFS): Map<string, string> {
  const index = new Map<string, string>()
  for (const path of fs.paths) {
    index.set(path, path)
    // Native: strip "your_facebook_activity/" prefix
    const fbIdx = path.indexOf('your_facebook_activity/')
    if (fbIdx !== -1) index.set(path.slice(fbIdx), path)
    // Scraped: index all path suffixes (strip leading segments one by one)
    // "a/b/messages/photos/x.jpg" → "b/messages/photos/x.jpg", "messages/photos/x.jpg", …
    let p = path
    while (p.includes('/')) {
      p = p.slice(p.indexOf('/') + 1)
      if (!index.has(p)) index.set(p, path)
    }
  }
  return index
}

// Collect every media URI referenced in a batch of messages (both native and scraped formats)
export function extractMediaUris(messages: unknown[]): string[] {
  const uris = new Set<string>()
  for (const m of messages as any[]) {
    for (const field of ['photos', 'videos', 'gifs', 'audio_files', 'files']) {
      if (Array.isArray(m[field])) {
        for (const item of m[field]) if (item?.uri) uris.add(item.uri)
      }
    }
    if (m.sticker?.uri) uris.add(m.sticker.uri)
    // Scraped format: media[] contains all attachment types
    if (Array.isArray(m.media)) {
      for (const item of m.media) if (item?.uri) uris.add(item.uri)
    }
  }
  return [...uris]
}
