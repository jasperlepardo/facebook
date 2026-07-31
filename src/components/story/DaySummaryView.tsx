import { DailySummary, Arc } from '@/types'
import { moodColor, fmtDateLong, fmtDateShort } from './StoryCalendar'

interface DaySummaryViewProps {
  summary: DailySummary
  parentArc: Arc | null
  onJumpToMessages: (ts: number) => void
  onNavigateToDate: (dateStr: string) => void
  onBackToArc: () => void
}

export function DaySummaryView({ summary, parentArc, onJumpToMessages, onNavigateToDate, onBackToArc }: DaySummaryViewProps) {
  return (
    <div key={summary.date} className="max-w-prose [animation:fade-up_320ms_ease-out]">
      {parentArc && (
        <button
          onClick={onBackToArc}
          className="flex items-center gap-1 text-[11px] text-mist-400 dark:text-mist-500 hover:text-mist-600 dark:hover:text-mist-300 transition-colors mb-3"
        >
          ← {parentArc.title}
        </button>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display text-base font-medium text-gray-900 dark:text-white leading-snug">{fmtDateLong(summary.date)}</h2>
          <p className="text-[11px] text-mist-400 dark:text-mist-500 mt-0.5">{summary.messageCount} messages</p>
        </div>
        <button
          onClick={() => { const [y, m, d] = summary.date.split('-').map(Number); onJumpToMessages(new Date(y, m - 1, d).getTime()) }}
          className="shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap"
        >
          Jump to messages →
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${moodColor(summary.mood)}`} />
        <span className="text-[11px] text-mist-500 dark:text-mist-400 italic">{summary.mood}</span>
      </div>

      <p className="text-sm leading-relaxed text-gray-700 dark:text-mist-200 mb-4">{summary.summary}</p>

      {summary.themes?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {summary.themes.map(t => (
            <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-mist-100 dark:bg-mist-800 text-mist-600 dark:text-mist-300">{t}</span>
          ))}
        </div>
      )}

      {summary.linkedDates?.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-mist-100 dark:border-mist-800 pt-3">
          {summary.linkedDates.map(link => (
            <button
              key={`${link.type}-${link.date}`}
              onClick={() => onNavigateToDate(link.date)}
              className="text-xs text-left text-mist-500 dark:text-mist-400 hover:text-mist-700 dark:hover:text-mist-200 transition-colors"
            >
              <span className="mr-1">
                {link.type === 'continues-from' ? '←' : link.type === 'resolved-on' ? '→' : '↗'}
              </span>
              {fmtDateShort(link.date)} — {link.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
