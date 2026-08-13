import { getSession } from '@/lib/session'
import { getHiddenSnapshot } from '@/lib/hidden-sync'
import { getHiddenSync } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const HEARTBEAT_MS = 30_000
const MAX_MS = 5 * 60_000

/** GET — SSE stream that pushes hidden-items snapshots instantly via MongoDB change streams. */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const encoder = new TextEncoder()
  const started = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const ping = () => {
        controller.enqueue(encoder.encode(`: ping\n\n`))
      }

      const col = await getHiddenSync()
      const changeStream = col.watch([{ $match: { 'documentKey._id': 'global' } }])

      try {
        const snap = await getHiddenSnapshot()
        send(snap)

        while (!req.signal.aborted && Date.now() - started < MAX_MS) {
          const changed = await new Promise<boolean>(resolve => {
            const timer = setTimeout(() => {
              changeStream.removeListener('change', onChangeFired)
              req.signal.removeEventListener('abort', onAbort)
              resolve(false)
            }, HEARTBEAT_MS)

            const onChangeFired = () => {
              clearTimeout(timer)
              req.signal.removeEventListener('abort', onAbort)
              resolve(true)
            }

            const onAbort = () => {
              clearTimeout(timer)
              changeStream.removeListener('change', onChangeFired)
              resolve(false)
            }

            changeStream.once('change', onChangeFired)
            req.signal.addEventListener('abort', onAbort, { once: true })
          })

          if (req.signal.aborted) break

          if (changed) {
            const next = await getHiddenSnapshot()
            send(next)
          } else {
            ping()
          }
        }
      } catch (e) {
        console.error('[hidden-items/stream]', e)
      } finally {
        try { await changeStream.close() } catch { /* already closed */ }
        try { controller.close() } catch { /* already closed */ }
      }
    },
    cancel() {},
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
