'use client'
import { useState } from 'react'
import { MediaTab, LightboxState, GalleryItem } from '@/types'
import Gallery from './Gallery'
import FilesView from './FilesView'
import LinksView from './LinksView'
import CallsView from './CallsView'
import Tabs from './Tabs'

interface Props {
  initialTab?: MediaTab
  counts?: Record<MediaTab, number>
  onLightbox: (s: LightboxState) => void
  onContextMenu: (e: React.MouseEvent, item: GalleryItem) => void
  hideImages?: boolean
  hiddenUris?: Set<string>
  isSuperAdmin?: boolean
  onHideUri?: (uri: string) => void
  onUnhideUri?: (uri: string) => void
  onClose?: () => void
}

const MEDIA_TABS: { key: MediaTab; label: string }[] = [
  { key: 'photos', label: 'Photos' },
  { key: 'videos', label: 'Videos' },
  { key: 'gifs',   label: 'GIFs'   },
  { key: 'audio',  label: 'Audio'  },
  { key: 'files',  label: 'Files'  },
  { key: 'links',  label: 'Links'  },
]

export default function MediaPane({ initialTab, counts, onLightbox, onContextMenu, hideImages, hiddenUris, isSuperAdmin, onHideUri, onUnhideUri, onClose }: Props) {
  const [tab, setTab] = useState<MediaTab>(initialTab ?? 'photos')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 flex items-center justify-between shrink-0 bg-white dark:bg-mist-900">
        <span className="text-sm font-bold text-gray-900 dark:text-white">Media</span>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-mist-100 dark:hover:bg-mist-800 text-gray-500 dark:text-mist-400 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
      <Tabs
        tabs={MEDIA_TABS}
        active={tab}
        onChange={k => setTab(k)}
        scrollable
      />
      {tab === 'photos'   && <Gallery type="photos"   onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={onHideUri} onUnhideUri={onUnhideUri} />}
      {tab === 'videos'   && <Gallery type="videos"   onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={onHideUri} onUnhideUri={onUnhideUri} />}
      {tab === 'gifs'     && <Gallery type="gifs"     onLightbox={onLightbox} onContextMenu={onContextMenu} hideImages={hideImages} hiddenUris={hiddenUris} isSuperAdmin={isSuperAdmin} onHideUri={onHideUri} onUnhideUri={onUnhideUri} />}
      {tab === 'audio' && <FilesView type="audio" />}
      {tab === 'files' && <FilesView type="files" />}
      {tab === 'links' && <LinksView />}
    </div>
  )
}
