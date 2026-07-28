import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
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
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
}

export default async function ViewerLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  const themeCookie = jar.get('theme')?.value
  const darkClass = themeCookie === 'dark' ? 'dark' : undefined

  return (
    <html lang="en" className={darkClass} suppressHydrationWarning>
      <head>
        {/* Fallback for system theme with OS dark preference — runs before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=document.cookie.match(/(?:^|; )theme=([^;]*)/);var t=s?decodeURIComponent(s[1]):null;if(t)return;var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')})()` }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
