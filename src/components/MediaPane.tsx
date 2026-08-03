'use client'
import { useState } from 'react'
import { MediaTab, LightboxState, GalleryItem, ThreadParticipant } from '@/types'
import Gallery from './Gallery'
import GalleryFilterBar from './GalleryFilterBar'
import FilesView from './FilesView'
import LinksView from './LinksView'
import CallsView from './CallsView'
import Tabs from './Tabs'
import AppHeader from './AppHeader'
import { pbSafe } from '@/lib/ui'
import { monthKeyBounds } from '@/lib/galleryFilters'

interface Props {
  initialTab?: MediaTab
  counts?: Record<MediaTab, number>
  onLightbox: (s: LightboxState) => void
  onContextMenu: (e: React.MouseEvent, item: GalleryItem) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  /** Jump gallery to this attachment when opening from lightbox. */
  focusUri?: string
  focusTs?: number
  thread?: string
  participants?: ThreadParticipant[]
  onBack?: () => void
}

const MEDIA_TABS: { key: MediaTab; label: string }[] = [
  { key: 'photos',   label: 'Photos' },
  { key: 'videos',   label: 'Videos' },
  { key: 'gifs',     label: 'GIFs' },
  { key: 'stickers', label: 'Stickers' },
  { key: 'audio',    label: 'Audio' },
  { key: 'files',    label: 'Files' },
  { key: 'links',    label: 'Links' },
  { key: 'calls',    label: 'Calls' },
]

const GALLERY_TABS = new Set<MediaTab>(['photos', 'videos', 'gifs', 'stickers'])

export default function MediaPane({
  initialTab, counts, thread = 'messages', participants = [],
  onLightbox, onContextMenu, hideImages, hiddenUris, isSuperAdmin,
  focusUri, focusTs, onBack,
}: Props) {
  const [tab, setTab] = useState<MediaTab>(initialTab ?? 'photos')
  const [senderIds, setSenderIds] = useState<string[]>([])
  const [yearMonth, setYearMonth] = useState('')
  const focusActive = tab === (initialTab ?? 'photos')
  const showFilters = GALLERY_TABS.has(tab)
  const bounds = yearMonth ? monthKeyBounds(yearMonth) : null

  const tabsWithCounts = MEDIA_TABS.map(t => {
    const n = counts?.[t.key]
    return n != null && n > 0 ? { ...t, label: `${t.label} (${n.toLocaleString()})` } : t
  })

  const galleryProps = {
    thread,
    onLightbox,
    onContextMenu,
    hideImages,
    hiddenUris,
    isSuperAdmin,
    focusUri: focusActive ? focusUri : undefined,
    focusTs: focusActive ? focusTs : undefined,
    senderIds,
    tsFrom: bounds?.tsFrom,
    tsTo: bounds?.tsTo,
    onClearFilters: () => { setSenderIds([]); setYearMonth('') },
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 liquid-glass-atmosphere">
      <AppHeader
        title={<span className="text-sm font-bold truncate">Media</span>}
        onBack={onBack}
        embedded
      />

      <Tabs tabs={tabsWithCounts} active={tab} onChange={k => setTab(k)} scrollable />
      {showFilters && (
        <GalleryFilterBar
          participants={participants}
          senderIds={senderIds}
          onSenderIdsChange={setSenderIds}
          yearMonth={yearMonth}
          onYearMonthChange={setYearMonth}
        />
      )}
      <div className={`flex-1 flex flex-col min-h-0 ${pbSafe} md:pb-0`}>
        {tab === 'photos'   && <Gallery type="photos"   {...galleryProps} />}
        {tab === 'videos'   && <Gallery type="videos"   {...galleryProps} />}
        {tab === 'gifs'     && <Gallery type="gifs"     {...galleryProps} />}
        {tab === 'stickers' && <Gallery type="stickers" {...galleryProps} />}
        {tab === 'audio'    && <FilesView type="audio" thread={thread} />}
        {tab === 'files'    && <FilesView type="files" thread={thread} />}
        {tab === 'links'    && <LinksView thread={thread} />}
        {tab === 'calls'    && <CallsView thread={thread} />}
      </div>
    </div>
  )
}
