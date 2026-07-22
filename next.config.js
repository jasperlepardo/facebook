import { withPayload } from '@payloadcms/next/withPayload'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withPayload(nextConfig)
