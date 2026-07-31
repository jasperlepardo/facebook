export function toast(message: string, duration = 2500) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, duration } }))
}
