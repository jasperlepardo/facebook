import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Jasper & Ciara',
  other: { 'apple-mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Blue for the status bar / top chrome; bottom bar picks up the gray nav background via frosted glass
  themeColor: '#2563eb',
}

export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ background: '#f9fafb' }}>
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  )
}
