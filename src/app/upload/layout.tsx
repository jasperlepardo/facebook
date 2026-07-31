import type { ReactNode } from 'react'
import { Inter, Newsreader } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  style: ['normal', 'italic'],
})

export const metadata = { title: 'Import Thread — Resibo' }

export default function UploadLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} bg-mist-50 dark:bg-mist-950 min-h-screen`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
