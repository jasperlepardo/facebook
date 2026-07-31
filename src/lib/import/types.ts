export interface FileRef { sourceId: string; path: string; format: 'native' | 'scraped' }

export interface FoundThread {
  key: string
  title: string
  participants: string[]
  facebookThreadId: string | null
  messageFiles: FileRef[]
  mediaBasePaths: FileRef[]
  messageCount: number
  mediaFileCount: number
  format: 'native' | 'scraped'
}

export interface ImportProgress {
  label: string
  sublabel?: string
  current: number
  total: number
  errors: string[]
}

export interface VirtualFS {
  paths: string[]
  readText(path: string): Promise<string>
  readBlob(path: string): Promise<Blob>
}

export type StoredSource =
  | { kind: 'zip'; buf: ArrayBuffer }
  | { kind: 'folder'; paths: string[]; resolve: (path: string) => Promise<File> }
