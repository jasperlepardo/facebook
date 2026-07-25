import type { CollectionConfig, PayloadRequest } from 'payload'

async function resyncHashtag(hashtagId: string, req: PayloadRequest) {
  if (!hashtagId) return
  const result = await req.payload.find({
    collection: 'hashtag-groups',
    where: { hashtagId: { equals: hashtagId } },
    sort: 'firstMsgTs',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  try {
    await req.payload.update({
      collection: 'hashtags',
      id: hashtagId,
      data: {
        groupCount: result.totalDocs,
        ...(result.docs[0]?.firstMsgTs != null ? { firstMsgTs: result.docs[0].firstMsgTs } : {}),
      },
      overrideAccess: true,
    })
  } catch { /* hashtag may have been deleted — ignore */ }
}

export const HashtagGroups: CollectionConfig = {
  slug: 'hashtag-groups',
  versions: { maxPerDoc: 100 },
  access: { read: () => true, create: ({ req }) => !!req.user, update: ({ req }) => !!req.user, delete: ({ req }) => !!req.user },
  admin: { useAsTitle: 'blockId', defaultColumns: ['hashtagId', 'blockId'] },
  hooks: {
    afterChange: [({ doc, req }) => resyncHashtag(doc.hashtagId, req)],
    afterDelete: [({ doc, req }) => resyncHashtag(doc.hashtagId, req)],
  },
  fields: [
    { name: 'hashtagId', type: 'text', required: true },
    { name: 'blockId', type: 'text', required: true },
    { name: 'firstMsgTs', type: 'number' },
  ],
}
