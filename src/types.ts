export interface Message {
  _id: string
  timestamp_ms: number
  sender_name: string
  blockId?: string
  content?: string
  type?: 'link' | 'media' | 'text' | 'placeholder'
  // Media attachments
  photos?: { uri: string; creation_timestamp: number | null }[]
  videos?: { uri: string; creation_timestamp?: number | null }[]
  audio_files?: { uri: string; creation_timestamp?: number | null }[]
  gifs?: { uri: string; creation_timestamp?: number | null }[]
  sticker?: { uri: string; ai_stickers: unknown[] }
  files?: { uri: string; creation_timestamp?: number | null }[]
  share?: { link?: string; share_text?: string }
  // Calls
  call_duration?: number
  missed?: boolean
  // Reactions
  reactions?: { reaction: string; actor: string; timestamp?: number }[]
  // State flags
  is_unsent?: boolean
  is_unsent_image_by_messenger_kid_parent: boolean
  media_failed?: boolean
  content_unavailable?: boolean
  // Facebook metadata
  ip?: string
  is_geoblocked_for_viewer: boolean
}

export interface MessageBlock {
  date: string
  newDate: boolean
  sender: string
  mine: boolean
  msgs: Message[]
}

export interface Note {
  id: string
  start: string
  end?: string
  title: string
  body?: string
  tags: string[]
  msgIds?: string
  createdBy?: { name?: string; email?: string }
  updatedBy?: { name?: string; email?: string }
}

export interface GalleryItem {
  uri: string
  ts: number
  sender: string
  msgId?: string
  kind?: string
}

export interface LightboxState {
  src: string
  uri?: string
  type: 'photo' | 'video' | 'gif' | 'file'
  mediaType?: 'photos' | 'videos' | 'gifs'
  caption: string
  msgId?: string
  ts?: number
  onPrev?: () => void
  onNext?: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  kind: 'note' | 'gallery' | 'media' | 'message'
  note?: Note
  galTs?: string
  galMsgId?: string | null
  mediaUri?: string
  msgIds?: string[]
  msgTs?: number
  fromTouch?: boolean
}

export type Tab = 'chat' | 'photos' | 'videos' | 'files'
export type Section = 'chat' | 'hashtags' | 'settings' | 'story'

export interface LinkedDate {
  date: string
  type: 'continues-from' | 'resolved-on' | 'echoes'
  label: string
}

export interface DailySummary {
  _id?: string
  date: string
  year: number
  month: number
  day: number
  messageCount: number
  summary: string
  mood: string
  themes: string[]
  linkedDates: LinkedDate[]
  generatedAt: string
  model: string
}
export interface Arc {
  _id?: string
  title: string
  startDate: string
  endDate: string
  description: string
  themes: string[]
  mood: string
  dayCount: number
  generatedAt: string
  model: string
}

export type MediaTab = 'photos' | 'videos' | 'gifs' | 'audio' | 'files' | 'stickers' | 'links' | 'calls'

export interface Hashtag {
  id: string
  name: string
  context?: string
  isPrivate?: boolean
  createdBy?: string
  createdById?: string
  firstMsgTs?: number
  groupCount?: number
}

export interface HashtagGroup {
  id: string
  hashtagId: string
  blockId: string
  firstMsgTs?: number
}

export interface DateBoundary { iso: string; label: string; offset: number }
export interface DateIndex { days: DateBoundary[]; weeks: DateBoundary[]; months: DateBoundary[] }
