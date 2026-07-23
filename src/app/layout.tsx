import type { ReactNode } from 'react'
import './globals.css'

export const metadata = { title: 'Jasper & Ciara' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
