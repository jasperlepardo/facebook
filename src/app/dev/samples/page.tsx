import { getMessages } from '@/lib/db'
import { Message } from '@/types'
import SamplesView from './SamplesView'

function clean(doc: any): Message {
  return { ...doc, _id: String(doc._id), blockId: String(doc.blockId) }
}

export default async function SamplesPage() {
  const col = await getMessages()

  const queries: { label: string; query: object }[] = [
    { label: 'Text — plain',          query: { content: { $exists: true, $not: { $regex: 'sent a|sent an|missed|called|ended|started' } }, photos: { $exists: false }, videos: { $exists: false }, files: { $exists: false }, call_duration: { $exists: false }, share: { $exists: false }, reactions: { $exists: false }, is_unsent: { $ne: true }, media_failed: { $ne: true }, content_unavailable: { $ne: true }, ip: { $exists: false } } },
    { label: 'Text — with reactions', query: { reactions: { $exists: true }, content: { $exists: true }, photos: { $exists: false } } },
    { label: 'Text — URL link',       query: { type: 'link', share: { $exists: false } } },
    { label: 'Photo',                 query: { photos: { $exists: true } } },
    { label: 'Video',                 query: { videos: { $exists: true } } },
    { label: 'Audio',                 query: { audio_files: { $exists: true } } },
    { label: 'GIF',                   query: { gifs: { $exists: true } } },
    { label: 'Sticker',               query: { sticker: { $exists: true } } },
    { label: 'File — PDF',            query: { 'files.0.uri': { $regex: '\\.pdf$' } } },
    { label: 'File — DOC',            query: { 'files.0.uri': { $regex: '\\.docx?$' } } },
    { label: 'File — XLSX',           query: { 'files.0.uri': { $regex: '\\.xlsx$' } } },
    { label: 'File — ZIP',            query: { 'files.0.uri': { $regex: '\\.zip$' } } },
    { label: 'File — AI',             query: { 'files.0.uri': { $regex: '\\.ai$' } } },
    { label: 'File — INDD',           query: { 'files.0.uri': { $regex: '\\.indd$' } } },
    { label: 'File — XD',             query: { 'files.0.uri': { $regex: '\\.xd$' } } },
    { label: 'File — ICS',            query: { 'files.0.uri': { $regex: '\\.ics$' } } },
    { label: 'Share — link with OG',  query: { 'share.link': { $exists: true, $not: { $regex: 'facebook\\.com' } }, 'share.share_text': { $exists: true } } },
    { label: 'Share — Facebook URL',  query: { 'share.link': { $regex: 'facebook\\.com' } } },
    { label: 'Share — direct image',  query: { 'share.link': { $regex: '\\.(jpg|png|gif|webp)' } } },
    { label: 'Share — live location', query: { content: { $regex: 'sent a live location' } } },
    { label: 'Call — answered audio', query: { call_duration: { $gt: 60 }, content: { $not: { $regex: 'video' } } } },
    { label: 'Call — answered video', query: { call_duration: { $gt: 60 }, content: { $regex: 'video' } } },
    { label: 'Call — missed',         query: { missed: true, content: { $not: { $regex: 'video' } } } },
    { label: 'Call — missed video',   query: { missed: true, content: { $regex: 'video' } } },
    { label: 'Location (ip)',         query: { ip: { $exists: true }, content: { $exists: false }, photos: { $exists: false }, videos: { $exists: false }, audio_files: { $exists: false }, gifs: { $exists: false }, sticker: { $exists: false }, files: { $exists: false }, share: { $exists: false } } },
    { label: 'Message unsent',        query: { is_unsent: true } },
    { label: 'Message unsent — kid',  query: { is_unsent_image_by_messenger_kid_parent: true } },
    { label: 'Media failed',          query: { media_failed: true } },
    { label: 'Content unavailable',   query: { content_unavailable: true, is_unsent: { $ne: true } } },
    { label: 'Attachment unavailable',query: { content: { $regex: 'sent an attachment' }, photos: { $exists: false }, videos: { $exists: false }, files: { $exists: false }, 'share.link': { $exists: false }, ip: { $exists: false } } },
  ]

  const results = await Promise.all(
    queries.map(async ({ label, query }) => {
      const doc = await col.findOne(query)
      return doc ? { label, msg: clean(doc) } : null
    })
  )

  const samples = results.filter((s): s is { label: string; msg: Message } => s !== null)

  return (
    <div className="min-h-screen bg-white dark:bg-mist-950">
      <div className="sticky top-0 z-10 px-5 py-3 bg-white/90 dark:bg-mist-950/90 backdrop-blur-sm border-b border-mist-100 dark:border-mist-800 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Content Types</h1>
        <span className="text-[11px] text-mist-400">{samples.length} types · live data</span>
      </div>
      <SamplesView samples={samples} />
    </div>
  )
}
