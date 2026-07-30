import { MongoClient } from 'mongodb'

const OPTIONS = { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 }

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

let messagesIndexed = false

export async function getMessages() {
  const col = (await clientPromise).db().collection('messages')
  if (!messagesIndexed) {
    messagesIndexed = true
    Promise.all([
      col.createIndex({ timestamp_ms: 1 }),
      col.createIndex({ blockId: 1, timestamp_ms: 1 }),
      col.createIndex({ content: 'text', sender_name: 'text' }),
      // Partial indexes for fast attachment aggregation $match + $sort
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { photos: { $exists: true } }, name: 'photos_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { videos: { $exists: true } }, name: 'videos_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { gifs: { $exists: true } }, name: 'gifs_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { audio_files: { $exists: true } }, name: 'audio_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { files: { $exists: true } }, name: 'files_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { sticker: { $exists: true } }, name: 'sticker_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { 'share.link': { $exists: true } }, name: 'share_ts' }),
      col.createIndex({ timestamp_ms: 1 }, { partialFilterExpression: { call_duration: { $exists: true } }, name: 'calls_ts' }),
    ]).catch(() => {})
  }
  return col
}

export async function getSettings() {
  return (await clientPromise).db().collection('settings')
}

export async function getUserSettings() {
  return (await clientPromise).db().collection('user_settings')
}

export async function getHiddenItems() {
  return (await clientPromise).db().collection<HiddenItem>('hidden_items')
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
