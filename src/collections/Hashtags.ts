import type { CollectionConfig, PayloadRequest } from 'payload'

async function deleteGroups(hashtagId: string, req: PayloadRequest) {
  // Delete directly via the Mongoose model to bypass per-doc afterDelete hooks
  // (each hook would try to resync the already-deleted hashtag and fail)
  const model = (req.payload.db as any).collections['hashtag-groups']
  await model.deleteMany({ hashtagId })
}

export const Hashtags: CollectionConfig = {
  slug: 'hashtags',
  versions: { maxPerDoc: 100 },
  access: { read: () => true, create: ({ req }) => !!req.user, update: ({ req }) => !!req.user, delete: ({ req }) => !!req.user },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'context', 'groupCount'] },
  hooks: {
    afterDelete: [({ doc, req }) => deleteGroups(doc.id, req)],
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Hyphenated, e.g. first-date' } },
    { name: 'thread', type: 'text', admin: { description: 'Collection name of the thread this hashtag belongs to' } },
    { name: 'context', type: 'textarea' },
    { name: 'isPrivate', type: 'checkbox', defaultValue: false, admin: { description: 'If true, only visible to the author (createdById) and super admins' } },
    { name: 'createdBy', type: 'text', admin: { readOnly: true, description: 'Name of the user who created this hashtag' } },
    { name: 'createdById', type: 'text', admin: { readOnly: true, description: 'User ID of the creator — used for private visibility checks' } },
    { name: 'firstMsgTs', type: 'number', admin: { description: 'Timestamp (ms) of the earliest tagged message group — used for sorting' } },
    { name: 'groupCount', type: 'number', defaultValue: 0, admin: { description: 'Number of tagged message groups' } },
  ],
}
