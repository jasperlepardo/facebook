'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { DailySummary, Arc } from '@/types'
import { PREVIEW_BY_MONTH, PREVIEW_META, PREVIEW_ARCS } from '@/fixtures/storyPreviewData'
import { StoryCalendar } from './StoryCalendar'
import { ArcTimeline, ArcDetail } from './ArcTimeline'
import { DaySummaryView } from './DaySummaryView'
import { StoryPaneSkeleton } from '@/components/skeletons'
import { pbNav } from '@/lib/ui'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface StoryPaneProps {
  onJumpToMessages: (ts: number) => void
}

export default function StoryPane({ onJumpToMessages }: StoryPaneProps) {
  const [meta, setMeta]                       = useState<{ years: number[]; byYear: Record<number, number[]> } | null>(null)
  const [metaLoading, setMetaLoading]         = useState(true)
  const [hasApiKey, setHasApiKey]             = useState<boolean | null>(null)
  const [selectedYear, setSelectedYear]       = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth]     = useState<number | null>(null)
  const [daySummaries, setDaySummaries]       = useState<DailySummary[]>([])
  const [monthLoading, setMonthLoading]       = useState(false)
  const [selected, setSelected]               = useState<DailySummary | null>(null)
  const [previewMode, setPreviewMode]         = useState(false)
  const [leftTab, setLeftTab]                 = useState<'calendar' | 'arcs'>('calendar')
  const [arcs, setArcs]                       = useState<Arc[]>([])
  const [selectedArc, setSelectedArc]         = useState<Arc | null>(null)
  const [arcDays, setArcDays]                 = useState<DailySummary[]>([])

  const enterPreview = useCallback(() => {
    const month = PREVIEW_BY_MONTH['2018-3']
    setPreviewMode(true)
    setSelectedYear(2018)
    setSelectedMonth(3)
    setDaySummaries(month)
    setSelected(month.find(d => d.date === '2018-03-14') ?? month[0])
    setArcs(PREVIEW_ARCS)
  }, [])

  const exitPreview = useCallback(() => {
    setPreviewMode(false)
    setSelectedYear(null)
    setSelectedMonth(null)
    setDaySummaries([])
    setSelected(null)
  }, [])

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
      .catch(() => toast('Failed to load story data'))
      .finally(() => setMetaLoading(false))
  }, [])

  useEffect(() => {
    if (previewMode || !selectedYear) return
    fetch(`/api/arcs?year=${selectedYear}`)
      .then(r => r.json())
      .then(d => setArcs(d.arcs ?? []))
      .catch(() => toast('Failed to load story arcs'))
  }, [previewMode, selectedYear])

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
      .catch(() => toast('Failed to load arc days'))
  }, [previewMode, selectedArc])

  useEffect(() => {
    if (previewMode || !selectedYear || !selectedMonth) return
    setMonthLoading(true)
    setDaySummaries([])
    setSelected(null)
    fetch(`/api/summaries?year=${selectedYear}&month=${selectedMonth}`)
      .then(r => r.json())
      .then(d => setDaySummaries(d.summaries ?? []))
      .catch(() => toast('Failed to load chapters'))
      .finally(() => setMonthLoading(false))
  }, [previewMode, selectedYear, selectedMonth])

  const navigateToDate = useCallback((dateStr: string) => {
    const [y, m] = dateStr.split('-').map(Number)
    setSelectedYear(y)
    setSelectedMonth(m)
    fetch(`/api/summaries?date=${dateStr}`)
      .then(r => r.json())
      .then(d => { if (d.summaries?.[0]) setSelected(d.summaries[0]) })
      .catch(() => toast('Failed to navigate to date'))
  }, [])

  // ── Empty / loading states ───────────────────────────────────────────────────

  if (metaLoading) return <StoryPaneSkeleton />

  if (!previewMode && !meta?.years?.length) {
    const keyMissing = hasApiKey === false
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-12">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${keyMissing ? 'bg-amber-50 dark:bg-amber-900/20' : 'liquid-glass'}`}>
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
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-mist-200 mb-1">Story isn&apos;t set up yet</p>
            <p className="text-xs text-mist-400 dark:text-mist-500 max-w-xs leading-relaxed">
              Add an Anthropic API key on the server, then generate chapters from your archive. Until then, you can preview how Story looks.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-mist-200 mb-1">No chapters yet</p>
            <p className="text-xs text-mist-400 dark:text-mist-500 max-w-xs leading-relaxed">
              Your archive is ready. Generate daily chapters to turn conversations into a readable story timeline.
            </p>
          </div>
        )}

        <button onClick={enterPreview}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors mt-1">
          Preview with sample data →
        </button>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────────────

  const visibleYears   = previewMode ? PREVIEW_META.years : (meta?.years ?? [])
  const visibleMonths  = selectedYear
    ? (previewMode ? PREVIEW_META.byYear[selectedYear as keyof typeof PREVIEW_META.byYear] ?? [] : meta?.byYear?.[selectedYear] ?? [])
    : []

  // Mobile: show calendar/arcs OR reader (not both). Desktop: side-by-side.
  const readingOpen = !!(selected || selectedArc)
  const closeReading = () => { setSelected(null); setSelectedArc(null) }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden liquid-glass-atmosphere">

      {previewMode && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Sample preview — not your real data</p>
          <button onClick={exitPreview} className="text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-colors shrink-0">
            Exit preview ×
          </button>
        </div>
      )}

      {/* Year/month chrome — hide on mobile while reading */}
      <div className={readingOpen ? 'hidden md:contents' : 'contents'}>
        {/* Year tabs */}
        <div className="shrink-0 px-4 pt-4 pb-2 flex gap-1 overflow-x-auto no-scrollbar border-b border-mist-100 dark:border-mist-800">
          {visibleYears.map(y => (
            <button key={y} onClick={() => {
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
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0
                ${y === selectedYear
                  ? 'liquid-glass-selected text-gray-900 dark:text-white'
                  : 'text-mist-500 dark:text-mist-400 liquid-glass-hover'}`}
            >{y}</button>
          ))}
        </div>

        {/* Month tabs — calendar mode only */}
        {leftTab === 'calendar' && (
          <div className="shrink-0 px-4 py-2 flex gap-1 overflow-x-auto no-scrollbar">
            {visibleMonths.map(m => (
              <button key={m} onClick={() => {
                setSelectedMonth(m)
                if (previewMode) { setDaySummaries(PREVIEW_BY_MONTH[`${selectedYear}-${m}`] ?? []); setSelected(null) }
              }}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0
                  ${m === selectedMonth
                    ? 'liquid-glass-selected text-mist-800 dark:text-mist-100'
                    : 'text-mist-500 dark:text-mist-400 liquid-glass-hover'}`}
              >{MONTH_NAMES[m - 1]}</button>
            ))}
          </div>
        )}
      </div>

      {/* Body: stacked on mobile, side-by-side from md */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left column — full width on mobile until a chapter/arc is open */}
        <div className={`w-full md:w-52 shrink-0 md:border-r border-mist-100 dark:border-mist-800 flex-col min-h-0 ${readingOpen ? 'hidden md:flex' : 'flex'}`}>
          <div className="shrink-0 px-3 pt-3 pb-2 flex gap-1">
            {(['calendar', 'arcs'] as const).map(tab => (
              <button key={tab} onClick={() => { setLeftTab(tab); setSelectedArc(null) }}
                className={`flex-1 py-1.5 rounded-full text-[11px] font-semibold transition-colors capitalize
                  ${leftTab === tab
                    ? 'liquid-glass-selected text-mist-800 dark:text-mist-100'
                    : 'text-mist-400 dark:text-mist-500 liquid-glass-hover'}`}
              >{tab}</button>
            ))}
          </div>

          {leftTab === 'calendar' && (
            <div className={`flex-1 overflow-y-auto px-4 ${pbNav} md:pb-3`}>
              {selectedYear && selectedMonth && (
                <p className="text-[10px] font-semibold text-mist-400 dark:text-mist-500 uppercase tracking-wide mb-2">
                  {['January','February','March','April','May','June','July','August','September','October','November','December'][selectedMonth - 1]} {selectedYear}
                </p>
              )}
              {selectedYear && selectedMonth && (
                <StoryCalendar
                  year={selectedYear}
                  month={selectedMonth}
                  summaries={daySummaries}
                  selected={selected}
                  isLoading={monthLoading}
                  onSelect={setSelected}
                />
              )}
              {!monthLoading && daySummaries.length > 0 && (
                <p className="text-[10px] text-mist-400 dark:text-mist-500 mt-3">
                  {daySummaries.length} chapter{daySummaries.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {leftTab === 'arcs' && (
            <div className={`flex-1 overflow-y-auto ${pbNav} md:pb-3`}>
              <ArcTimeline
                arcs={arcs}
                selectedArc={selectedArc}
                arcDays={arcDays}
                isPreview={previewMode}
                onSelectArc={arc => { setSelectedArc(arc); setSelected(null) }}
                onSelectDay={setSelected}
              />
            </div>
          )}
        </div>

        {/* Right panel — full-bleed reader on mobile when open */}
        <div className={`flex-1 min-w-0 overflow-y-auto px-5 py-4 ${pbNav} md:pb-4 ${readingOpen ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
          {readingOpen && (
            <button
              type="button"
              onClick={() => {
                if (selected && selectedArc) setSelected(null)
                else closeReading()
              }}
              className="md:hidden flex items-center gap-1 text-xs font-medium text-mist-500 dark:text-mist-400 mb-3 shrink-0 self-start"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {selected && selectedArc ? selectedArc.title : 'Story'}
            </button>
          )}
          {selected ? (
            <DaySummaryView
              summary={selected}
              parentArc={selectedArc}
              onJumpToMessages={onJumpToMessages}
              onNavigateToDate={navigateToDate}
              onBackToArc={() => setSelected(null)}
            />
          ) : selectedArc ? (
            <ArcDetail arc={selectedArc} arcDays={arcDays} onSelectDay={setSelected} />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}
