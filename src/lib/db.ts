import { MongoClient } from 'mongodb'

const OPTIONS = { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 }

/** Allowed message-archive collection names: legacy `messages` or `thread_<hex>`. */
const SAFE_COLLECTION = /^(messages|thread_[0-9a-f]+)$/

export function isSafeCollectionName(name: string): boolean {
  return SAFE_COLLECTION.test(name)
}

export function assertSafeCollectionName(name: string): asserts name is string {
  if (!name || !SAFE_COLLECTION.test(name)) {
    throw new Error(`Invalid collection name: ${name}`)
  }
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function makeClientPromise() {
  return new MongoClient(process.env.MONGODB_URI!, OPTIONS).connect()
}

// In dev, attach to global so module hot-reloads don't open extra connections.
const clientPromise: Promise<MongoClient> =
  process.env.NODE_ENV === 'development'
    ? (global._mongoClientPromise ??= makeClientPromise())
    : makeClientPromise()

const indexedCollections = new Set<string>()

export async function getCollection(collectionName: string) {
  assertSafeCollectionName(collectionName)
  const col = (await clientPromise).db().collection(collectionName)
  if (!indexedCollections.has(collectionName)) {
    indexedCollections.add(collectionName)
    Promise.all([
      col.createIndex({ timestamp_ms: 1 }),
      col.createIndex({ blockId: 1, timestamp_ms: 1 }),
      col.createIndex({ content: 'text', sender_name: 'text' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { photos: { $exists: true } }, name: 'photos_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { videos: { $exists: true } }, name: 'videos_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { gifs: { $exists: true } }, name: 'gifs_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { audio_files: { $exists: true } }, name: 'audio_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { files: { $exists: true } }, name: 'files_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { sticker: { $exists: true } }, name: 'sticker_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { 'share.link': { $exists: true } }, name: 'share_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { call_duration: { $exists: true } }, name: 'calls_ts' }),
    ]).catch(err => console.error(`[db] index creation failed for ${collectionName}:`, err))
  }
  return col
}

export const getMessages = () => getCollection('messages')

export async function getSettings() {
  return (await clientPromise).db().collection('settings')
}

export async function getUserSettings() {
  return (await clientPromise).db().collection('user_settings')
}

export async function getHiddenItems() {
  return (await clientPromise).db().collection<HiddenItem>('hidden_items')
}

let dateIndexIndexed = false

export async function getDateIndexCollection() {
  const col = (await clientPromise).db().collection('date_indexes')
  if (!dateIndexIndexed) {
    dateIndexIndexed = true
    col.createIndex({ thread: 1 }, { unique: true })
      .catch(err => console.error('[db] date_indexes index failed:', err))
  }
  return col
}

let arcsIndexed = false

export async function getArcs() {
  const col = (await clientPromise).db().collection('arcs')
  if (!arcsIndexed) {
    arcsIndexed = true
    Promise.all([
      col.createIndex({ startDate: 1 }),
      col.createIndex({ endDate: 1 }),
    ]).catch(() => {})
  }
  return col
}

let summariesIndexed = false

export async function getDailySummaries() {
  const col = (await clientPromise).db().collection('daily_summaries')
  if (!summariesIndexed) {
    summariesIndexed = true
    Promise.all([
      col.createIndex({ date: 1 }, { unique: true }),
      col.createIndex({ year: 1, month: 1 }),
    ]).catch(() => {})
  }
  return col
}

export interface HiddenItem {
  _id?: import('mongodb').ObjectId
  type: 'message' | 'uri'
  value: string
  note?: string
  createdAt: string
  createdBy?: string
}
