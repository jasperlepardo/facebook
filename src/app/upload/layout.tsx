import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = { title: 'Import Thread — Resibo' }

export default function UploadLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-mist-50 dark:bg-mist-950 min-h-screen`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
