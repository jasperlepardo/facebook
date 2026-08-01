import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = { title: 'Dev — Resibo' }

export default async function DevLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  const themeCookie = jar.get('theme')?.value
  const darkClass = themeCookie === 'dark' ? 'dark' : undefined

  return (
    <html lang="en" className={darkClass} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=document.cookie.match(/(?:^|; )theme=([^;]*)/);var t=s?decodeURIComponent(s[1]):null;if(t)return;var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')})()` }} />
      </head>
      <body className={`${inter.className} text-gray-900 dark:text-white`} suppressHydrationWarning>
        <div className="liquid-glass-atmosphere min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
