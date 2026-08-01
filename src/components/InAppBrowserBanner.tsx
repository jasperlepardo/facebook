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

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Once per tab — a blocked or cancelled hand-off must not retry on every mount. */
const AUTO_OPEN_KEY = 'inAppAutoOpenTried'

function openInBrowser() {
  const url = window.location.href
  const noProto = url.replace(/^https?:\/\//, '')
  if (isAndroid()) {
    // Android intent URI — the OS routes it to the installed PWA (WebAPK) or the default browser
    const scheme = url.startsWith('https') ? 'https' : 'http'
    window.location.href = `intent://${noProto}#Intent;scheme=${scheme};action=android.intent.action.VIEW;end;`
    return
  }
  if (isIOS()) {
    // Undocumented scheme the Facebook/Messenger webviews hand off to Safari.
    // Silently ignored where unsupported, so the copy-link fallback still applies.
    window.location.href = `x-safari-https://${noProto}`
  }
}

export default function InAppBrowserBanner() {
  const [browser, setBrowser] = useState<'messenger' | 'facebook' | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const detected = detectInAppBrowser()
    setBrowser(detected)
    if (!detected || (!isAndroid() && !isIOS())) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (sessionStorage.getItem(AUTO_OPEN_KEY)) return
    sessionStorage.setItem(AUTO_OPEN_KEY, '1')
    openInBrowser()
  }, [])

  if (!browser || dismissed) return null

  const canOpen = isAndroid() || isIOS()

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="fixed inset-x-0 top-[calc(0.5rem+var(--resibo-safe-top))] z-400 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto max-w-full flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full liquid-glass shadow-xl text-[12px] [animation:fade-up_220ms_ease-out]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mist-400 dark:text-mist-500">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span className="min-w-0 truncate text-mist-600 dark:text-mist-300">
          Better in your browser
        </span>
        {canOpen && (
          <button
            onClick={openInBrowser}
            className="shrink-0 font-semibold liquid-glass-btn liquid-glass-chip !h-7 text-mist-800 dark:text-white"
          >
            Open
          </button>
        )}
        {(!canOpen || isIOS()) && (
          <button
            onClick={handleCopy}
            className="shrink-0 font-semibold liquid-glass-btn liquid-glass-chip !h-7 text-mist-800 dark:text-white"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-mist-400 dark:text-mist-500 hover:text-mist-600 dark:hover:text-mist-300 transition-colors"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
