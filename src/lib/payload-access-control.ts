import type { Access, FieldAccess, Where } from 'payload'

export function isSuperAdminUser(user: unknown): boolean {
  return !!(user as { superAdmin?: boolean | null } | null | undefined)?.superAdmin
}

/** Any signed-in user. */
export const authenticated: Access = ({ req: { user } }) => !!user

/** SuperAdmin only. */
export const superAdminOnly: Access = ({ req: { user } }) => isSuperAdminUser(user)

/** Authenticated read; private hashtags only for owner/superAdmin. */
export const hashtagRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdminUser(user)) return true
  const where: Where = {
    or: [
      { isPrivate: { equals: false } },
      { isPrivate: { exists: false } },
      { createdById: { equals: String(user.id) } },
    ],
  }
  return where
}

/** Owner or superAdmin can update/delete hashtags. */
export const hashtagMutate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdminUser(user)) return true
  const where: Where = { createdById: { equals: String(user.id) } }
  return where
}

/** Users can update themselves; superAdmin can update anyone. */
export const selfOrSuperAdmin: Access = ({ req: { user }, id }) => {
  if (!user) return false
  if (isSuperAdminUser(user)) return true
  return String(user.id) === String(id)
}

/** Only superAdmin can set the superAdmin flag. */
export const superAdminField: FieldAccess = ({ req: { user } }) => isSuperAdminUser(user)
