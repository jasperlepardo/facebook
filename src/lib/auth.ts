import { getSession } from './session'
import { getPayloadClient } from './payload-access'

export interface CallerInfo {
  userId: string | null
  isSuperAdmin: boolean
  name: string | undefined
}

export async function getCallerInfo(): Promise<CallerInfo> {
  const session = await getSession()
  if (!session) return { userId: null, isSuperAdmin: false, name: undefined }
  try {
    const payload = await getPayloadClient()
    const user = await payload.findByID({ collection: 'users', id: session.userId, overrideAccess: true })
    return {
      userId:       session.userId,
      isSuperAdmin: !!(user as { superAdmin?: boolean })?.superAdmin,
      name:         (user as { name?: string }).name ?? undefined,
    }
  } catch {
    return { userId: session.userId, isSuperAdmin: false, name: undefined }
  }
}

export async function isSuperAdmin(): Promise<boolean> {
  return (await getCallerInfo()).isSuperAdmin
}

/** Session must exist and carry superAdmin (JWT claim). */
export async function requireSuperAdmin(): Promise<
  | { ok: true; session: { userId: string; superAdmin: boolean } }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await getSession()
  if (!session) return { ok: false, status: 401, error: 'Unauthorized' }
  if (!session.superAdmin) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true, session }
}
