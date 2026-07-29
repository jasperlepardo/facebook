'use client'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Section } from '@/types'
import AppNav from './AppNav'

export interface AppLayoutControls {
  onShowDetail: () => void
  onShowList:   () => void
}

interface AppLayoutProps {
  section: Section
  onSectionChange: (s: Section) => void
  initials: string
  prevSection?: 'chat' | 'hashtags'
  listPane:   (controls: AppLayoutControls) => ReactNode
  detailPane: (controls: AppLayoutControls) => ReactNode
  mediaPane?: ReactNode
  listGrow?: number
  detailGrow?: number
  hideListPane?: boolean
  centeredDetail?: boolean
}

export default function AppLayout({ section, onSectionChange, initials, prevSection, listPane, detailPane, mediaPane, listGrow = 4, detailGrow = 7, hideListPane = false, centeredDetail = false }: AppLayoutProps) {
  const [mobileShowList, setMobileShowList] = useState(
    section === 'chat' || section === 'hashtags'
  )
  const [navExpanded, setNavExpanded] = useState(false)
  const shouldSlide = useRef(false)

  useEffect(() => {
    if (localStorage.getItem('navExpanded') === '1') setNavExpanded(true)
  }, [])

  function toggleNav() {
    setNavExpanded(v => {
      const next = !v
      localStorage.setItem('navExpanded', next ? '1' : '0')
      return next
    })
  }

  const controls: AppLayoutControls = {
    onShowDetail: () => { shouldSlide.current = true;  setMobileShowList(false) },
    onShowList:   () => { shouldSlide.current = true;  setMobileShowList(true)  },
  }

  function handleSectionChange(s: Section) {
    shouldSlide.current = false
    setMobileShowList(s === 'chat' || s === 'hashtags')
    onSectionChange(s)
  }

  const detailClass = shouldSlide.current
    ? `transition-transform duration-300 ease-out ${mobileShowList ? 'translate-x-full' : 'translate-x-0'}`
    : mobileShowList ? 'hidden md:flex' : ''

  return (
    <div className="md:gap-3 flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden md:pb-0">

      {/* Nav */}
      <AppNav
        section={section}
        prevSection={prevSection}
        initials={initials}
        hiddenOnMobile={!mobileShowList}
        onSectionChange={handleSectionChange}
        isExpanded={navExpanded}
        onToggleExpanded={toggleNav}
      />

      {centeredDetail ? (
        <>
          {/* Left spacer */}
          <div className="hidden md:block basis-0 min-w-0" style={{ flexGrow: listGrow }} />

          {/* Detail pane — centered column */}
          <div className="flex flex-col overflow-hidden bg-white dark:bg-mist-900 flex-1 md:basis-0 md:min-w-0 md:min-h-0 md:rounded-2xl" style={{ flexGrow: detailGrow }}>
            {detailPane(controls)}
          </div>

          {/* Right spacer */}
          <div className="hidden md:block basis-0 min-w-0" style={{ flexGrow: listGrow }} />
        </>
      ) : (
        <>
          {/* Left pane */}
          {!hideListPane && (
            <div className="flex flex-col shrink-0 overflow-hidden bg-white dark:bg-mist-950 md:dark:bg-mist-900 pb-[env(safe-area-inset-bottom)] absolute inset-0 md:static md:basis-0 md:min-w-0 md:rounded-2xl md:pb-0" style={{ flexGrow: listGrow }}>
              {listPane(controls)}
            </div>
          )}

          {/* Scrim */}
          <div className={`absolute inset-0 z-[9] bg-black/40 transition-opacity duration-300 ease-out md:hidden pointer-events-none ${mobileShowList ? 'opacity-0' : 'opacity-100'}`} />

          {/* Detail pane */}
          <div className={`flex flex-col overflow-hidden bg-white dark:bg-mist-900 absolute inset-0 z-10 md:static md:z-auto md:basis-0 md:min-w-0 md:min-h-0 md:rounded-2xl md:translate-x-0 ${detailClass}`} style={{ flexGrow: detailGrow }}>
            {detailPane(controls)}
          </div>

          {/* Media pane — full-screen overlay on mobile, third column on desktop */}
          {mediaPane && (
            <div className="flex flex-col overflow-hidden bg-white dark:bg-mist-900 absolute inset-0 z-20 md:static md:z-auto md:basis-0 md:min-w-0 md:rounded-2xl md:[flex-grow:5]">
              {mediaPane}
            </div>
          )}
        </>
      )}

    </div>
  )
}
