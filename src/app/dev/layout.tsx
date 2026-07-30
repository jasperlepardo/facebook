import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = { title: 'Dev — Resibo' }

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-mist-950 text-gray-900 dark:text-white`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
