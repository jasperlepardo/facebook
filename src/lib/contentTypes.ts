export const CONTENT_TYPES = [
  { key: 'photos',      label: 'Photos' },
  { key: 'videos',      label: 'Videos' },
  { key: 'audio',       label: 'Audio' },
  { key: 'gifs',        label: 'GIFs' },
  { key: 'stickers',    label: 'Stickers' },
  { key: 'files',       label: 'Files' },
  { key: 'links',       label: 'Links' },
  { key: 'calls',       label: 'Calls' },
  { key: 'reactions',   label: 'Reactions' },
  { key: 'removed',     label: 'Removed messages' },
  { key: 'unavailable', label: 'Unavailable media' },
  { key: 'location',    label: 'Location events' },
] as const

export type ContentTypeKey = typeof CONTENT_TYPES[number]['key']
export const ALL_CONTENT_TYPE_KEYS = CONTENT_TYPES.map(t => t.key) as ContentTypeKey[]
export const DEFAULT_ENABLED = new Set<ContentTypeKey>(ALL_CONTENT_TYPE_KEYS)
