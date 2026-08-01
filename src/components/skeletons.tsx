import type { CSSProperties } from 'react'

/** Panel-level loading skeletons matched to real UI layouts. */

import { pbNav } from '@/lib/ui'

function Bone({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded-md bg-mist-200 dark:bg-mist-700/70 ${className}`} style={style} />
}

/** Thread / hashtag list — matches ListPane. */
export function ListPaneSkeleton({ titleWidth = 'w-16' }: { titleWidth?: string }) {
  return (
    <div className="flex flex-col h-full bg-transparent" aria-hidden>
      <div className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 shrink-0">
        <Bone className={`h-[22px] ${titleWidth} mb-3 rounded-lg`} />
        <Bone className="h-9 w-full rounded-full bg-mist-100 dark:bg-mist-800" />
      </div>
      <div className={`flex-1 overflow-hidden ${pbNav} md:pb-0`}>
        {[72, 58, 64, 48, 70, 52, 60].map((w, i) => (
          <div key={i} className="px-2 py-1.5 flex items-center gap-3 mx-1 my-0.5">
            <Bone className="w-14 h-14 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <Bone className="h-[15px] rounded-md" style={{ width: `${w}%` }} />
              <Bone className="h-[13px] rounded-md bg-mist-100 dark:bg-mist-800" style={{ width: `${Math.max(w - 18, 28)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Dense archive log rows — matches MessageGroup / MessageRow. */
export function MessageListSkeleton({ rows = 8 }: { rows?: number }) {
  const patterns = [
    { name: 88, lines: [72, 48] },
    { name: 72, lines: [56] },
    { name: 96, lines: [80, 40] },
    { name: 64, lines: [44] },
    { name: 80, lines: [68, 52, 36] },
    { name: 70, lines: [60] },
    { name: 90, lines: [75, 45] },
    { name: 76, lines: [50] },
  ]
  return (
    <div className="flex flex-col py-2" aria-hidden>
      <div className="flex items-center justify-center py-2.5 px-4">
        <Bone className="h-6 w-36 rounded-full bg-mist-100 dark:bg-mist-800" />
      </div>
      {Array.from({ length: rows }).map((_, i) => {
        const p = patterns[i % patterns.length]
        return (
          <div key={i} className="flex items-start px-4 py-1 gap-3">
            <Bone className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5 pt-0.5">
              <div className="flex items-baseline gap-2">
                <Bone className="h-3.5 rounded-md" style={{ width: p.name }} />
                <Bone className="h-2.5 w-12 rounded-md bg-mist-100 dark:bg-mist-800" />
              </div>
              {p.lines.map((w, j) => (
                <Bone
                  key={j}
                  className="h-3.5 rounded-md bg-mist-100 dark:bg-mist-800/80"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Chat detail pane while messages load (bottom-anchored like the real scroll). */
export function ChatDetailSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent" aria-busy>
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        <MessageListSkeleton />
      </div>
    </div>
  )
}

/** Media gallery grid. */
export function GallerySkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="flex-1 overflow-hidden p-3 bg-transparent" aria-busy>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
        {Array.from({ length: count }).map((_, i) => (
          <Bone key={i} className="aspect-square rounded-xs" />
        ))}
      </div>
    </div>
  )
}

/** Story pane — year tabs + calendar + reading column. */
export function StoryPaneSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" aria-busy>
      <div className="shrink-0 px-4 pt-4 pb-2 flex gap-1 border-b border-mist-100 dark:border-mist-800">
        {[48, 40, 44].map((w, i) => (
          <Bone key={i} className="h-7 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="shrink-0 px-4 py-2 flex gap-1">
        {[36, 32, 40, 36, 34].map((w, i) => (
          <Bone key={i} className="h-6 rounded-full bg-mist-100 dark:bg-mist-800" style={{ width: w }} />
        ))}
      </div>
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-52 shrink-0 border-r border-mist-100 dark:border-mist-800 flex flex-col min-h-0 p-3 gap-3">
          <div className="flex gap-1">
            <Bone className="flex-1 h-7 rounded-full" />
            <Bone className="flex-1 h-7 rounded-full bg-mist-100 dark:bg-mist-800" />
          </div>
          <Bone className="h-3 w-24 rounded-md bg-mist-100 dark:bg-mist-800" />
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Bone key={i} className="aspect-square rounded-md bg-mist-100 dark:bg-mist-800" />
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 px-5 py-4 flex flex-col gap-3">
          <Bone className="h-5 w-48 rounded-md" />
          <Bone className="h-3 w-28 rounded-md bg-mist-100 dark:bg-mist-800" />
          <Bone className="h-3 w-full rounded-md bg-mist-100 dark:bg-mist-800 mt-2" />
          <Bone className="h-3 w-[92%] rounded-md bg-mist-100 dark:bg-mist-800" />
          <Bone className="h-3 w-[80%] rounded-md bg-mist-100 dark:bg-mist-800" />
          <Bone className="h-3 w-[88%] rounded-md bg-mist-100 dark:bg-mist-800" />
          <Bone className="h-3 w-[70%] rounded-md bg-mist-100 dark:bg-mist-800" />
        </div>
      </div>
    </div>
  )
}

/** Settings / hidden-items list rows. */
export function SettingsRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="liquid-glass rounded-xl overflow-hidden divide-y divide-black/10 dark:divide-white/12" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Bone className="h-4 w-8 rounded-sm" />
              <Bone className="h-3 w-[60%] rounded-md" />
            </div>
            <Bone className="h-2.5 w-20 rounded-md bg-mist-100 dark:bg-mist-700" />
          </div>
          <Bone className="h-3 w-12 rounded-md bg-mist-100 dark:bg-mist-700 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Files / links card list in MediaPane. */
export function MediaListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex-1 overflow-hidden p-3 bg-transparent" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="liquid-glass rounded-lg px-3.5 py-3 mb-2 flex items-center gap-3">
          <Bone className="w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <Bone className="h-3.5 rounded-md" style={{ width: `${68 - (i % 3) * 10}%` }} />
            <Bone className="h-2.5 rounded-md bg-mist-100 dark:bg-mist-700" style={{ width: `${40 + (i % 4) * 8}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
