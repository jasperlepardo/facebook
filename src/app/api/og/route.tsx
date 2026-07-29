import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'
import { getMessages } from '@/lib/db'
import { ME } from '@/lib/constants'

export const runtime = 'nodejs'

const W = 1200, H = 630, PAD = 52

async function loadFont(family: string, weight: 400 | 700): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(' ', '+')}:wght@${weight}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGBot/1.0)' } }
  ).then(r => r.text())
  const url = css.match(/src: url\(([^)]+)\) format\('woff2'\)/)?.[1]
  if (!url) throw new Error(`woff2 url not found for ${family} ${weight}`)
  return fetch(url).then(r => r.arrayBuffer())
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}

function mediaLabel(m: Record<string, unknown>): string {
  const photos = m.photos as unknown[] | undefined
  const videos = m.videos as unknown[] | undefined
  const audio  = m.audio_files as unknown[] | undefined
  const gifs   = m.gifs as unknown[] | undefined
  const files  = m.files as { uri: string }[] | undefined
  const share  = m.share as { link?: string; share_text?: string } | undefined
  const call   = m.call_duration as number | undefined

  if (photos?.length)  return photos.length > 1 ? `📷 ${photos.length} photos` : '📷 Photo'
  if (videos?.length)  return '📹 Video'
  if (gifs?.length)    return '🎞️ GIF'
  if (audio?.length)   return '🎵 Audio'
  if (m.sticker)       return '🎭 Sticker'
  if (files?.length)   return `📎 ${files[0].uri.split('/').pop() ?? 'File'}`
  if (share?.link)     return `🔗 ${share.share_text || truncate(share.link, 60)}`
  if (call != null) {
    const isVideo = ((m.content as string) || '').toLowerCase().includes('video')
    const icon = isVideo ? '📹' : '📞'
    if (m.missed) return `${icon} Missed call`
    const mins = Math.floor(call / 60), secs = call % 60
    return `${icon} Call · ${mins > 0 ? `${mins}m ` : ''}${secs}s`
  }
  return ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg = Record<string, any>

function groupIntoBlocks(msgs: Msg[]): { sender: string; mine: boolean; msgs: Msg[] }[] {
  const blocks: { sender: string; mine: boolean; msgs: Msg[] }[] = []
  for (const m of msgs) {
    const last = blocks[blocks.length - 1]
    if (last && last.sender === m.sender_name) {
      last.msgs.push(m)
    } else {
      blocks.push({ sender: m.sender_name as string, mine: m.sender_name === ME, msgs: [m] })
    }
  }
  return blocks
}

export async function GET(req: NextRequest) {
  const msgId = req.nextUrl.searchParams.get('msgId')
  if (!msgId) return new Response('missing msgId', { status: 400 })

  try {
    let anchorId: ObjectId
    try { anchorId = new ObjectId(msgId) } catch { return new Response('invalid id', { status: 400 }) }

    const [fontRegular, fontBold, col] = await Promise.all([
      loadFont('Inter', 400),
      loadFont('Inter', 700),
      getMessages(),
    ])

    const anchor = await col.findOne({ _id: anchorId })
    if (!anchor) return new Response('not found', { status: 404 })

    // Anchor + up to 30 subsequent messages
    const thread = await col
      .find({ timestamp_ms: { $gte: anchor.timestamp_ms as number } })
      .sort({ timestamp_ms: 1 })
      .limit(30)
      .toArray() as Msg[]

    const blocks = groupIntoBlocks(thread)

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: W,
            height: H,
            background: '#ffffff',
            fontFamily: 'Inter',
            padding: PAD,
          }}
        >
          {/* App name */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.4px' }}>
              resibo
            </span>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', height: 1, background: '#e5e7eb', marginBottom: 20 }} />

          {/* Messages — anchor block + as many subsequent as fit */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14, overflow: 'hidden' }}>
            {blocks.slice(0, 7).map((block, bi) => {
              const first = block.msgs[0]
              const isAnchor = bi === 0
              const time = new Date(first.timestamp_ms as number)
                .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              const initial = (block.sender || '?')[0].toUpperCase()
              const avatarBg = block.mine ? '#64748b' : '#7c3aed'

              return (
                <div
                  key={bi}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 12,
                    background: isAnchor ? '#eef2ff' : 'transparent',
                    borderRadius: isAnchor ? 10 : 0,
                    borderLeft: isAnchor ? '3px solid #4f46e5' : '3px solid transparent',
                    padding: isAnchor ? '10px 12px' : '0 12px',
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      display: 'flex',
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      background: avatarBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {initial}
                  </div>

                  {/* Body */}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: block.mine ? '#475569' : '#111827' }}>
                        {block.sender}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{time}</span>
                    </div>
                    {block.msgs.slice(0, 3).map((m, mi) => {
                      const text  = m.content && m.content !== 'You sent an attachment.' ? m.content as string : ''
                      const media = mediaLabel(m)
                      const display = text ? truncate(text, 180) : media
                      if (!display) return null
                      return (
                        <div
                          key={mi}
                          style={{
                            fontSize: 14,
                            color: text ? '#374151' : '#9ca3af',
                            fontStyle: media && !text ? 'italic' : 'normal',
                            lineHeight: 1.55,
                          }}
                        >
                          {display}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', height: 1, background: '#e5e7eb', marginTop: 18, marginBottom: 14 }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Open in Resibo →</span>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts: [
          { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
          { name: 'Inter', data: fontBold,    weight: 700, style: 'normal' },
        ],
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
}
