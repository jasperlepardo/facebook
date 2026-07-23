import type { CollectionConfig } from 'payload'

export const Hashtags: CollectionConfig = {
  slug: 'hashtags',
  access: { read: () => true, create: () => true, update: () => true, delete: () => true },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'context'] },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Hyphenated, e.g. first-date' } },
    { name: 'context', type: 'textarea' },
    { name: 'msgIds', type: 'textarea', admin: { description: 'Comma-separated message IDs' } },
    { name: 'firstMsgTs', type: 'number', admin: { description: 'Timestamp (ms) of the earliest tagged message — used for sorting' } },
  ],
}
