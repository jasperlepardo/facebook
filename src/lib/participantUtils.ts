import { getPayloadClient } from './payload-access'
import { getCollection } from './db'
import { normalizeName } from './import/utils'
import {
  ALLOWED_PARTICIPANT_COLORS,
  DEFAULT_PARTICIPANT_COLOR,
} from './participantColors'
import { defaultThreadName } from './threadDisplay'

export {
  ALLOWED_PARTICIPANT_COLORS,
  DEFAULT_PARTICIPANT_COLOR,
  PARTICIPANT_COLOR_OPTIONS,
  PARTICIPANT_TEXT_COLORS,
} from './participantColors'
export type { ParticipantColor } from './participantColors'

export interface ParticipantRecord {
  id: string
  name: string
  initials: string
  color: string
}

export function initialsFromName(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?'
}

function asParticipantDoc(doc: {
  id: string | number
  name?: string | null
  initials?: string | null
  color?: string | null
}): ParticipantRecord | null {
  const name = (doc.name ?? '').trim()
  if (!name) return null
  const color = doc.color && ALLOWED_PARTICIPANT_COLORS.has(doc.color) ? doc.color : DEFAULT_PARTICIPANT_COLOR
  return {
    id: String(doc.id),
    name,
    initials: (doc.initials ?? '').trim().slice(0, 2).toUpperCase() || initialsFromName(name),
    color,
  }
}

