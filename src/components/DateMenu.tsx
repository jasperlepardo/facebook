'use client'
import { useEffect, useRef, useState } from 'react'
import { DateIndex } from '@/types'
import { fmtDate } from '@/lib/format'

function tsToIsoWeek(ts: number) {
  const d = new Date(ts)
  const dow = d.getUTCDay()
  return new Date(ts - (dow === 0 ? 6 : dow - 1) * 86400000).toISOString().split('T')[0]
}

function tsToIsoMonth(ts: number) {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function computeDynamicOptions(
  ts: number,
  index: DateIndex | null | undefined,
  prevDayTs?: number,
  nextDayTs?: number,
): { label: string; val: string }[] {
  const curWeek  = tsToIsoWeek(ts)
  const curMonth = tsToIsoMonth(ts)
  const curDate  = new Date(ts)

  // A UTC ISO date boundary (at UTC midnight) can land on the same LOCAL day as ts
  // due to timezone offset — skip those to avoid "Go to August 1" when already there.
  const sameLocalDay = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z')
    return d.getFullYear() === curDate.getFullYear() &&
      d.getMonth() === curDate.getMonth() &&
      d.getDate() === curDate.getDate()
  }
  const findNext = <T extends { iso: string }>(arr: T[], afterIso: string): T | null =>
    arr.find(e => e.iso > afterIso && !sameLocalDay(e.iso)) ?? null

  // Day prev/next: only from adjacent rendered blocks — UTC-index labels are
  // unreliable across timezones and can point to days with no local messages.
  const pd = prevDayTs != null ? { label: fmtDate(prevDayTs), iso: `ts:${prevDayTs}` } : null
  const nd = nextDayTs != null ? { label: fmtDate(nextDayTs), iso: `ts:${nextDayTs}` } : null

  const pw = index ? index.weeks.findLast(w => w.iso < curWeek) ?? null : null
  const nw = index ? findNext(index.weeks, curWeek) : null
  const pm = index ? index.months.findLast(m => m.iso < curMonth) ?? null : null
  const nm = index ? findNext(index.months, curMonth) : null

  const seen = new Set<string>()
  return [
    pm && { label: `Go back to ${pm.label}`, val: pm.iso },
    pw && { label: `Go back to ${pw.label}`, val: pw.iso },
    pd && { label: `Go back to ${pd.label}`, val: pd.iso },
    nd && { label: `Go to ${nd.label}`,      val: nd.iso },
    nw && { label: `Go to ${nw.label}`,      val: nw.iso },
    nm && { label: `Go to ${nm.label}`,      val: nm.iso },
  ].filter((o): o is { label: string; val: string } => !!o && !seen.has(o.val) && seen.add(o.val) !== undefined)
}

interface DateMenuProps {
  date: string
  ts?: number
  prevDayTs?: number
  nextDayTs?: number
  dateIndex?: DateIndex | null
  onJumpTo: (target: string) => void
  onOpenDatePicker?: () => void
}

export default function DateMenu({ date, ts, prevDayTs, nextDayTs, dateIndex, onJumpTo, onOpenDatePicker }: DateMenuProps) {
  const [open, setOpen]   = useState(false)
  const [above, setAbove] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = () => { setSticky(''); setOpen(false) }
    const clickHandler = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', clickHandler)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', clickHandler)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  const setSticky = (z: string) => {
    const el = btnRef.current?.closest<HTMLElement>('.dsep')
    if (el) el.style.zIndex = z
  }

  const openMenu = () => {
    if (btnRef.current) setAbove(btnRef.current.getBoundingClientRect().bottom > window.innerHeight * 0.6)
    setOpen(o => { if (!o) setSticky('50'); return !o })
  }

  const select = (target: string) => { setSticky(''); setOpen(false); onJumpTo(target) }

  const dynamicOptions = ts ? computeDynamicOptions(ts, dateIndex, prevDayTs, nextDayTs) : []

  return (
    <div className="relative">
      <button ref={btnRef} onClick={openMenu}
        className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-mist-50 dark:bg-mist-900 border border-mist-200 dark:border-mist-700 shadow-xs hover:bg-mist-100 dark:hover:bg-mist-800 transition-colors whitespace-nowrap text-mist-500 dark:text-mist-400"
      >
        {date} <span className="text-[10px] opacity-60">▾</span>
      </button>

      {open && (
        <div ref={dropRef}
          className={`absolute left-1/2 -translate-x-1/2 bg-white dark:bg-mist-800 border border-mist-200 dark:border-mist-700 rounded-xl shadow-xl z-50 w-64 py-2 text-left text-[13px] text-gray-900 dark:text-mist-100 ${above ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <button onClick={() => select('beginning')} className="w-full text-left px-4 py-2 hover:bg-mist-50 dark:hover:bg-mist-700 transition-colors">
            Start from the beginning
          </button>

          {dynamicOptions.length > 0 && (
            <>
              <div className="border-t border-mist-100 dark:border-mist-700 my-1" />
              {dynamicOptions.map(o => (
                <button key={o.val} onClick={() => select(o.val)}
                  className="w-full text-left px-4 py-2 hover:bg-mist-50 dark:hover:bg-mist-700 transition-colors">
                  {o.label}
                </button>
              ))}
            </>
          )}

          <div className="border-t border-mist-100 dark:border-mist-700 mt-1 pt-1">
            <button onClick={() => select('recent')} className="w-full text-left px-4 py-2 hover:bg-mist-50 dark:hover:bg-mist-700 transition-colors">
              Most recent
            </button>
            {onOpenDatePicker && (
              <button onClick={() => { setSticky(''); setOpen(false); onOpenDatePicker() }}
                className="w-full text-left px-4 py-2 hover:bg-mist-50 dark:hover:bg-mist-700 transition-colors">
                Jump to a specific date
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
