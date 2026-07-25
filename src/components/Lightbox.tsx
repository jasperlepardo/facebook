'use client'
import { useEffect } from 'react'
import { LightboxState } from '@/types'

export default function Lightbox({ state, onClose, onJumpToMessage }: {
  state: LightboxState
  onClose: () => void
  onJumpToMessage?: (ts: number, msgId: string | null) => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  state.onPrev?.()
      if (e.key === 'ArrowRight') state.onNext?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, state])

  return (
    <div
      className="fixed inset-0 bg-black/[.92] z-[999] flex flex-col items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <span className="absolute top-3.5 right-4 text-white text-3xl cursor-pointer opacity-80 hover:opacity-100 leading-none" onClick={onClose}>✕</span>
      {onJumpToMessage && state.ts != null && (
        <button
          onClick={() => { onJumpToMessage(state.ts!, state.msgId ?? null); onClose() }}
          className="absolute top-4 left-4 text-white text-[12px] opacity-60 hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full"
        >
          View in chat
        </button>
      )}

      {state.onPrev && (
        <button onClick={state.onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl opacity-60 hover:opacity-100 transition-opacity px-2 select-none">
          ‹
        </button>
      )}
      {state.onNext && (
        <button onClick={state.onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl opacity-60 hover:opacity-100 transition-opacity px-2 select-none">
          ›
        </button>
      )}

      {state.type === 'video'
        ? <video src={state.src} controls autoPlay className="max-w-[92vw] max-h-[88vh] rounded object-contain" />
        : <img src={state.src} alt="" className="max-w-[92vw] max-h-[88vh] rounded object-contain" />
      }
      {state.caption && <p className="text-gray-400 text-xs mt-2 text-center">{state.caption}</p>}
    </div>
  )
}
