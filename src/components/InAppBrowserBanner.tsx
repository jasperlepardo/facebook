'use client'
import { useEffect, useState } from 'react'

function detectInAppBrowser(): 'messenger' | 'facebook' | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/MessengerForiOS|FBAN\/Messenger/i.test(ua)) return 'messenger'
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook'
  return null
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

function openInBrowser() {
  const url = window.location.href
  if (isAndroid()) {
    // Android intent URI — tells the OS to open in the default browser
    const noProto = url.replace(/^https?:\/\//, '')
    const scheme = url.startsWith('https') ? 'https' : 'http'
    window.location.href = `intent://${noProto}#Intent;scheme=${scheme};action=android.intent.action.VIEW;end;`
  }
  // iOS: no reliable escape from in-app browser — handled via copy button
}

export default function InAppBrowserBanner() {
  const [browser, setBrowser] = useState<'messenger' | 'facebook' | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setBrowser(detectInAppBrowser())
  }, [])

  if (!browser || dismissed) return null

  const android = isAndroid()

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 liquid-glass-bar text-[12px]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mist-400 dark:text-mist-500">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span className="flex-1 text-mist-600 dark:text-mist-300 leading-snug">
        Opening in your browser gives you the full experience.
      </span>
      {android ? (
        <button
          onClick={openInBrowser}
          className="shrink-0 font-semibold liquid-glass-btn liquid-glass-chip !h-7 text-mist-800 dark:text-white"
        >
          Open
        </button>
      ) : (
        <button
          onClick={handleCopy}
          className="shrink-0 font-semibold liquid-glass-btn liquid-glass-chip !h-7 text-mist-800 dark:text-white"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-mist-400 dark:text-mist-500 hover:text-mist-600 dark:hover:text-mist-300 transition-colors p-1 -mr-1"
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
