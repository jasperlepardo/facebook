import { MongoClient } from 'mongodb'

let client: MongoClient | null = null

async function getClient() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10000 })
    await client.connect()
  }
  return client
}

let messagesIndexed = false

export async function getMessages() {
  const col = (await getClient()).db('ciara-notes').collection('messages')
  if (!messagesIndexed) {
    messagesIndexed = true
    col.createIndex({ timestamp_ms: 1 }, { background: true }).catch(() => {})
  }
  return col
}

export async function getSettings() {
  return (await getClient()).db('ciara-notes').collection('settings')
}

