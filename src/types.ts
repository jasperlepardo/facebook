export interface Message {
  _id: string
  timestamp_ms: number
  sender_name: string
  content?: string
  is_unsent?: boolean
  photos?: { uri: string }[]
  videos?: { uri: string }[]
  audio_files?: { uri: string }[]
  gifs?: { uri: string }[]
  sticker?: { uri: string }
  files?: { uri: string }[]
  share?: { link: string; share_text?: string }
  call_duration?: number
  missed?: boolean
  reactions?: { reaction: string; actor: string }[]
  blockId?: string
  type?: string
  media_failed?: boolean
  content_unavailable?: boolean
  ip?: string
  is_unsent_image_by_messenger_kid_parent?: boolean
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
  type: 'photo' | 'video' | 'gif'
  caption: string
  msgId?: string
  ts?: number
  onPrev?: () => void
  onNext?: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  kind: 'note' | 'gallery'
  note?: Note
  galTs?: string
  galMsgId?: string | null
}

export type Tab = 'chat' | 'photos' | 'videos' | 'files'

export interface Hashtag {
  id: string
  name: string
  context?: string
  firstMsgTs?: number
  groupCount?: number
}

export interface HashtagGroup {
  id: string
  hashtagId: string
  blockId: string
  firstMsgTs?: number
}
