import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { HashtagGroups } from './collections/HashtagGroups'
import { Hashtags } from './collections/Hashtags'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [Users, Hashtags, HashtagGroups],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'resibo-secret-key',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || '',
    connectOptions: { maxPoolSize: 3 },
  }),
})
