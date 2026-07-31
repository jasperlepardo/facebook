import JSZip from 'jszip'
import type { StoredSource, VirtualFS } from './types'

export async function openSource(src: StoredSource): Promise<VirtualFS | null> {
  if (src.kind === 'zip') {
    try {
      const zip = await JSZip.loadAsync(src.buf)
      const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir)
      return {
        paths,
        readText: p => zip.files[p].async('text'),
        readBlob: p => zip.files[p].async('blob'),
      }
    } catch { return null }
  }

  const { paths, resolve } = src
  return {
    paths,
    readText: async p => (await resolve(p)).text(),
    readBlob: resolve,
  }
}

export async function readDirEntry(
  entry: FileSystemDirectoryEntry,
  prefix = '',
  result = new Map<string, FileSystemFileEntry>(),
): Promise<Map<string, FileSystemFileEntry>> {
  const reader = entry.createReader()
  let batch: FileSystemEntry[]
  do {
    batch = await new Promise((res, rej) => reader.readEntries(res as any, rej))
    for (const e of batch) {
      const path = prefix + e.name
      if (e.isDirectory) {
        await readDirEntry(e as FileSystemDirectoryEntry, path + '/', result)
      } else {
        result.set(path, e as FileSystemFileEntry)
      }
    }
  } while (batch.length > 0)
  return result
}