/** Find-or-create global participants by Facebook name. Preserves existing initials/color. */
export async function upsertParticipants(names: string[]): Promise<{
  participants: ParticipantRecord[]
  byName: Record<string, string>
}> {
  const unique = [...new Set(names.map(n => n.trim()).filter(Boolean))]
  if (unique.length === 0) return { participants: [], byName: {} }

  const payload = await getPayloadClient()
  const byName: Record<string, string> = {}
  const participants: ParticipantRecord[] = []

  for (const name of unique) {
    const normalized = normalizeName(name)
    if (!normalized) continue

    const byExact = await payload.find({
      collection: 'participants',
      where: { name: { equals: name } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    let doc = byExact.docs[0]

    if (!doc) {
      const byNorm = await payload.find({
        collection: 'participants',
        where: { normalizedName: { equals: normalized } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      doc = byNorm.docs[0]
    }

    if (!doc) {
      try {
        doc = await payload.create({
          collection: 'participants',
          data: {
            name,
            normalizedName: normalized,
            initials: initialsFromName(name),
            color: DEFAULT_PARTICIPANT_COLOR,
          },
          overrideAccess: true,
        })
      } catch {
        // Race: another request created the same unique key — re-find.
        const retry = await payload.find({
          collection: 'participants',
          where: {
            or: [
              { name: { equals: name } },
              { normalizedName: { equals: normalized } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        doc = retry.docs[0]
      }
    }

    if (!doc) continue
    const row = asParticipantDoc(doc)
    if (!row) continue
    participants.push(row)
    byName[name] = row.id
    byName[row.name] = row.id
  }

  return { participants, byName }
}

/** Detect legacy embedded `{ name, initials, color }` rows vs relationship ids/docs. */
export function isLegacyEmbeddedParticipants(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false
  const first = raw[0]
  // Relationship depth 0 → string ids; depth 1 → docs with normalizedName.
  if (typeof first === 'string' || typeof first === 'number') return false
  if (first && typeof first === 'object' && 'normalizedName' in first) return false
  return typeof first === 'object' && first !== null && 'name' in first
}

export function extractLegacyParticipantRows(raw: unknown): { name: string; initials?: string; color?: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { name: string; initials?: string; color?: string }[] = []
  for (const p of raw) {
    if (typeof p === 'string') {
      out.push({ name: p })
    } else if (p && typeof p === 'object' && 'name' in p && typeof (p as { name: unknown }).name === 'string') {
      const row = p as { name: string; initials?: string; color?: string }
      out.push(row)
    }
  }
  return out
}

/** Map relationship field (ids or populated docs) → ThreadParticipant-shaped records. */
export function mapRelationParticipants(raw: unknown): ParticipantRecord[] {
  if (!Array.isArray(raw)) return []
  const out: ParticipantRecord[] = []
  for (const p of raw) {
    if (typeof p === 'string' || typeof p === 'number') continue // id only — need populate
    if (p && typeof p === 'object') {
      const row = asParticipantDoc(p as { id: string; name?: string; initials?: string; color?: string })
      if (row) out.push(row)
    }
  }
  return out
}

/**
 * Migrate a thread's embedded participants array to relationship IDs.
 * Also applies any preserved initials/color onto the Participant docs.
 */
export async function migrateThreadParticipantsToRelations(
  threadId: string,
  legacy: { name: string; initials?: string; color?: string }[],
): Promise<ParticipantRecord[]> {
  const names = legacy.map(l => l.name)
  const { participants, byName } = await upsertParticipants(names)
  const payload = await getPayloadClient()

  for (const leg of legacy) {
    const id = byName[leg.name]
    if (!id) continue
    const data: Record<string, unknown> = {}
    if (leg.initials?.trim()) data.initials = leg.initials.trim().slice(0, 2).toUpperCase()
    if (leg.color && ALLOWED_PARTICIPANT_COLORS.has(leg.color)) data.color = leg.color
    if (Object.keys(data).length) {
      await payload.update({
        collection: 'participants',
        id,
        data,
        overrideAccess: true,
      }).catch(() => {})
    }
  }

  const ids = participants.map(p => p.id)
  await payload.update({
    collection: 'threads',
    id: threadId,
    data: { participants: ids },
    overrideAccess: true,
  })

  // Re-fetch with styles we may have just patched
  const refreshed = await upsertParticipants(names)
  return refreshed.participants
}

/**
 * Ensure a thread's members are relationship IDs and messages have senderId.
 * Safe to call repeatedly (idempotent).
 */
export async function restampThread(
  collectionName: string,
  opts?: { threadId?: string; legacyParticipants?: unknown },
): Promise<{ participants: ParticipantRecord[]; messagesUpdated: number }> {
  const payload = await getPayloadClient()
  let threadId = opts?.threadId
  let legacyRaw = opts?.legacyParticipants

  if (!threadId) {
    const found = await payload.find({
      collection: 'threads',
      where: { collection: { equals: collectionName } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = found.docs[0]
    if (!doc) return { participants: [], messagesUpdated: 0 }
    threadId = String(doc.id)
    legacyRaw = doc.participants
  }

  let participants: ParticipantRecord[]

  if (isLegacyEmbeddedParticipants(legacyRaw)) {
    participants = await migrateThreadParticipantsToRelations(
      threadId,
      extractLegacyParticipantRows(legacyRaw),
    )
  } else {
    const col = await getCollection(collectionName)
    const senderNames = (await col.distinct('sender_name') as string[]).filter(Boolean)
    let names: string[] = senderNames

    const related = mapRelationParticipants(legacyRaw)
    if (related.length > 0) {
      names = [...new Set([...related.map(p => p.name), ...senderNames])]
    } else if (Array.isArray(legacyRaw) && legacyRaw.every(p => typeof p === 'string' || typeof p === 'number')) {
      const ids = legacyRaw.map(String)
      const found = await payload.find({
        collection: 'participants',
        where: { id: { in: ids } },
        limit: ids.length,
        depth: 0,
        overrideAccess: true,
      })
      names = [...new Set([
        ...mapRelationParticipants(found.docs).map(p => p.name),
        ...senderNames,
      ])]
    }

    const { participants: rows } = await upsertParticipants(names)
    participants = rows
    await payload.update({
      collection: 'threads',
      id: threadId,
      data: { participants: rows.map(p => p.id) },
      overrideAccess: true,
    })
  }

  const byName: Record<string, string> = {}
  for (const p of participants) byName[p.name] = p.id
  const messagesUpdated = await backfillMessageSenderIds(collectionName, byName)

  // Keep stored title aligned with the participant-name default (Chat info can still rename later).
  await payload.update({
    collection: 'threads',
    id: threadId,
    data: {
      participants: participants.map(p => p.id),
      name: defaultThreadName(participants),
    },
    overrideAccess: true,
  })

  return { participants, messagesUpdated }
}

/** Stamp senderId on messages missing it, using sender_name → participant id. */
export async function backfillMessageSenderIds(
  collectionName: string,
  byName?: Record<string, string>,
): Promise<number> {
  const col = await getCollection(collectionName)
  let map = byName

  if (!map || Object.keys(map).length === 0) {
    const names = await col.distinct('sender_name') as string[]
    const { byName: built } = await upsertParticipants(names.filter(Boolean))
    map = built
  }

  let updated = 0
  for (const [name, id] of Object.entries(map)) {
    const result = await col.updateMany(
      { sender_name: name, $or: [{ senderId: { $exists: false } }, { senderId: null }, { senderId: '' }] },
      { $set: { senderId: id } },
    )
    updated += result.modifiedCount
  }
  return updated
}
