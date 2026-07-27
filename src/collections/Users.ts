import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'name' },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'superAdmin',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'currentChallenge',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'passkeys',
      type: 'array',
      admin: { hidden: true },
      fields: [
        { name: 'credentialID', type: 'text', required: true },
        { name: 'publicKey', type: 'text', required: true },
        { name: 'counter', type: 'number', required: true },
        { name: 'deviceType', type: 'text' },
        { name: 'backedUp', type: 'checkbox' },
        { name: 'transports', type: 'text' },
        { name: 'nickname', type: 'text' },
        { name: 'createdAt', type: 'text' },
        { name: 'lastUsedAt', type: 'text' },
      ],
    },
  ],
}
