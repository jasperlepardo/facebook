export const CONTENT_TYPES = [
  { key: 'photos',      label: 'Photos',            icon: '🖼️' },
  { key: 'videos',      label: 'Videos',            icon: '📹' },
  { key: 'audio',       label: 'Audio',             icon: '🎵' },
  { key: 'gifs',        label: 'GIFs',              icon: '🎞️' },
  { key: 'stickers',    label: 'Stickers',          icon: '🎭' },
  { key: 'files',       label: 'Files',             icon: '📎' },
  { key: 'links',       label: 'Links',             icon: '🔗' },
  { key: 'calls',       label: 'Calls',             icon: '📞' },
  { key: 'reactions',   label: 'Reactions',         icon: '😊' },
  { key: 'removed',     label: 'Removed messages',  icon: '🗑️' },
  { key: 'unavailable', label: 'Unavailable media', icon: '⚠️' },
  { key: 'location',    label: 'Location events',   icon: '📍' },
] as const

export type ContentTypeKey = typeof CONTENT_TYPES[number]['key']
export const ALL_CONTENT_TYPE_KEYS = CONTENT_TYPES.map(t => t.key) as ContentTypeKey[]
export const DEFAULT_ENABLED = new Set<ContentTypeKey>(ALL_CONTENT_TYPE_KEYS)
