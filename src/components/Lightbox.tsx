'use client'
import { useEffect } from 'react'
import { LightboxState } from '@/types'

export default function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/[.92] z-[999] flex flex-col items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <span className="absolute top-3.5 right-4 text-white text-3xl cursor-pointer opacity-80 hover:opacity-100 leading-none" onClick={onClose}>✕</span>
      {state.type === 'video'
        ? <video src={state.src} controls autoPlay className="max-w-[92vw] max-h-[88vh] rounded object-contain" />
        : <img src={state.src} alt="" className="max-w-[92vw] max-h-[88vh] rounded object-contain" />
      }
      {state.caption && <p className="text-gray-400 text-xs mt-2 text-center">{state.caption}</p>}
    </div>
  )
}
