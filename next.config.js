import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/',                  destination: '/api/index' },
        { source: '/api/messages',      destination: '/api/index' },
        { source: '/api/attachments',   destination: '/api/index' },
        { source: '/api/notes',         destination: '/api/index' },
        { source: '/api/notes/:id',     destination: '/api/index' },
        { source: '/api/jump',          destination: '/api/index' },
      ],
    }
  },
}

export default withPayload(nextConfig)
