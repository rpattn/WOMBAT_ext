import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import SavedLibrariesDropdown from './SavedLibrariesDropdown'
import { useApiContext } from '../context/ApiContext'

export type PageWithLibraryProps = {
  title: string
  sidebar?: ReactNode
  children: ReactNode
  projectLabel?: string
  projectActions?: ReactNode
}

export default function PageWithLibrary({ title, sidebar, children, projectLabel = 'Project', projectActions }: PageWithLibraryProps) {
  const {
    savedLibraries,
    selectedSavedLibrary,
    setSelectedSavedLibrary,
    loadSaved,
    restoreWorking,
  } = useApiContext()

  // Sidebar layout controls
  const LS_KEY = 'pageWithLibrary.sidebarWidth'
  const DEFAULT_WIDTH = 380
  const MIN_WIDTH = 260
  const MAX_WIDTH = 800
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const v = Number(window.localStorage.getItem(LS_KEY) || '')
      return Number.isFinite(v) && v >= MIN_WIDTH && v <= MAX_WIDTH ? v : DEFAULT_WIDTH
    } catch { return DEFAULT_WIDTH }
  })
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const draggingRef = useRef(false)

  useEffect(() => {
    try { window.localStorage.setItem(LS_KEY, String(sidebarWidth)) } catch {}
  }, [sidebarWidth])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return
      const dx = e.movementX
      setSidebarWidth(w => {
        let nw = w + dx
        if (nw < MIN_WIDTH) nw = MIN_WIDTH
        if (nw > MAX_WIDTH) nw = MAX_WIDTH
        return nw
      })
      e.preventDefault()
    }
    function onUp() { draggingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div className="app-container app-full" style={{ gap: 12 }}>
      <h2>{title}</h2>

      <div className="section" style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        padding: 'var(--space-8)'
      }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>{projectLabel}</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="saved-libs" style={{ maxWidth: 520 }}>
            <SavedLibrariesDropdown
              libraries={savedLibraries}
              value={selectedSavedLibrary}
              onChange={(val: string) => {
                setSelectedSavedLibrary(val)
                try { window.localStorage.setItem('lastSavedLibraryName', val || '') } catch {}
                if (val) {
                  loadSaved(val).catch(() => {})
                } else {
                  // switching back to working session: restore from server-side backup
                  restoreWorking().catch(() => {})
                }
              }}
            />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {sidebar && (
              <button
                className="btn"
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? 'Show Sidebar' : 'Hide Sidebar'}
              >{collapsed ? 'Show Sidebar' : 'Hide Sidebar'}</button>
            )}
            {projectActions}
          </div>
        </div>
      </div>

      <div className="row stack-sm" style={{ gap: 0, alignItems: 'stretch' }}>
        {sidebar && !collapsed && (
          <aside
            style={{
              minWidth: MIN_WIDTH,
              flex: `0 0 ${sidebarWidth}px`,
              maxWidth: MAX_WIDTH,
              overflow: 'hidden',
              borderRight: '1px solid var(--color-border)'
            }}
            className="panel"
          >
            {sidebar}
          </aside>
        )}
        {sidebar && !collapsed && (
          <div
            onMouseDown={() => { draggingRef.current = true }}
            onDoubleClick={() => setSidebarWidth(DEFAULT_WIDTH)}
            style={{
              width: 6,
              cursor: 'col-resize',
              userSelect: 'none',
              background: 'transparent',
              position: 'relative'
            }}
            aria-label="Resize sidebar"
            title="Drag to resize. Double-click to reset."
          >
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 2, width: 2, background: 'var(--color-border)' }} />
          </div>
        )}
        <main style={{ flex: 1, minWidth: 320, paddingLeft: 16 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
