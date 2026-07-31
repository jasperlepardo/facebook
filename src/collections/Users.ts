import type { CollectionConfig } from 'payload'
import { selfOrSuperAdmin, superAdminField, isSuperAdminUser } from '@/lib/payload-access-control'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'name' },
  auth: true,
  access: {
    // Creates go through /api/auth/signup with overrideAccess — not open REST
    create: () => false,
    read:   selfOrSuperAdmin,
    update: selfOrSuperAdmin,
    delete: ({ req: { user } }) => isSuperAdminUser(user),
    admin:  ({ req: { user } }) => isSuperAdminUser(user),
  },
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
      access: {
        create: superAdminField,
        update: superAdminField,
        read:   ({ req: { user }, doc }) => {
          if (isSuperAdminUser(user)) return true
          return String(user?.id) === String(doc?.id)
        },
      },
    },
    {
      name: 'currentChallenge',
      type: 'text',
      admin: { hidden: true },
      access: { read: () => false, update: () => false },
    },
    {
      name: 'passkeys',
      type: 'array',
      admin: { hidden: true },
      access: {
        read:   ({ req: { user }, doc }) => isSuperAdminUser(user) || String(user?.id) === String(doc?.id),
        update: ({ req: { user }, id }) => isSuperAdminUser(user) || String(user?.id) === String(id),
      },
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
