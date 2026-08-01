import type { CollectionConfig } from 'payload'
import { authenticated, superAdminOnly } from '@/lib/payload-access-control'
import { PARTICIPANT_COLOR_OPTIONS } from '@/lib/participantColors'

export const Participants: CollectionConfig = {
  slug: 'participants',
  access: {
    read:   authenticated,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'initials', 'color'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Facebook display name — matches message sender_name' },
    },
    {
      name: 'normalizedName',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: 'Lowercased alphanumerics for dedup lookup',
      },
    },
    {
      name: 'initials',
      type: 'text',
      admin: { description: 'Avatar initials (1-2 chars)' },
    },
    {
      name: 'color',
      type: 'select',
      defaultValue: 'bg-violet-400',
      options: [...PARTICIPANT_COLOR_OPTIONS],
    },
  ],
}
