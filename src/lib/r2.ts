import { S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'

export const R2_BUCKET = process.env.R2_BUCKET ?? ''

let _s3: S3Client | null = null

export function getS3(socketTimeoutMs = 60_000): S3Client {
  if (!_s3) _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10_000,
      socketTimeout:     socketTimeoutMs,
    }),
  })
  return _s3
}
