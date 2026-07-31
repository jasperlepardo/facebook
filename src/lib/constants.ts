export const ME             = process.env.NEXT_PUBLIC_OWNER_NAME ?? 'Jasper Lepardo'
export const LIMIT          = 80
export const GALLERY_LIMIT  = 60
export const MAX_DOM_BLOCKS = LIMIT * 2
export const LOAD_THRESHOLD = 1500
export const SESSION_GAP_MS = 60 * 60_000 // messages >1hr apart start a new block
