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
  const col = (await clientPromise).db('ciara-notes').collection('messages')
  if (!messagesIndexed) {
    messagesIndexed = true
    Promise.all([
      col.createIndex({ timestamp_ms: 1 }, { background: true }),
      col.createIndex({ blockId: 1 }, { background: true }),
      col.createIndex({ blockId: 1, timestamp_ms: 1 }, { background: true }),
      col.createIndex({ body: 'text', sender_name: 'text' }, { background: true }),
    ]).catch(() => {})
  }
  return col
}

export async function getSettings() {
  return (await clientPromise).db('ciara-notes').collection('settings')
}

export async function getHiddenItems() {
  return (await clientPromise).db('ciara-notes').collection<HiddenItem>('hidden_items')
}

export interface HiddenItem {
  _id?: import('mongodb').ObjectId
  type: 'message' | 'uri'
  value: string
  note?: string
  createdAt: string
  createdBy?: string
}
