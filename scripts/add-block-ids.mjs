/**
 * One-time migration: adds blockId to every message in MongoDB.
 * blockId = _id of the first message in the visual group
 * (same sender, same day, within 5 minutes of previous message).
 *
 * Usage: node scripts/add-block-ids.mjs
 */

import { MongoClient } from 'mongodb'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const match = env.match(/MONGODB_URI="([^"]+)"/)
if (!match) { console.error('MONGODB_URI not found in .env.local'); process.exit(1) }

const client = new MongoClient(match[1])
await client.connect()
const col = client.db().collection('messages')

console.log('Fetching messages…')
const all = await col
  .find({}, { projection: { timestamp_ms: 1, sender_name: 1 } })
  .sort({ timestamp_ms: 1 })
  .toArray()

console.log(`Computing block IDs for ${all.length} messages…`)

function day(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const ops = []
let lastDay = null, lastSender = null, lastTs = 0, blockId = null

for (const m of all) {
  const d = day(m.timestamp_ms)
  const newDay = d !== lastDay
  const grouped = !newDay && m.sender_name === lastSender

  if (!grouped) blockId = m._id
  lastDay = d
  lastSender = m.sender_name
  lastTs = m.timestamp_ms

  ops.push({ updateOne: { filter: { _id: m._id }, update: { $set: { blockId } } } })
}

const BATCH = 1000
for (let i = 0; i < ops.length; i += BATCH) {
  await col.bulkWrite(ops.slice(i, i + BATCH), { ordered: false })
  process.stdout.write(`\r  ${Math.min(i + BATCH, ops.length).toLocaleString()} / ${ops.length.toLocaleString()}`)
}

console.log('\nDone.')
await client.close()
