'use client'
import { useState } from 'react'
import { MediaTab, LightboxState, GalleryItem } from '@/types'
import Gallery from './Gallery'
import FilesView from './FilesView'
import LinksView from './LinksView'
import CallsView from './CallsView'
import Tabs from './Tabs'
import AppHeader from './AppHeader'
import { pbSafe } from '@/lib/ui'

interface Props {
  initialTab?: MediaTab
  counts?: Record<MediaTab, number>
  onLightbox: (s: LightboxState) => void
  onContextMenu: (e: React.MouseEvent, item: GalleryItem) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  thread?: string
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

export default function MediaPane({
  initialTab, counts, thread = 'messages',
  onLightbox, onContextMenu, hideImages, hiddenUris, isSuperAdmin, onBack,
}: Props) {
  const [tab, setTab] = useState<MediaTab>(initialTab ?? 'photos')

  const tabsWithCounts = MEDIA_TABS.map(t => {
    const n = counts?.[t.key]
    return n != null && n > 0 ? { ...t, label: `${t.label} (${n.toLocaleString()})` } : t
  })

  return (
    <div className="flex-1 flex flex-col min-h-0 liquid-glass-atmosphere">
      <AppHeader
        title={<span className="text-sm font-bold truncate">Media</span>}
        onBack={onBack}
        embedded
      />

      <Tabs tabs={tabsWithCounts} active={tab} onChange={k => setTab(k)} scrollable />
      <div className={`flex-1 flex flex-col min-h-0 ${pbSafe} md:pb-0`}>
        {tab === 'photos'   && <Gallery type="photos"   thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} />}
        {tab === 'videos'   && <Gallery type="videos"   thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} />}
        {tab === 'gifs'     && <Gallery type="gifs"     thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} />}
        {tab === 'stickers' && <Gallery type="stickers" thread={thread} onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} />}
        {tab === 'audio'    && <FilesView type="audio" thread={thread} />}
        {tab === 'files'    && <FilesView type="files" thread={thread} />}
        {tab === 'links'    && <LinksView thread={thread} />}
        {tab === 'calls'    && <CallsView thread={thread} />}
      </div>
    </div>
  )
}
