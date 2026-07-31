import { DailySummary } from '@/types'

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_ABBR   = ['Su','Mo','Tu','We','Th','Fr','Sa']

export function moodColor(mood: string) {
  const m = mood.toLowerCase()
  if (/happy|joy|fun|great|wonderful|light|playful|laugh|excited/.test(m)) return 'bg-emerald-400 dark:bg-emerald-500'
  if (/sad|miss|lonely|hurt|distant|cry|tears/.test(m))                    return 'bg-sky-400 dark:bg-sky-500'
  if (/tense|fight|argument|frustrat|angry|difficult|upset|hard/.test(m))  return 'bg-rose-400 dark:bg-rose-500'
  if (/love|romantic|close|tender|sweet|warm|intimate/.test(m))            return 'bg-pink-400 dark:bg-pink-500'
  if (/anxious|worry|uncertain|unsure|nervous|restless/.test(m))           return 'bg-amber-400 dark:bg-amber-500'
  if (/→/.test(m))                                                          return 'bg-violet-400 dark:bg-violet-500'
  return 'bg-mist-400 dark:bg-mist-500'
}

export function fmtDateLong(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return `${days[dow]}, ${MONTH_FULL[m - 1]} ${d}, ${y}`
}

export function fmtDateShort(dateStr: string) {
  const [, m, d] = dateStr.split('-').map(Number)
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const [y] = dateStr.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`
}

interface StoryCalendarProps {
  year: number
  month: number
  summaries: DailySummary[]
  selected: DailySummary | null
  isLoading: boolean
  onSelect: (s: DailySummary) => void
}

export function StoryCalendar({ year, month, summaries, selected, isLoading, onSelect }: StoryCalendarProps) {
  const byDay: Record<number, DailySummary> = {}
  for (const s of summaries) byDay[s.day] = s

  const firstDow   = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  if (isLoading) return (
    <div className="grid grid-cols-7 gap-0.5">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-md bg-mist-100 dark:bg-mist-800 animate-pulse" />
      ))}
    </div>
  )

  return (
    <>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_ABBR.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-mist-400 dark:text-mist-600 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const s = byDay[day]
          const isSelected = selected?.day === day && selected?.month === month && selected?.year === year
          return (
            <button
              key={day}
              onClick={() => s && onSelect(s)}
              disabled={!s}
              title={s ? `${fmtDateLong(s.date)} — ${s.mood}` : undefined}
              className={`aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors
                ${s ? 'cursor-pointer hover:bg-mist-100 dark:hover:bg-mist-800' : 'cursor-default'}
                ${isSelected ? 'bg-mist-100 dark:bg-mist-800 ring-1 ring-mist-300 dark:ring-mist-600' : ''}
              `}
            >
              <span className={`text-[11px] leading-none font-medium ${s ? 'text-gray-700 dark:text-mist-200' : 'text-mist-300 dark:text-mist-700'}`}>{day}</span>
              {s && <div className={`w-1.5 h-1.5 rounded-full ${moodColor(s.mood)}`} />}
            </button>
          )
        })}
      </div>
    </>
  )
}
