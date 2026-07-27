import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import ServiceWorker from '@/components/ServiceWorker'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Jasper & Ciara',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jasper & Ciara',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
}

export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s!=='light'&&d))document.documentElement.classList.add('dark')})()` }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
