import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-bcf374add91945839b65e3ee37ef410d.r2.dev',
      },
    ],
  },
}

export default withPayload(nextConfig)
