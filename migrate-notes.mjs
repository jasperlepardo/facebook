/**
 * migrate-notes.mjs
 * Seeds notes.json into Payload CMS via the REST API.
 *
 * Usage:
 *   node migrate-notes.mjs                        (prompts for credentials)
 *   node migrate-notes.mjs <email> <password>
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const BASE = 'http://localhost:3001'
const NOTES_FILE = path.resolve(fileURLToPath(import.meta.url), '../../notes.json')

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

async function request(method, urlPath, body, token) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data?.errors ?? data)}`)
  return data
}

async function main() {
  let [,, email, password] = process.argv
  if (!email)    email    = await ask('Payload email: ')
  if (!password) password = await ask('Password: ')

  // Login
  console.log(`\nLogging in as ${email}…`)
  const { token } = await request('POST', '/api/users/login', { email, password })
  console.log('Authenticated ✓\n')

  // Load notes
  const notes = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf-8'))
  console.log(`Migrating ${notes.length} notes…\n`)

  let ok = 0, failed = 0

  for (const note of notes) {
    try {
      await request('POST', '/api/notes', note, token)
      console.log(`  ✓  ${note.start.padEnd(19)}  ${note.title}`)
      ok++
    } catch (err) {
      console.error(`  ✗  ${note.start.padEnd(19)}  ${note.title}`)
      console.error(`     ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${ok} created, ${failed} failed.`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
