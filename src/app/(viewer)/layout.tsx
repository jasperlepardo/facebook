import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = { title: 'Jasper & Ciara' }

export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  )
}
