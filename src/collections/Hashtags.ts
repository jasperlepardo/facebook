import type { CollectionConfig } from 'payload'

export const Hashtags: CollectionConfig = {
  slug: 'hashtags',
  versions: { maxPerDoc: 100 },
  access: { read: () => true, create: ({ req }) => !!req.user, update: ({ req }) => !!req.user, delete: ({ req }) => !!req.user },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'context', 'groupCount'] },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Hyphenated, e.g. first-date' } },
    { name: 'context', type: 'textarea' },
    { name: 'firstMsgTs', type: 'number', admin: { description: 'Timestamp (ms) of the earliest tagged message group — used for sorting' } },
    { name: 'groupCount', type: 'number', defaultValue: 0, admin: { description: 'Number of tagged message groups' } },
  ],
}
