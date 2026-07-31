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
    // ── Editable ──────────────────────────────────────────────────────────────
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Display name shown in the app' },
    },
    {
      name: 'initials',
      type: 'text',
      admin: { description: 'Avatar initials (1-2 chars)' },
    },
    {
      name: 'color',
      type: 'select',
      defaultValue: 'bg-rose-400',
      options: [
        { label: 'Rose',    value: 'bg-rose-400' },
        { label: 'Violet',  value: 'bg-violet-400' },
        { label: 'Amber',   value: 'bg-amber-400' },
        { label: 'Sky',     value: 'bg-sky-400' },
        { label: 'Pink',    value: 'bg-pink-400' },
        { label: 'Indigo',  value: 'bg-indigo-400' },
        { label: 'Emerald', value: 'bg-emerald-400' },
        { label: 'Orange',  value: 'bg-orange-400' },
      ],
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
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'name', type: 'text' },
      ],
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
