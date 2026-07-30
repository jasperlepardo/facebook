'use client'
import { useState, useEffect, useCallback } from 'react'
import { DailySummary, Arc } from '@/types'
import { PREVIEW_BY_MONTH, PREVIEW_META, PREVIEW_ARCS } from '@/lib/storyPreviewData'


const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_ABBR    = ['Su','Mo','Tu','We','Th','Fr','Sa']

function moodColor(mood: string) {
  const m = mood.toLowerCase()
  if (/happy|joy|fun|great|wonderful|light|playful|laugh|excited/.test(m)) return 'bg-emerald-400 dark:bg-emerald-500'
  if (/sad|miss|lonely|hurt|distant|cry|tears/.test(m))                    return 'bg-sky-400 dark:bg-sky-500'
  if (/tense|fight|argument|frustrat|angry|difficult|upset|hard/.test(m))  return 'bg-rose-400 dark:bg-rose-500'
  if (/love|romantic|close|tender|sweet|warm|intimate/.test(m))            return 'bg-pink-400 dark:bg-pink-500'
  if (/anxious|worry|uncertain|unsure|nervous|restless/.test(m))           return 'bg-amber-400 dark:bg-amber-500'
  if (/→/.test(m))                                                          return 'bg-violet-400 dark:bg-violet-500'
  return 'bg-mist-400 dark:bg-mist-500'
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return `${days[dow]}, ${MONTH_FULL[m - 1]} ${d}, ${y}`
}

function fmtShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`
}

interface StoryPaneProps {
  onJumpToMessages: (ts: number) => void
}

export default function StoryPane({ onJumpToMessages }: StoryPaneProps) {
  const [meta, setMeta]             = useState<{ years: number[]; byYear: Record<number, number[]> } | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [hasApiKey, setHasApiKey]   = useState<boolean | null>(null)
  const [selectedYear, setSelectedYear]   = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [daySummaries, setDaySummaries]   = useState<DailySummary[]>([])
  const [monthLoading, setMonthLoading]   = useState(false)
  const [selected, setSelected]           = useState<DailySummary | null>(null)
  const [previewMode, setPreviewMode]     = useState(false)
  const [leftTab, setLeftTab]             = useState<'calendar' | 'arcs'>('calendar')
  const [arcs, setArcs]                   = useState<Arc[]>([])
  const [selectedArc, setSelectedArc]     = useState<Arc | null>(null)
  const [arcDays, setArcDays]             = useState<DailySummary[]>([])

  const enterPreview = useCallback(() => {
    const month = PREVIEW_BY_MONTH['2018-3']
    setPreviewMode(true)
    setSelectedYear(2018)
    setSelectedMonth(3)
    setDaySummaries(month)
    setSelected(month.find(d => d.date === '2018-03-14') ?? month[0])
    setArcs(PREVIEW_ARCS)
  }, [])

  // Fetch meta + API key status in parallel
  useEffect(() => {
    Promise.all([
      fetch('/api/summaries?meta=1').then(r => r.json()),
      fetch('/api/ai/status').then(r => r.json()),
    ])
      .then(([metaData, statusData]) => {
        setMeta(metaData)
        setHasApiKey(statusData.hasApiKey ?? false)
        if (metaData.years?.length) {
          const year = metaData.years[metaData.years.length - 1]
          setSelectedYear(year)
          const months = metaData.byYear?.[year]
          if (months?.length) setSelectedMonth(months[0])
        }
      })
      .catch(() => {})
      .finally(() => setMetaLoading(false))
  }, [])

  // Fetch arcs for selected year (skip in preview mode)
  useEffect(() => {
    if (previewMode || !selectedYear) return
    fetch(`/api/arcs?year=${selectedYear}`)
      .then(r => r.json())
      .then(d => setArcs(d.arcs ?? []))
      .catch(() => {})
  }, [previewMode, selectedYear])

  // Fetch days within a selected arc
  useEffect(() => {
    if (!selectedArc) return
    if (previewMode) {
      const all = Object.values(PREVIEW_BY_MONTH).flat()
      setArcDays(all.filter(d => d.date >= selectedArc.startDate && d.date <= selectedArc.endDate))
      return
    }
    fetch(`/api/summaries?from=${selectedArc.startDate}&to=${selectedArc.endDate}`)
      .then(r => r.json())
      .then(d => setArcDays(d.summaries ?? []))
      .catch(() => {})
  }, [previewMode, selectedArc])

  // Fetch month summaries (skip in preview mode)
  useEffect(() => {
    if (previewMode || !selectedYear || !selectedMonth) return
    setMonthLoading(true)
    setDaySummaries([])
    setSelected(null)
    fetch(`/api/summaries?year=${selectedYear}&month=${selectedMonth}`)
      .then(r => r.json())
      .then(d => setDaySummaries(d.summaries ?? []))
      .catch(() => {})
      .finally(() => setMonthLoading(false))
  }, [previewMode, selectedYear, selectedMonth])

  const navigateToDate = useCallback((dateStr: string) => {
    const [y, m] = dateStr.split('-').map(Number)
    setSelectedYear(y)
    setSelectedMonth(m)
    fetch(`/api/summaries?date=${dateStr}`)
      .then(r => r.json())
      .then(d => { if (d.summaries?.[0]) setSelected(d.summaries[0]) })
      .catch(() => {})
  }, [])

  // Calendar grid for current month
  function renderCalendar() {
    if (!selectedYear || !selectedMonth) return null
    const byDay: Record<number, DailySummary> = {}
    for (const s of daySummaries) byDay[s.day] = s

    const firstDow   = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate()

    const cells: (number | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

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
            const isSelected = selected?.day === day && selected?.month === selectedMonth && selected?.year === selectedYear
            return (
              <button
                key={day}
                onClick={() => s && setSelected(s)}
                disabled={!s}
                title={s ? `${fmtDate(s.date)} — ${s.mood}` : undefined}
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

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!metaLoading && !previewMode && (!meta?.years?.length)) {
    const keyMissing = hasApiKey === false

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-12">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${keyMissing ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-mist-100 dark:bg-mist-800'}`}>
          {keyMissing ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400 dark:text-mist-500">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          )}
        </div>

        {keyMissing ? (
          <>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-mist-200 mb-1">API key not configured</p>
              <p className="text-xs text-mist-400 dark:text-mist-500 max-w-xs leading-relaxed">
                Add your Anthropic API key to generate story chapters from your conversation history.
              </p>
            </div>
            <div className="bg-mist-100 dark:bg-mist-800 rounded-xl px-4 py-3 text-left w-full max-w-sm">
              <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 mb-1.5 uppercase tracking-wide">Add to .env.local or Vercel:</p>
              <code className="text-xs text-mist-700 dark:text-mist-200 block mb-3">ANTHROPIC_API_KEY="sk-ant-..."</code>
              <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 mb-1.5 uppercase tracking-wide">Then run:</p>
              <code className="text-xs text-mist-700 dark:text-mist-200 block">node scripts/generate-summaries.mjs</code>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">API key configured</p>
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-mist-200 mb-1">No chapters yet</p>
              <p className="text-xs text-mist-400 dark:text-mist-500 max-w-xs leading-relaxed">
                Run the generation script to build daily story chapters from your conversation history.
              </p>
            </div>
            <div className="bg-mist-100 dark:bg-mist-800 rounded-xl px-4 py-3 text-left w-full max-w-sm">
              <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 mb-1.5 uppercase tracking-wide">Test with 5 days first:</p>
              <code className="text-xs text-mist-700 dark:text-mist-200 block mb-3">node scripts/generate-summaries.mjs --limit 5</code>
              <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 mb-1.5 uppercase tracking-wide">Then run the full archive:</p>
              <code className="text-xs text-mist-700 dark:text-mist-200 block">node scripts/generate-summaries.mjs</code>
            </div>
          </>
        )}

        <button
          onClick={enterPreview}
          className="text-xs text-mist-400 dark:text-mist-500 hover:text-mist-600 dark:hover:text-mist-300 underline underline-offset-2 transition-colors mt-1"
        >
          Preview the UI with sample data →
        </button>
      </div>
    )
  }

  if (metaLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-mist-200 dark:border-mist-700 border-t-mist-500 dark:border-t-mist-400 animate-spin" />
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* Preview banner */}
      {previewMode && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            Sample preview — not your real data
          </p>
          <button
            onClick={() => { setPreviewMode(false); setSelectedYear(null); setSelectedMonth(null); setDaySummaries([]); setSelected(null) }}
            className="text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors shrink-0"
          >
            Exit preview ×
          </button>
        </div>
      )}

      {/* Year tabs */}
      <div className="shrink-0 px-4 pt-4 pb-2 flex gap-1 overflow-x-auto no-scrollbar border-b border-mist-100 dark:border-mist-800">
        {(previewMode ? PREVIEW_META.years : meta?.years ?? []).map(y => (
          <button
            key={y}
            onClick={() => {
              setSelectedYear(y)
              if (previewMode) {
                const months = PREVIEW_META.byYear[y as keyof typeof PREVIEW_META.byYear] ?? []
                const firstMonth = months[0]
                setSelectedMonth(firstMonth)
                setDaySummaries(PREVIEW_BY_MONTH[`${y}-${firstMonth}`] ?? [])
                setSelected(null)
              } else {
                const months = meta?.byYear[y]; if (months?.length) setSelectedMonth(months[0])
              }
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0
              ${y === selectedYear
                ? 'bg-mist-800 dark:bg-mist-100 text-white dark:text-mist-900'
                : 'text-mist-500 dark:text-mist-400 hover:bg-mist-100 dark:hover:bg-mist-800'}`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Month tabs — only in calendar mode */}
      {leftTab === 'calendar' && (
        <div className="shrink-0 px-4 py-2 flex gap-1 overflow-x-auto no-scrollbar">
          {selectedYear && (previewMode
            ? PREVIEW_META.byYear[selectedYear as keyof typeof PREVIEW_META.byYear] ?? []
            : meta?.byYear?.[selectedYear] ?? []
          ).map(m => (
            <button
              key={m}
              onClick={() => {
                setSelectedMonth(m)
                if (previewMode) { setDaySummaries(PREVIEW_BY_MONTH[`${selectedYear}-${m}`] ?? []); setSelected(null) }
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0
                ${m === selectedMonth
                  ? 'bg-mist-200 dark:bg-mist-700 text-mist-800 dark:text-mist-100'
                  : 'text-mist-500 dark:text-mist-400 hover:bg-mist-100 dark:hover:bg-mist-800'}`}
            >
              {MONTH_NAMES[m - 1]}
            </button>
          ))}
        </div>
      )}

      {/* Body: left panel + right panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left column */}
        <div className="w-52 shrink-0 border-r border-mist-100 dark:border-mist-800 flex flex-col min-h-0">

          {/* Calendar / Arcs toggle */}
          <div className="shrink-0 px-3 pt-3 pb-2 flex gap-1">
            {(['calendar', 'arcs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setLeftTab(tab); setSelectedArc(null) }}
                className={`flex-1 py-1 rounded-full text-[11px] font-semibold transition-colors capitalize
                  ${leftTab === tab
                    ? 'bg-mist-200 dark:bg-mist-700 text-mist-800 dark:text-mist-100'
                    : 'text-mist-400 dark:text-mist-500 hover:bg-mist-100 dark:hover:bg-mist-800'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Calendar view */}
          {leftTab === 'calendar' && (
            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {selectedYear && selectedMonth && (
                <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 uppercase tracking-wide mb-2">
                  {MONTH_FULL[selectedMonth - 1]} {selectedYear}
                </p>
              )}
              {monthLoading ? (
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-md bg-mist-100 dark:bg-mist-800 animate-pulse" />
                  ))}
                </div>
              ) : renderCalendar()}
              {!monthLoading && daySummaries.length > 0 && (
                <p className="text-[10px] text-mist-400 dark:text-mist-500 mt-3">
                  {daySummaries.length} chapter{daySummaries.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Arcs view */}
          {leftTab === 'arcs' && (
            <div className="flex-1 overflow-y-auto pb-3">
              {arcs.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-mist-400 dark:text-mist-500 leading-relaxed">
                    {previewMode ? 'Sample arc shown below.' : 'No arcs yet. Run after generating summaries:'}
                  </p>
                  {!previewMode && (
                    <code className="text-[10px] text-mist-500 dark:text-mist-400 block mt-2">
                      node scripts/generate-arcs.mjs
                    </code>
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                  {arcs.map(arc => {
                    const isActive = selectedArc?.title === arc.title && selectedArc?.startDate === arc.startDate
                    return (
                      <button
                        key={`${arc.title}-${arc.startDate}`}
                        onClick={() => { setSelectedArc(arc); setSelected(null) }}
                        className={`text-left px-4 py-3 border-b border-mist-50 dark:border-mist-800/60 transition-colors
                          ${isActive ? 'bg-mist-100 dark:bg-mist-800' : 'hover:bg-mist-50 dark:hover:bg-mist-800/50'}`}
                      >
                        <p className="text-xs font-semibold text-gray-800 dark:text-mist-100 leading-snug mb-0.5">{arc.title}</p>
                        <p className="text-[10px] text-mist-400 dark:text-mist-500">
                          {fmtShort(arc.startDate)} – {fmtShort(arc.endDate)}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${moodColor(arc.mood)}`} />
                          <span className="text-[10px] text-mist-400 dark:text-mist-500 italic truncate">{arc.mood}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right panel: arc detail OR day summary */}
        <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4">

          {/* Arc detail */}
          {selectedArc && !selected && (
            <div className="max-w-prose">
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{selectedArc.title}</h2>
                <p className="text-[11px] text-mist-400 dark:text-mist-500">
                  {fmtShort(selectedArc.startDate)} – {fmtShort(selectedArc.endDate)} · {selectedArc.dayCount} day{selectedArc.dayCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${moodColor(selectedArc.mood)}`} />
                <span className="text-[11px] text-mist-500 dark:text-mist-400 italic">{selectedArc.mood}</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-mist-200 mb-4">{selectedArc.description}</p>
              {selectedArc.themes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {selectedArc.themes.map(t => (
                    <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-mist-100 dark:bg-mist-800 text-mist-600 dark:text-mist-300">{t}</span>
                  ))}
                </div>
              )}
              {/* Days within the arc */}
              {arcDays.length > 0 && (
                <div className="border-t border-mist-100 dark:border-mist-800 pt-4">
                  <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 uppercase tracking-wide mb-2">Days in this arc</p>
                  <div className="flex flex-col gap-1">
                    {arcDays.map(day => (
                      <button
                        key={day.date}
                        onClick={() => setSelected(day)}
                        className="text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-mist-50 dark:hover:bg-mist-800/50 transition-colors group"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${moodColor(day.mood)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-mist-200">{fmtShort(day.date)}</p>
                          <p className="text-[10px] text-mist-400 dark:text-mist-500 italic truncate">{day.mood}</p>
                        </div>
                        <span className="text-[10px] text-mist-300 dark:text-mist-600 group-hover:text-mist-500 dark:group-hover:text-mist-400 transition-colors">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selected ? (
            <div className="max-w-prose">

              {/* Back to arc */}
              {selectedArc && (
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1 text-[11px] text-mist-400 dark:text-mist-500 hover:text-mist-600 dark:hover:text-mist-300 transition-colors mb-3"
                >
                  ← {selectedArc.title}
                </button>
              )}

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                    {fmtDate(selected.date)}
                  </h2>
                  <p className="text-[11px] text-mist-400 dark:text-mist-500 mt-0.5">
                    {selected.messageCount} messages
                  </p>
                </div>
                <button
                  onClick={() => onJumpToMessages(new Date(selected.date + 'T00:00:00').getTime())}
                  className="shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-mist-100 dark:bg-mist-800 text-mist-700 dark:text-mist-200 hover:bg-mist-200 dark:hover:bg-mist-700 transition-colors whitespace-nowrap"
                >
                  Jump to messages →
                </button>
              </div>

              {/* Mood */}
              <div className="flex items-center gap-1.5 mb-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${moodColor(selected.mood)}`} />
                <span className="text-[11px] text-mist-500 dark:text-mist-400 italic">{selected.mood}</span>
              </div>

              {/* Narrative */}
              <p className="text-sm leading-relaxed text-gray-700 dark:text-mist-200 mb-4">
                {selected.summary}
              </p>

              {/* Themes */}
              {selected.themes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selected.themes.map(t => (
                    <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-mist-100 dark:bg-mist-800 text-mist-600 dark:text-mist-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Cross-day links */}
              {selected.linkedDates?.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-mist-100 dark:border-mist-800 pt-3">
                  {selected.linkedDates.map(link => (
                    <button
                      key={`${link.type}-${link.date}`}
                      onClick={() => navigateToDate(link.date)}
                      className="text-xs text-left text-mist-500 dark:text-mist-400 hover:text-mist-700 dark:hover:text-mist-200 transition-colors"
                    >
                      <span className="mr-1">
                        {link.type === 'continues-from' ? '←' : link.type === 'resolved-on' ? '→' : '↗'}
                      </span>
                      {fmtShort(link.date)} — {link.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : !selectedArc ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 opacity-60">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mist-400">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <p className="text-xs text-mist-400 dark:text-mist-500">
                {leftTab === 'arcs'
                  ? 'Select an arc to read its story'
                  : daySummaries.length > 0 ? 'Select a day to read its chapter' : monthLoading ? 'Loading…' : 'No chapters this month'}
              </p>
            </div>
          ) : null}
        </div>

      </div>
    </div>
  )
}
