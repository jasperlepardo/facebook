import { MongoClient } from 'mongodb'

let client: MongoClient | null = null

async function getClient() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10000 })
    await client.connect()
  }
  return client
}

export async function getMessages() {
  return (await getClient()).db('ciara-notes').collection('messages')
}

export async function getSettings() {
  return (await getClient()).db('ciara-notes').collection('settings')
}
