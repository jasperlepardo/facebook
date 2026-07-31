import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { HashtagGroups } from './collections/HashtagGroups'
import { Hashtags } from './collections/Hashtags'
import { Threads } from './collections/Threads'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET environment variable is not set')
}

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [Users, Hashtags, HashtagGroups, Threads],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || '',
    connectOptions: { maxPoolSize: 3 },
  }),
})
