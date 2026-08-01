import type { CollectionConfig } from 'payload'
import { authenticated, superAdminOnly } from '@/lib/payload-access-control'

export const Threads: CollectionConfig = {
  slug: 'threads',
  access: {
    read:   authenticated,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'collection', 'messageCount'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Display name shown in the app' },
    },

    // ── Set on import, read-only ───────────────────────────────────────────────
    {
      name: 'collection',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'MongoDB collection name — do not change after import',
      },
    },
    {
      name: 'facebookThreadId',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Facebook thread ID from export folder name',
      },
    },
    {
      name: 'participants',
      type: 'relationship',
      relationTo: 'participants',
      hasMany: true,
      admin: { description: 'Members — global Participant docs' },
    },
    {
      name: 'messageCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Updated after each import',
      },
    },
  ],
}
