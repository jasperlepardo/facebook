import type { CollectionConfig } from 'payload'

const ALL_TAGS = [
  'milestone', 'religion', 'jealousy', 'conflict', 'pattern',
  'foreshadowing', 'travel', 'money', 'friendship', 'social',
  'work', 'wedding-planning', 'first-contact', 'first-date', 'getting-to-know',
]

export const Notes: CollectionConfig = {
  slug: 'notes',
  access: {
    read:   () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'start', 'end', 'tags'],
    listSearchableFields: ['title', 'body'],
  },
  fields: [
    {
      name: 'start',
      type: 'text',
      required: true,
      admin: {
        description: 'ISO date or datetime: 2016-07-14 or 2016-07-14T13:06',
      },
    },
    {
      name: 'end',
      type: 'text',
      admin: {
        description: 'ISO date or datetime: 2016-07-31 or 2016-07-31T23:59',
      },
    },
    {
      name: 'tags',
      type: 'select',
      hasMany: true,
      options: ALL_TAGS.map(t => ({ label: t, value: t })),
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
    },
  ],
}
