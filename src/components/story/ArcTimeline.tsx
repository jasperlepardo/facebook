import { Arc, DailySummary } from '@/types'
import { moodColor, fmtDateShort } from './StoryCalendar'

interface ArcTimelineProps {
  arcs: Arc[]
  selectedArc: Arc | null
  arcDays: DailySummary[]
  isPreview: boolean
  onSelectArc: (arc: Arc) => void
  onSelectDay: (day: DailySummary) => void
}

export function ArcTimeline({ arcs, selectedArc, arcDays, isPreview, onSelectArc, onSelectDay }: ArcTimelineProps) {
  if (arcs.length === 0) return (
    <div className="px-4 py-6 text-center">
      <p className="text-xs text-mist-400 dark:text-mist-500 leading-relaxed">
        {isPreview ? 'Sample arc shown below.' : 'No arcs yet. Run after generating summaries:'}
      </p>
      {!isPreview && (
        <code className="text-[10px] text-mist-500 dark:text-mist-400 block mt-2">
          node scripts/generate-arcs.mjs
        </code>
      )}
    </div>
  )

  return (
    <div className="flex flex-col">
      {arcs.map(arc => {
        const isActive = selectedArc?.title === arc.title && selectedArc?.startDate === arc.startDate
        return (
          <button
            key={`${arc.title}-${arc.startDate}`}
            onClick={() => onSelectArc(arc)}
            className={`text-left px-4 py-3 border-b border-mist-50 dark:border-mist-800/60 transition-colors
              ${isActive ? 'bg-mist-100 dark:bg-mist-800' : 'hover:bg-mist-50 dark:hover:bg-mist-800/50'}`}
          >
            <p className="text-xs font-semibold text-gray-800 dark:text-mist-100 leading-snug mb-0.5">{arc.title}</p>
            <p className="text-[10px] text-mist-400 dark:text-mist-500">
              {fmtDateShort(arc.startDate)} – {fmtDateShort(arc.endDate)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${moodColor(arc.mood)}`} />
              <span className="text-[10px] text-mist-400 dark:text-mist-500 italic truncate">{arc.mood}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

interface ArcDetailProps {
  arc: Arc
  arcDays: DailySummary[]
  onSelectDay: (day: DailySummary) => void
}

export function ArcDetail({ arc, arcDays, onSelectDay }: ArcDetailProps) {
  return (
    <div className="max-w-prose">
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{arc.title}</h2>
        <p className="text-[11px] text-mist-400 dark:text-mist-500">
          {fmtDateShort(arc.startDate)} – {fmtDateShort(arc.endDate)} · {arc.dayCount} day{arc.dayCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${moodColor(arc.mood)}`} />
        <span className="text-[11px] text-mist-500 dark:text-mist-400 italic">{arc.mood}</span>
      </div>
      <p className="text-sm leading-relaxed text-gray-700 dark:text-mist-200 mb-4">{arc.description}</p>
      {arc.themes?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {arc.themes.map(t => (
            <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-mist-100 dark:bg-mist-800 text-mist-600 dark:text-mist-300">{t}</span>
          ))}
        </div>
      )}
      {arcDays.length > 0 && (
        <div className="border-t border-mist-100 dark:border-mist-800 pt-4">
          <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 uppercase tracking-wide mb-2">Days in this arc</p>
          <div className="flex flex-col gap-1">
            {arcDays.map(day => (
              <button key={day.date} onClick={() => onSelectDay(day)}
                className="text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-mist-50 dark:hover:bg-mist-800/50 transition-colors group">
                <div className={`w-2 h-2 rounded-full shrink-0 ${moodColor(day.mood)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-mist-200">{fmtDateShort(day.date)}</p>
                  <p className="text-[10px] text-mist-400 dark:text-mist-500 italic truncate">{day.mood}</p>
                </div>
                <span className="text-[10px] text-mist-300 dark:text-mist-600 group-hover:text-mist-500 dark:group-hover:text-mist-400 transition-colors">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
