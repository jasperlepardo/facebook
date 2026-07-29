import type { Metadata } from 'next'
import ViewerApp from '@/components/ViewerApp'

type Props = { searchParams: Promise<{ msg?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { msg } = await searchParams
  if (!msg) return {}
  const ogUrl = `/api/og?msgId=${msg}`
  return {
    openGraph: {
      title: 'Message · Resibo',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: 'Message preview' }],
    },
    twitter: { card: 'summary_large_image', images: [ogUrl] },
  }
}

export default function Page() {
  return <ViewerApp />
}
