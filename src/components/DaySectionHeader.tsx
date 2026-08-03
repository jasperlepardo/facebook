'use client'
import DateMenu from '@/components/DateMenu'
import StickyFrostedBar from '@/components/StickyFrostedBar'
import { DateIndex } from '@/types'

interface DaySectionHeaderProps {
  date: string
  ts?: number
  prevDayTs?: number
  nextDayTs?: number
  dateIndex?: DateIndex | null
  onJumpTo?: (target: string) => void
  onOpenDatePicker?: () => void
}

/** Chat-style day break: frosted sticky bar + centered date pill / DateMenu. */
export default function DaySectionHeader({
  date, ts, prevDayTs, nextDayTs, dateIndex, onJumpTo, onOpenDatePicker,
}: DaySectionHeaderProps) {
  return (
    <StickyFrostedBar className="dsep flex items-center justify-center py-2.5 px-4 !border-b-0">
      <span className="flex-1 border-t border-black/8 dark:border-white/10" />
      <span className="mx-3 flex-shrink-0">
        {onJumpTo ? (
          <DateMenu
            date={date}
            ts={ts}
            prevDayTs={prevDayTs}
            nextDayTs={nextDayTs}
            dateIndex={dateIndex}
            onJumpTo={onJumpTo}
            onOpenDatePicker={onOpenDatePicker}
          />
        ) : (
          <span className="liquid-glass text-[11px] font-semibold text-mist-500 dark:text-mist-400 px-3 py-1 rounded-full">
            {date}
          </span>
        )}
      </span>
      <span className="flex-1 border-t border-black/8 dark:border-white/10" />
    </StickyFrostedBar>
  )
}
