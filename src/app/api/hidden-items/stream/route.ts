import { getSession } from '@/lib/session'
import { getHiddenSnapshot, getHiddenSyncVersion } from '@/lib/hidden-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const POLL_MS = 1000
const HEARTBEAT_MS = 15_000
const MAX_MS = 5 * 60_000

/** GET — SSE stream of hidden-items snapshots when version changes. */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const encoder = new TextEncoder()
  let lastVersion = -1
  const started = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const ping = () => {
        controller.enqueue(encoder.encode(`: ping\n\n`))
      }

      try {
        const snap = await getHiddenSnapshot()
        lastVersion = snap.version
        send(snap)

        let lastPing = Date.now()
        while (!req.signal.aborted && Date.now() - started < MAX_MS) {
          await new Promise(r => setTimeout(r, POLL_MS))
          if (req.signal.aborted) break

          const version = await getHiddenSyncVersion()
          if (version !== lastVersion) {
            const next = await getHiddenSnapshot()
            lastVersion = next.version
            send(next)
          }

          if (Date.now() - lastPing >= HEARTBEAT_MS) {
            ping()
            lastPing = Date.now()
          }
        }
      } catch (e) {
        console.error('[hidden-items/stream]', e)
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
    cancel() {
      // client disconnected
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
